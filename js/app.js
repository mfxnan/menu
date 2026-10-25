const CONFIG = {
    supabaseUrl: 'https://ulpckwlazrnhxvjthlgh.supabase.co',
    supabasePublishableKey: 'sb_publishable_sxy7RSWC7Lo5ggQyPTvjRA_fH_xdsLJ',
    outletWhatsApp: '6285725489277'
};

const MENU_TABLE = 'menus';
const LAST_ORDER_TOKEN_KEY = 'rc-ks-tubun-order-token';
const supabaseClient = window.supabase?.createClient(CONFIG.supabaseUrl, CONFIG.supabasePublishableKey);
const menuGrid = document.getElementById('menuGrid');
const categoryList = document.getElementById('categoryList');
const statusLabel = document.getElementById('connectionStatus');
const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
let menuItems = [];
let activeCategory = '';
let categoryCarousel = null;
let toastTimeout;
const cart = new Map();
let orderStatusInterval;
let lastOrderToken = null;
try {
    lastOrderToken = localStorage.getItem(LAST_ORDER_TOKEN_KEY);
} catch {
    showToast('Penyimpanan lokal browser tidak tersedia; status pesanan tidak tersimpan setelah halaman ditutup.');
}

const orderStatusLabels = {
    pending: 'Menunggu konfirmasi admin',
    accepted: 'Pesanan diterima',
    rejected: 'Pesanan ditolak. Silakan hubungi staf outlet.',
    preparing: 'Pesanan sedang disiapkan',
    ready: 'Pesanan siap diambil',
    completed: 'Pesanan selesai'
};

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('visible'), 3600);
}

function setConnection(message, state = '') {
    statusLabel.textContent = message;
    statusLabel.className = `connection ${state}`;
}

function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function renderCategories() {
    const categories = [...new Set(menuItems.map(item => item.category).filter(Boolean))];
    const categoryOrder = [
        'Paket Promo',
        'Paket Catering',
        'Paket Segar',
        'Lainnya',
        'Chicken Produk',
        'Paket Bucket',
        'Ayam Utuh',
        'Paket Rocket',
        'Paket Sehat',
        'Paket Roma',
        'Paket Geprek',
        'Paket Geprek Kosek',
        'Paket Geprek Matah',
        'Paket Geprek Terasi',
        'Paket Hot Cheesy',
        'Minuman'
    ];
    const categoryRanks = new Map(categoryOrder.map((category, index) => [category, index]));
    categories.sort((first, second) => {
        const firstRank = categoryRanks.get(first);
        const secondRank = categoryRanks.get(second);
        if (firstRank !== undefined && secondRank !== undefined) return firstRank - secondRank;
        if (firstRank !== undefined) return -1;
        if (secondRank !== undefined) return 1;
        return first.localeCompare(second, 'id', { sensitivity: 'base' });
    });
    if (!categories.includes(activeCategory)) activeCategory = categories[0] || '';
    categoryCarousel?.destroy();
    categoryCarousel = null;
    categoryList.replaceChildren();
    const selectCategory = category => {
        if (!categories.includes(category)) return;
        const changed = activeCategory !== category;
        activeCategory = category;
        categoryList.querySelectorAll('.category-button').forEach(categoryButton => {
            const isActive = categoryButton.dataset.category === activeCategory;
            categoryButton.classList.toggle('active', isActive);
            categoryButton.setAttribute('aria-pressed', String(isActive));
        });
        if (changed) renderMenu();
    };
    categories.forEach((category, index) => {
        const slide = makeElement('li', 'splide__slide');
        const button = makeElement('button', `category-button${activeCategory === category ? ' active' : ''}`, category);
        button.type = 'button';
        button.dataset.category = category;
        button.setAttribute('aria-pressed', String(activeCategory === category));
        button.addEventListener('click', () => {
            categoryCarousel?.go(index);
            selectCategory(category);
        });
        slide.append(button);
        categoryList.append(slide);
    });
    if (categories.length && window.Splide) {
        categoryCarousel = new window.Splide('#categoryCarousel', {
            type: 'loop',
            autoWidth: true,
            start: categories.indexOf(activeCategory),
            focus: 0,
            trimSpace: false,
            drag: true,
            arrows: false,
            pagination: false,
            gap: '8px',
            padding: '5rem',
            breakpoints: {
                850: { gap: '7px', padding: '40px' },
                620: { gap: '6px', padding: '16px' }
            }
        });
        categoryCarousel.on('moved', index => selectCategory(categories[index]));
        categoryCarousel.mount();
        requestAnimationFrame(() => categoryCarousel?.refresh());
    }
}

