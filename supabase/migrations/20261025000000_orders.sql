create table if not exists public.order_admins (
    user_id uuid primary key references auth.users (id) on delete cascade
);

create table if not exists public.order_counters (
    queue_date date primary key,
    last_number integer not null check (last_number > 0)
);

create table if not exists public.orders (
    id uuid primary key default gen_random_uuid(),
    queue_date date not null,
    queue_number integer not null,
    customer_name text not null check (char_length(customer_name) between 1 and 100),
    customer_phone text check (customer_phone is null or char_length(customer_phone) <= 24),
    note text not null default '' check (char_length(note) <= 500),
    payment_method text not null check (payment_method in ('cash', 'qris')),
    payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid')),
    status text not null default 'pending'
        check (status in ('pending', 'accepted', 'rejected', 'preparing', 'ready', 'completed')),
    total_amount bigint not null check (total_amount >= 0),
    tracking_token uuid not null unique default gen_random_uuid(),
    created_at timestamptz not null default now(),
    unique (queue_date, queue_number)
);

create table if not exists public.order_items (
    id bigint generated always as identity primary key,
    order_id uuid not null references public.orders (id) on delete cascade,
    menu_id text not null,
    menu_name text not null,
    unit_price bigint not null check (unit_price >= 0),
    quantity integer not null check (quantity between 1 and 99),
    line_total bigint not null check (line_total >= 0)
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists order_items_order_id_idx on public.order_items (order_id);

alter table public.order_admins enable row level security;
alter table public.order_counters enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

revoke all on public.order_admins, public.order_counters, public.orders, public.order_items
    from public, anon, authenticated;

create or replace function public.format_queue_code(p_queue_date date, p_queue_number integer)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
    select
        case
            when p_queue_number < 1000 then lpad(p_queue_number::text, 3, '0')
            else p_queue_number::text
        end
        || '-' || to_char(p_queue_date, 'DDMMYY');
$$;

create or replace function public.place_order(
    p_customer_name text,
    p_customer_phone text,
    p_note text,
    p_payment_method text,
    p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
    v_queue_date date := timezone('Asia/Jakarta', now())::date;
    v_queue_number integer;
    v_order_id uuid;
    v_tracking_token uuid;
    v_customer_name text := btrim(coalesce(p_customer_name, ''));
    v_customer_phone text := nullif(btrim(coalesce(p_customer_phone, '')), '');
    v_note text := btrim(coalesce(p_note, ''));
    v_item jsonb;
    v_menu record;
    v_quantity integer;
    v_total bigint := 0;
    v_snapshot jsonb := '[]'::jsonb;
begin
    if char_length(v_customer_name) not between 1 and 100 then
        raise exception 'Nama pemesan wajib diisi (maksimal 100 karakter).';
    end if;
    if v_customer_phone is not null and char_length(v_customer_phone) > 24 then
        raise exception 'Nomor telepon maksimal 24 karakter.';
    end if;
    if char_length(v_note) > 500 then
        raise exception 'Catatan maksimal 500 karakter.';
    end if;
    if p_payment_method is null or p_payment_method not in ('cash', 'qris') then
        raise exception 'Metode pembayaran tidak valid.';
    end if;
    if jsonb_typeof(p_items) is distinct from 'array' then
        raise exception 'Format daftar menu tidak valid.';
    end if;
    if jsonb_array_length(p_items) not between 1 and 30 then
        raise exception 'Pesanan harus memiliki 1 sampai 30 jenis menu.';
    end if;
    if (
        select count(distinct item->>'id')
        from jsonb_array_elements(p_items) as items(item)
    ) <> jsonb_array_length(p_items) then
        raise exception 'Menu yang sama tidak boleh dikirim lebih dari satu kali.';
    end if;

    for v_item in select value from jsonb_array_elements(p_items)
    loop
        if jsonb_typeof(v_item->'id') is distinct from 'string'
            or (v_item->>'id') = ''
            or jsonb_typeof(v_item->'quantity') is distinct from 'number'
            or (v_item->>'quantity') !~ '^[0-9]+$' then
            raise exception 'Data menu atau jumlah tidak valid.';
        end if;
        v_quantity := (v_item->>'quantity')::integer;
        if v_quantity not between 1 and 99 then
            raise exception 'Jumlah menu harus antara 1 dan 99.';
        end if;

        select m.id::text as id, m.name, m.price::numeric as price
        into v_menu
        from public.menus as m
        where m.id::text = v_item->>'id'
            and m.active is true
        for share;

        if not found then
            raise exception 'Salah satu menu sudah tidak tersedia. Muat ulang katalog.';
        end if;
        if v_menu.price < 0 or v_menu.price <> trunc(v_menu.price)
            or v_menu.price > 9000000000000000 then
            raise exception 'Harga menu tidak valid.';
        end if;
        if v_total::numeric + v_menu.price * v_quantity > 9007199254740991 then
            raise exception 'Total pesanan melewati batas perhitungan yang didukung.';
        end if;

        v_total := v_total + v_menu.price::bigint * v_quantity;
        v_snapshot := v_snapshot || jsonb_build_array(jsonb_build_object(
            'menu_id', v_menu.id,
            'menu_name', v_menu.name,
            'unit_price', v_menu.price::bigint,
            'quantity', v_quantity
        ));
    end loop;

    insert into public.order_counters (queue_date, last_number)
    values (v_queue_date, 1)
    on conflict (queue_date)
    do update set last_number = public.order_counters.last_number + 1
    returning last_number into v_queue_number;

    insert into public.orders (
        queue_date, queue_number, customer_name, customer_phone, note,
        payment_method, total_amount
    )
    values (
        v_queue_date, v_queue_number, v_customer_name, v_customer_phone, v_note,
        p_payment_method, v_total
    )
    returning id, tracking_token into v_order_id, v_tracking_token;

    insert into public.order_items (order_id, menu_id, menu_name, unit_price, quantity, line_total)
    select
        v_order_id,
        item->>'menu_id',
        item->>'menu_name',
        (item->>'unit_price')::bigint,
        (item->>'quantity')::integer,
        (item->>'unit_price')::bigint * (item->>'quantity')::integer
    from jsonb_array_elements(v_snapshot) as snapshot(item);

    return jsonb_build_object(
        'tracking_token', v_tracking_token,
        'queue_code', public.format_queue_code(v_queue_date, v_queue_number),
        'total_amount', v_total,
        'status', 'pending',
        'payment_method', p_payment_method
    );
end;
$$;

create or replace function public.get_order_status(p_tracking_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
    select jsonb_build_object(
        'queue_code', public.format_queue_code(o.queue_date, o.queue_number),
        'customer_name', o.customer_name,
        'status', o.status,
        'payment_method', o.payment_method,
        'payment_status', o.payment_status,
        'total_amount', o.total_amount,
        'created_at', o.created_at
    )
    from public.orders as o
    where o.tracking_token = p_tracking_token;
$$;

create or replace function public.admin_list_orders()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
    v_orders jsonb;
begin
    if not exists (select 1 from public.order_admins where user_id = auth.uid()) then
        raise exception 'Akun ini tidak memiliki akses admin pesanan.';
    end if;

    select coalesce(jsonb_agg(order_data.value order by order_data.priority, order_data.created_at desc), '[]'::jsonb)
    into v_orders
    from (
        select
            o.created_at,
            case o.status
                when 'pending' then 0
                when 'accepted' then 1
                when 'preparing' then 2
                when 'ready' then 3
                else 4
            end as priority,
            jsonb_build_object(
                'id', o.id,
                'queue_code', public.format_queue_code(o.queue_date, o.queue_number),
                'customer_name', o.customer_name,
                'customer_phone', o.customer_phone,
                'note', o.note,
                'status', o.status,
                'payment_method', o.payment_method,
                'payment_status', o.payment_status,
                'total_amount', o.total_amount,
                'created_at', o.created_at,
                'items', (
                    select coalesce(jsonb_agg(jsonb_build_object(
                        'menu_name', oi.menu_name,
                        'unit_price', oi.unit_price,
                        'quantity', oi.quantity,
                        'line_total', oi.line_total
                    ) order by oi.id), '[]'::jsonb)
                    from public.order_items as oi
                    where oi.order_id = o.id
                )
            ) as value
        from public.orders as o
        where o.status in ('pending', 'accepted', 'preparing', 'ready')
            or o.created_at >= now() - interval '24 hours'
        order by
            case o.status
                when 'pending' then 0
                when 'accepted' then 1
                when 'preparing' then 2
                when 'ready' then 3
                else 4
            end,
            o.created_at desc
        limit 100
    ) as order_data;

    return v_orders;
end;
$$;

create or replace function public.admin_update_order(
    p_order_id uuid,
    p_status text default null,
    p_payment_status text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
    v_order public.orders%rowtype;
begin
    if not exists (select 1 from public.order_admins where user_id = auth.uid()) then
        raise exception 'Akun ini tidak memiliki akses admin pesanan.';
    end if;
    if p_status is null and p_payment_status is null then
        raise exception 'Tidak ada perubahan yang diminta.';
    end if;

    select * into v_order
    from public.orders
    where id = p_order_id
    for update;
    if not found then
        raise exception 'Pesanan tidak ditemukan.';
    end if;

    if p_status is not null then
        if not (
            (v_order.status = 'pending' and p_status in ('accepted', 'rejected'))
            or (v_order.status = 'accepted' and p_status = 'preparing')
            or (v_order.status = 'preparing' and p_status = 'ready')
            or (v_order.status = 'ready' and p_status = 'completed')
        ) then
            raise exception 'Perubahan status pesanan tidak diizinkan.';
        end if;
        update public.orders set status = p_status where id = p_order_id;
    end if;

    if p_payment_status is not null then
        if p_payment_status not in ('paid', 'unpaid') then
            raise exception 'Status pembayaran tidak valid.';
        end if;
        if coalesce(p_status, v_order.status) = 'rejected' then
            raise exception 'Pesanan yang ditolak tidak dapat ditandai sudah dibayar.';
        end if;
        if p_payment_status = 'paid'
            and coalesce(p_status, v_order.status) not in ('accepted', 'preparing', 'ready', 'completed') then
            raise exception 'Pembayaran hanya dapat dikonfirmasi setelah pesanan diterima.';
        end if;
        update public.orders set payment_status = p_payment_status where id = p_order_id;
    end if;
end;
$$;

revoke all on function public.place_order(text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.format_queue_code(date, integer) from public, anon, authenticated;
revoke all on function public.get_order_status(uuid) from public, anon, authenticated;
revoke all on function public.admin_list_orders() from public, anon, authenticated;
revoke all on function public.admin_update_order(uuid, text, text) from public, anon, authenticated;

grant execute on function public.place_order(text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.get_order_status(uuid) to anon, authenticated;
grant execute on function public.admin_list_orders() to authenticated;
grant execute on function public.admin_update_order(uuid, text, text) to authenticated;