function renderMenu() {
    const query = document.getElementById('searchInput').value.trim().toLocaleLowerCase('id-ID');
    const filtered = menuItems.filter(item => {
        const matchesCategory = item.category === activeCategory;
        const searchText = `${item.name || ''} ${item.description || ''} ${item.category || ''} ${item.search_terms || ''}`.toLocaleLowerCase('id-ID');
        return matchesCategory && searchText.includes(query);
    });
    if (['Paket Geprek', 'Chicken Produk'].includes(activeCategory)) {
        const itemRank = item => {
            const name = (item.name || '').toLocaleLowerCase('id-ID');
            const packageNumber = name.match(/\b(?:paket|geprek)\s*(?:no\.?\s*)?([1-3])\b/);
            if (packageNumber) return Number(packageNumber[1]) - 1;
            if (/\bsayap\b/.test(name)) return 3;
            if (/\bpaha\s*bawah\b/.test(name)) return 4;
            if (/\bdada\b|\bpaha\s*atas\b/.test(name)) return 5;
            return 6;
        };
        filtered.sort((first, second) => itemRank(first) - itemRank(second));
    }
    document.getElementById('resultCount').textContent = `${filtered.length} menu`;
    menuGrid.replaceChildren();

    if (!menuItems.length) {
        const empty = makeElement('div', 'empty-state');
        empty.append(makeElement('h3', '', 'Menu sedang disiapkan'));
        empty.append(makeElement('p', '', 'Daftar menu outlet KS Tubun belum tersedia. Coba muat ulang setelah beberapa saat.'));
        menuGrid.append(empty);
        return;
    }
    if (!filtered.length) {
        const empty = makeElement('div', 'empty-state');
        empty.append(makeElement('h3', '', 'Menu tidak ditemukan'));
        empty.append(makeElement('p', '', 'Coba kata pencarian atau kategori yang berbeda.'));
        menuGrid.append(empty);
        return;
    }

    filtered.forEach((item, index) => {
        const card = makeElement('article', 'menu-card');
        card.style.animationDelay = `${Math.min(index * 35, 210)}ms`;
        const photo = makeElement('div', 'menu-photo');
        if (item.image_url) {
            const image = document.createElement('img');
            image.src = item.image_url;
            image.alt = item.name;
            image.loading = 'lazy';
            image.onerror = () => {
                image.remove();
                photo.prepend(makeElement('div', 'photo-fallback', 'Foto menu'));
            };
            photo.append(image);
        } else {
            photo.append(makeElement('div', 'photo-fallback', 'Rocket Chicken'));
        }
        photo.append(makeElement('span', 'availability', 'Tersedia'));
        const content = makeElement('div', 'menu-content');
        content.append(makeElement('div', 'menu-category', item.category || 'Menu'));
        content.append(makeElement('h3', '', item.name));
        content.append(makeElement('p', 'menu-description', item.description || 'Menu Rocket Chicken favoritmu.'));
        const orderRow = makeElement('div', 'menu-order-row');
        orderRow.append(makeElement('div', 'menu-price', rupiah.format(item.price)));
        orderRow.append(createQuantityControl(item));
        content.append(orderRow);
        card.append(photo, content);
        menuGrid.append(card);
    });
}

function createQuantityControl(item) {
    const quantity = cart.get(String(item.id))?.quantity || 0;
    const control = makeElement('div', 'quantity-control');
    control.dataset.itemId = String(item.id);
    const decrease = makeElement('button', '', '−');
    decrease.type = 'button';
    decrease.disabled = quantity === 0;
    decrease.setAttribute('aria-label', `Kurangi ${item.name}`);
    decrease.addEventListener('click', () => changeQuantity(item, -1));
    const value = makeElement('input', 'quantity-value');
    value.type = 'number';
    value.inputMode = 'numeric';
    value.min = '0';
    value.max = '99';
    value.step = '1';
    value.value = String(quantity);
    value.setAttribute('aria-label', `Jumlah ${item.name}`);
    value.addEventListener('change', () => setQuantity(item, Number.parseInt(value.value, 10) || 0));
    const increase = makeElement('button', '', '+');
    increase.type = 'button';
    increase.disabled = quantity >= 99;
    increase.setAttribute('aria-label', `Tambah ${item.name}`);
    increase.addEventListener('click', () => changeQuantity(item, 1));
    control.append(decrease, value, increase);
    return control;
}

function changeQuantity(item, delta) {
    const key = String(item.id);
    const quantity = Math.max(0, (cart.get(key)?.quantity || 0) + delta);
    setQuantity(item, quantity);
}

function setQuantity(item, quantity) {
    const key = String(item.id);
    quantity = Math.min(99, Math.max(0, Math.floor(quantity)));
    if (quantity === 0) cart.delete(key);
    else cart.set(key, { item, quantity });
    document.querySelectorAll('.quantity-control').forEach(control => {
        if (control.dataset.itemId !== key) return;
        control.querySelector('.quantity-value').value = String(quantity);
        control.querySelector('button').disabled = quantity === 0;
        control.querySelectorAll('button')[1].disabled = quantity >= 99;
    });
    updateCartDock();
    if (document.getElementById('checkoutDialog').open) renderCartContents();
}

function getCartTotals() {
    return [...cart.values()].reduce((totals, entry) => ({
        count: totals.count + entry.quantity,
        subtotal: totals.subtotal + entry.quantity * entry.item.price
    }), { count: 0, subtotal: 0 });
}

function updateCartDock() {
    const { count, subtotal } = getCartTotals();
    document.getElementById('cartDock').hidden = count === 0;
    document.body.classList.toggle('cart-active', count > 0);
    document.getElementById('cartCount').textContent = `${count} item`;
    document.getElementById('cartSubtotal').textContent = rupiah.format(subtotal);
}

function renderCartContents() {
    const lines = document.getElementById('cartLines');
    lines.replaceChildren();
    if (cart.size === 0) {
        lines.append(makeElement('p', 'checkout-empty', 'Keranjang masih kosong. Tambahkan menu dari daftar terlebih dahulu.'));
    }
    cart.forEach(({ item, quantity }) => {
        const line = makeElement('div', 'cart-line');
        const main = makeElement('div', 'cart-line-main');
        main.append(makeElement('strong', '', item.name));
        main.append(makeElement('span', '', `${quantity} × ${rupiah.format(item.price)} = ${rupiah.format(quantity * item.price)}`));
        line.append(main, createQuantityControl(item));
        lines.append(line);
    });
    const { subtotal } = getCartTotals();
    document.getElementById('checkoutSubtotal').textContent = rupiah.format(subtotal);
    document.querySelector('#checkoutForm button[type="submit"]').disabled = cart.size === 0;
}

async function placeOrder(event) {
    event.preventDefault();
    if (!supabaseClient) {
        showToast('Layanan pesanan tidak tersedia. Periksa koneksi internet.');
        return;
    }
    if (cart.size === 0) return;

    const checkoutForm = event.currentTarget;
    const form = new FormData(checkoutForm);
    const submitButton = checkoutForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Mengirim pesanan...';
    const customerPhone = String(form.get('customer_phone')).trim();
    const phoneDigits = customerPhone.replace(/\D/g, '');
    if (customerPhone && (phoneDigits.length < 8 || phoneDigits.length > 15)) {
        showToast('Periksa kembali nomor HP pemesan.');
        document.getElementById('customerPhone').focus();
        submitButton.disabled = false;
        submitButton.textContent = 'Kirim pesanan';
        return;
    }

    let result;
    try {
        result = await supabaseClient.rpc('place_order', {
            p_customer_name: String(form.get('customer_name')).trim(),
            p_customer_phone: customerPhone || null,
            p_note: String(form.get('order_note')).trim(),
            p_payment_method: String(form.get('payment_method')),
            p_items: [...cart.values()].map(({ item, quantity }) => ({
                id: String(item.id),
                quantity
            }))
        });
    } catch (error) {
        submitButton.disabled = false;
        submitButton.textContent = 'Kirim pesanan';
        showToast(`Koneksi gagal saat mengirim pesanan: ${error.message}`);
        return;
    }

    submitButton.disabled = false;
    submitButton.textContent = 'Kirim pesanan';
    const { data, error } = result;
    if (error) {
        showToast(`Pesanan gagal dikirim: ${error.message}`);
        return;
    }
    if (!data?.tracking_token || !data?.queue_code) {
        showToast('Pesanan tersimpan, tetapi nomor antrean tidak diterima. Hubungi admin outlet.');
        return;
    }

    lastOrderToken = data.tracking_token;
    try {
        localStorage.setItem(LAST_ORDER_TOKEN_KEY, lastOrderToken);
    } catch {
        showToast('Simpan nomor antrean ini; status tidak dapat dipulihkan setelah halaman ditutup.');
    }
    document.getElementById('trackOrderOpen').classList.remove('hidden');
    cart.clear();
    checkoutForm.reset();
    updateCartDock();
    document.getElementById('checkoutDialog').close();
    document.getElementById('orderQueueCode').textContent = data.queue_code;
    document.getElementById('orderStatusMessage').dataset.status = 'pending';
    document.getElementById('orderStatusMessage').textContent = 'Menunggu konfirmasi admin.';
    document.getElementById('orderPaymentMessage').textContent = 'Memeriksa status pembayaran.';
    document.getElementById('orderStatusDialog').showModal();
    await refreshOrderStatus();
    clearInterval(orderStatusInterval);
    orderStatusInterval = setInterval(refreshOrderStatus, 10000);
}

async function refreshOrderStatus() {
    if (!supabaseClient || !lastOrderToken) return;
    let result;
    try {
        result = await supabaseClient.rpc('get_order_status', {
            p_tracking_token: lastOrderToken
        });
    } catch (error) {
        document.getElementById('orderStatusMessage').dataset.status = 'unknown';
        document.getElementById('orderStatusMessage').textContent =
            `Status belum dapat diperbarui: ${error.message}`;
        return;
    }
    const { data, error } = result;
    if (error) {
        document.getElementById('orderStatusMessage').dataset.status = 'unknown';
        document.getElementById('orderStatusMessage').textContent =
            `Status belum dapat diperbarui: ${error.message}`;
        return;
    }
    if (!data) {
        document.getElementById('orderStatusMessage').dataset.status = 'unknown';
        document.getElementById('orderStatusMessage').textContent =
            'Pesanan tidak ditemukan. Hubungi admin outlet dengan bukti pemesanan.';
        clearInterval(orderStatusInterval);
        return;
    }
    document.getElementById('orderStatusMessage').dataset.status = data.status;
    document.getElementById('orderQueueCode').textContent = data.queue_code;
    document.getElementById('orderStatusMessage').textContent =
        `${orderStatusLabels[data.status] || 'Status pesanan diperbarui'} · Total ${rupiah.format(data.total_amount)}`;
    const paymentMethod = data.payment_method === 'qris' ? 'QRIS' : 'Tunai';
    const paymentStatus = data.payment_status === 'paid' ? 'Sudah dikonfirmasi' : 'Belum dikonfirmasi';
    document.getElementById('orderPaymentMessage').textContent =
        `Pembayaran ${paymentMethod}: ${paymentStatus}.`;
    if (['rejected', 'completed'].includes(data.status)) clearInterval(orderStatusInterval);
}

function normalizeMenuItem(item) {
    if (!item) return null;
    const categorySource = `${item.name || ''} ${item.description || ''} ${item.display_category || ''} ${item.category || ''}`.trim();
    const normalizedCategorySource = categorySource.toLocaleLowerCase('id-ID');
    let category = String(item.display_category || item.category || 'Lainnya').trim() || 'Lainnya';
    if (/geprek/.test(normalizedCategorySource)) {
        if (/kosek|bawang/.test(normalizedCategorySource)) category = 'Paket Geprek Kosek';
        else if (/matah/.test(normalizedCategorySource)) category = 'Paket Geprek Matah';
        else if (/terasi/.test(normalizedCategorySource)) category = 'Paket Geprek Terasi';
    }
    return {
        ...item,
        name: String(item.name || '').trim(),
        description: String(item.description || '').trim(),
        category,
        price: Number(item.price) || 0,
        image_url: safeImageUrl(item.image_url || ''),
        is_available: item.active !== undefined ? Boolean(item.active) : Boolean(item.is_available !== false),
        search_terms: String(item.search_terms || '').trim(),
        sort_order: Number(item.sort_order) || 0,
    };
}

async function loadMenu() {
    if (!supabaseClient) {
        setConnection('Koneksi menu tidak tersedia', 'error');
        menuItems = [];
        renderCategories();
        renderMenu();
        updateCartDock();
        return;
    }
    setConnection('Memuat menu...');
    menuGrid.innerHTML = '<div class="skeleton" aria-label="Memuat menu"></div>';
    const { data, error } = await supabaseClient
        .from(MENU_TABLE)
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true });
    if (error) {
        setConnection('Gagal memuat menu', 'error');
        menuItems = [];
        renderCategories();
        renderMenu();
        updateCartDock();
        showToast(`Menu belum dapat dimuat: ${error.message}`);
        return;
    }
    menuItems = (data || []).map(normalizeMenuItem).filter(Boolean);
    for (const [key, entry] of cart) {
        const refreshedItem = menuItems.find(item => String(item.id) === key);
        if (refreshedItem) cart.set(key, { ...entry, item: refreshedItem });
        else cart.delete(key);
    }
    setConnection('Menu diperbarui langsung', 'online');
    renderCategories();
    renderMenu();
    updateCartDock();
    if (document.getElementById('checkoutDialog').open) renderCartContents();
}

function safeImageUrl(url) {
    if (!url) return '';
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
    } catch {
        return '';
    }
}

document.getElementById('searchInput').addEventListener('input', renderMenu);
document.getElementById('refreshMenu').addEventListener('click', loadMenu);
document.getElementById('checkoutOpen').addEventListener('click', () => {
    renderCartContents();
    document.getElementById('checkoutDialog').showModal();
});
document.getElementById('checkoutClose').addEventListener('click', () => document.getElementById('checkoutDialog').close());
document.getElementById('checkoutForm').addEventListener('submit', placeOrder);
document.getElementById('checkoutDialog').addEventListener('click', event => {
    if (event.target === event.currentTarget) event.currentTarget.close();
});
document.getElementById('trackOrderOpen').addEventListener('click', async () => {
    document.getElementById('orderStatusDialog').showModal();
    await refreshOrderStatus();
    if (!['rejected', 'completed'].includes(document.getElementById('orderStatusMessage').dataset.status)) {
        clearInterval(orderStatusInterval);
        orderStatusInterval = setInterval(refreshOrderStatus, 10000);
    }
});
document.getElementById('orderStatusClose').addEventListener('click', () =>
    document.getElementById('orderStatusDialog').close());
document.getElementById('orderStatusDialog').addEventListener('click', event => {
    if (event.target === event.currentTarget) event.currentTarget.close();
});
document.getElementById('contactButton').addEventListener('click', event => {
    const phone = CONFIG.outletWhatsApp.replace(/\D/g, '');
    if (!phone) {
        event.preventDefault();
        showToast('Nomor WhatsApp outlet belum dikonfigurasi.');
        return;
    }
    event.currentTarget.href = `https://wa.me/${phone}?text=${encodeURIComponent('Halo Rocket Chicken KS Tubun, saya ingin bertanya tentang menu.')}`;
    event.currentTarget.target = '_blank';
    event.currentTarget.rel = 'noopener noreferrer';
});

if (lastOrderToken) document.getElementById('trackOrderOpen').classList.remove('hidden');
loadMenu();
