(() => {
    const DATA_URL = 'data/menus.json';
    const DRAFT_STORAGE_KEY = 'rc-ks-tubun-menus-draft-v1';

    const DEFAULT_CATEGORY_ORDER = [
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

    const DEFAULT_OUTLET = {
        name: 'ROCKET CHICKEN',
        branch: 'Outlet KS Tubun - Rejasari - Purwokerto',
        address: 'Jl. KS Tubun, Rejasari, Purwokerto Barat, Banyumas',
        hours: 'Buka setiap hari',
        whatsapp: '6285725489277',
        whatsapp_message: 'Halo Rocket Chicken KS Tubun, saya ingin bertanya tentang menu dan harga.',
        maps_url: '',
        instagram_url: '',
        tiktok_url: '',
        facebook_url: ''
    };

    const $ = id => document.getElementById(id);
    const fmt = n => 'Rp' + Number(n || 0).toLocaleString('id-ID');
    const msg = (id, text) => {
        const el = $(id);
        if (!el) return;
        el.textContent = text;
        el.classList.remove('hidden');
    };

    let state = {
        updated_at: new Date().toISOString(),
        outlet: { ...DEFAULT_OUTLET },
        category_order: [...DEFAULT_CATEGORY_ORDER],
        menus: []
    };
    let dirtyCount = 0;

    function generateId() {
        if (window.crypto?.randomUUID) return window.crypto.randomUUID();
        return `menu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function normalizeItem(raw) {
        return {
            id: String(raw?.id || generateId()),
            name: String(raw?.name || '').trim(),
            category: String(raw?.display_category || raw?.category || 'Lainnya').trim() || 'Lainnya',
            description: String(raw?.description || '').trim(),
            price: Number.isFinite(Number(raw?.price)) ? Math.max(0, Math.round(Number(raw.price))) : 0,
            image_url: String(raw?.image_url || '').trim(),
            search_terms: String(raw?.search_terms || '').trim(),
            active: raw?.active !== undefined ? Boolean(raw.active) : true,
            sort_order: Number.isFinite(Number(raw?.sort_order)) ? Number(raw.sort_order) : 100,
            updated_at: raw?.updated_at || new Date().toISOString()
        };
    }

    function normalizeDataset(payload) {
        if (Array.isArray(payload)) {
            return {
                updated_at: new Date().toISOString(),
                outlet: { ...state.outlet },
                category_order: [...state.category_order],
                menus: payload.map(normalizeItem).filter(x => x.name)
            };
        }
        return {
            updated_at: payload?.updated_at || new Date().toISOString(),
            outlet: { ...DEFAULT_OUTLET, ...(payload?.outlet || {}) },
            category_order: Array.isArray(payload?.category_order) && payload.category_order.length
                ? payload.category_order.map(c => String(c).trim()).filter(Boolean)
                : [...DEFAULT_CATEGORY_ORDER],
            menus: Array.isArray(payload?.menus)
                ? payload.menus.map(normalizeItem).filter(x => x.name)
                : []
        };
    }

    function updateDraftBadge() {
        const badge = $('draftBadge');
        if (dirtyCount > 0) {
            badge.textContent = `${dirtyCount} perubahan belum diunduh`;
            badge.classList.add('dirty');
        } else {
            badge.textContent = 'Data sesuai situs';
            badge.classList.remove('dirty');
        }
    }

    function persistDraft(markDirty = true) {
        state.updated_at = new Date().toISOString();
        if (markDirty) dirtyCount += 1;
        updateDraftBadge();
        try {
            localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ state, dirtyCount }));
        } catch {
            // Ignore quota errors in private mode
        }
    }

    function clearStoredDraft() {
        dirtyCount = 0;
        updateDraftBadge();
        try {
            localStorage.removeItem(DRAFT_STORAGE_KEY);
        } catch {
            // Ignore
        }
    }

    function fillOutletForm() {
        const o = state.outlet;
        $('outletName').value = o.name || '';
        $('outletBranch').value = o.branch || '';
        $('outletAddress').value = o.address || '';
        $('outletHours').value = o.hours || '';
        $('outletWhatsapp').value = o.whatsapp || '';
        $('outletWaMessage').value = o.whatsapp_message || '';
        $('outletMaps').value = o.maps_url || '';
        $('outletInstagram').value = o.instagram_url || '';
        $('outletTiktok').value = o.tiktok_url || '';
        $('outletFacebook').value = o.facebook_url || '';
    }

    function getAllCategories() {
        const set = new Set([...state.category_order, ...state.menus.map(m => m.category).filter(Boolean)]);
        return [...set];
    }

    function refreshCategoryControls() {
        const categories = getAllCategories();
        const datalist = $('categorySuggestions');
        datalist.replaceChildren();
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            datalist.append(opt);
        });

        const select = $('categoryFilter');
        const current = select.value;
        select.replaceChildren();
        const allOpt = document.createElement('option');
        allOpt.value = '';
        allOpt.textContent = 'Semua kategori';
        select.append(allOpt);
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            select.append(opt);
        });
        if (categories.includes(current)) select.value = current;
    }

    function safePreviewUrl(url) {
        if (!url) return '';
        try {
            const parsed = new URL(url, window.location.href);
            return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
        } catch {
            return '';
        }
    }

    function updateImagePreview() {
        const box = $('imagePreviewBox');
        box.replaceChildren();
        const url = safePreviewUrl($('imageUrl').value.trim());
        if (!url) {
            const span = document.createElement('span');
            span.className = 'muted';
            span.textContent = 'Pratinjau gambar';
            box.append(span);
            return;
        }
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Pratinjau foto menu';
        img.onerror = () => {
            box.replaceChildren();
            const span = document.createElement('span');
            span.className = 'muted';
            span.textContent = 'Gambar tidak ditemukan';
            box.append(span);
        };
        box.append(img);
    }

    function renderList() {
        const q = $('filter').value.toLocaleLowerCase('id-ID').trim();
        const catFilter = $('categoryFilter').value;
        const statusFilter = $('statusFilter').value;

        const filtered = state.menus.filter(item => {
            if (catFilter && item.category !== catFilter) return false;
            if (statusFilter === 'active' && !item.active) return false;
            if (statusFilter === 'inactive' && item.active) return false;
            if (!q) return true;
            const text = `${item.name} ${item.category} ${item.description} ${item.search_terms}`.toLocaleLowerCase('id-ID');
            return text.includes(q);
        }).sort((a, b) => {
            if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
            return a.name.localeCompare(b.name, 'id', { sensitivity: 'base' });
        });

        const activeCount = state.menus.filter(m => m.active).length;
        msg('listStatus', `Menampilkan ${filtered.length} dari ${state.menus.length} menu (${activeCount} aktif, ${state.menus.length - activeCount} nonaktif).`);

        const rows = $('rows');
        rows.replaceChildren();

        if (!filtered.length) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 5;
            td.className = 'muted';
            td.textContent = 'Tidak ada menu yang cocok dengan filter.';
            tr.append(td);
            rows.append(tr);
            return;
        }

        filtered.forEach(item => {
            const tr = document.createElement('tr');

            const tdMenu = document.createElement('td');
            const wrap = document.createElement('div');
            wrap.className = 'menu-cell';
            const previewUrl = safePreviewUrl(item.image_url);
            if (previewUrl) {
                const img = document.createElement('img');
                img.className = 'menu-thumb';
                img.src = previewUrl;
                img.alt = '';
                img.loading = 'lazy';
                img.onerror = () => img.replaceWith(makeEmptyThumb());
                wrap.append(img);
            } else {
                wrap.append(makeEmptyThumb());
            }
            const textWrap = document.createElement('div');
            const title = document.createElement('span');
            title.className = 'menu-title';
            title.textContent = item.name;
            const desc = document.createElement('span');
            desc.className = 'menu-desc';
            desc.textContent = item.description || '—';
            textWrap.append(title, desc);
            wrap.append(textWrap);
            tdMenu.append(wrap);

            const tdCat = document.createElement('td');
            tdCat.textContent = item.category;

            const tdPrice = document.createElement('td');
            const priceWrap = document.createElement('div');
            priceWrap.className = 'price-inline-wrap';
            const priceInput = document.createElement('input');
            priceInput.type = 'number';
            priceInput.min = '0';
            priceInput.step = '500';
            priceInput.className = 'price-inline';
            priceInput.value = String(item.price);
            priceInput.setAttribute('aria-label', `Harga ${item.name}`);
            priceInput.addEventListener('change', () => {
                const nextPrice = Number(priceInput.value);
                if (priceInput.value === '' || !Number.isSafeInteger(nextPrice) || nextPrice < 0) {
                    priceInput.value = String(item.price);
                    msg('syncStatus', `Harga untuk "${item.name}" harus bilangan bulat 0 atau lebih.`);
                    return;
                }
                if (nextPrice !== item.price) {
                    item.price = nextPrice;
                    item.updated_at = new Date().toISOString();
                    persistDraft(true);
                    msg('syncStatus', `Harga "${item.name}" diubah menjadi ${fmt(nextPrice)}. Jangan lupa klik Unduh menus.json setelah selesai.`);
                }
            });
            priceWrap.append(priceInput);
            tdPrice.append(priceWrap);

            const tdStatus = document.createElement('td');
            const pill = document.createElement('span');
            pill.className = `pill ${item.active ? 'active' : 'inactive'}`;
            pill.textContent = item.active ? 'Aktif' : 'Nonaktif';
            tdStatus.append(pill);

            const tdAct = document.createElement('td');
            const actWrap = document.createElement('div');
            actWrap.className = 'row-actions';

            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'small';
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', () => editItem(item));

            const toggleBtn = document.createElement('button');
            toggleBtn.type = 'button';
            toggleBtn.className = 'small secondary';
            toggleBtn.textContent = item.active ? 'Nonaktifkan' : 'Aktifkan';
            toggleBtn.addEventListener('click', () => toggleActive(item));

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'small danger';
            delBtn.textContent = 'Hapus';
            delBtn.addEventListener('click', () => deleteItem(item));

            actWrap.append(editBtn, toggleBtn, delBtn);
            tdAct.append(actWrap);

            tr.append(tdMenu, tdCat, tdPrice, tdStatus, tdAct);
            rows.append(tr);
        });
    }

    function makeEmptyThumb() {
        const div = document.createElement('div');
        div.className = 'menu-thumb-empty';
        div.textContent = 'No img';
        return div;
    }

    function editItem(item) {
        $('itemId').value = item.id;
        $('name').value = item.name;
        $('category').value = item.category;
        $('price').value = String(item.price);
        $('sortOrder').value = String(item.sort_order ?? 100);
        $('itemActive').checked = Boolean(item.active);
        $('description').value = item.description || '';
        $('imageUrl').value = item.image_url || '';
        $('searchTerms').value = item.search_terms || '';
        $('saveBtn').textContent = 'Simpan perubahan menu';
        updateImagePreview();
        msg('saveStatus', `Sedang mengedit "${item.name}".`);
        $('editorPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function clearForm() {
        $('itemId').value = '';
        $('name').value = '';
        $('category').value = '';
        $('price').value = '';
        $('sortOrder').value = '100';
        $('itemActive').checked = true;
        $('description').value = '';
        $('imageUrl').value = '';
        $('searchTerms').value = '';
        $('saveBtn').textContent = 'Tambah menu ke draft';
        updateImagePreview();
        msg('saveStatus', 'Form dikosongkan.');
    }

    function saveItem() {
        const name = $('name').value.trim();
        const category = $('category').value.trim() || 'Lainnya';
        const price = Number($('price').value);
        const sortOrder = Number($('sortOrder').value);
        const imageUrl = $('imageUrl').value.trim();

        if (!name || $('price').value === '' || !Number.isSafeInteger(price) || price < 0) {
            msg('saveStatus', 'Nama menu wajib diisi dan harga harus bilangan bulat 0 atau lebih.');
            return;
        }
        if (imageUrl && !safePreviewUrl(imageUrl)) {
            msg('saveStatus', 'Path/URL gambar tidak valid. Gunakan path relatif (contoh: img/bucket1.webp) atau URL HTTP/HTTPS.');
            return;
        }

        const id = $('itemId').value;
        const now = new Date().toISOString();
        const payload = {
            id: id || generateId(),
            name,
            category,
            description: $('description').value.trim(),
            price,
            image_url: imageUrl,
            search_terms: $('searchTerms').value.trim(),
            active: $('itemActive').checked,
            sort_order: Number.isFinite(sortOrder) ? Math.max(0, Math.round(sortOrder)) : 100,
            updated_at: now
        };

        if (!state.category_order.includes(category)) {
            state.category_order.push(category);
        }

        const existingIndex = id ? state.menus.findIndex(m => m.id === id) : -1;
        if (existingIndex >= 0) {
            state.menus[existingIndex] = payload;
            msg('saveStatus', `Diperbarui di draft: ${payload.name} — ${fmt(payload.price)}.`);
        } else {
            state.menus.unshift(payload);
            msg('saveStatus', `Ditambahkan ke draft: ${payload.name} — ${fmt(payload.price)}.`);
        }

        persistDraft(true);
        refreshCategoryControls();
        renderList();
        clearForm();
        msg('syncStatus', `Perubahan "${payload.name}" masuk draft. Klik Unduh menus.json jika sudah selesai.`);
    }

    function toggleActive(item) {
        item.active = !item.active;
        item.updated_at = new Date().toISOString();
        persistDraft(true);
        renderList();
        msg('syncStatus', `"${item.name}" sekarang ${item.active ? 'Aktif' : 'Nonaktif'} di draft.`);
    }

    function deleteItem(item) {
        if (!confirm(`Hapus permanen menu "${item.name}" dari daftar?`)) return;
        state.menus = state.menus.filter(m => m.id !== item.id);
        if ($('itemId').value === item.id) clearForm();
        persistDraft(true);
        refreshCategoryControls();
        renderList();
        msg('syncStatus', `"${item.name}" dihapus dari draft.`);
    }

    function saveOutlet() {
        const validateUrl = (val, label) => {
            if (!val) return '';
            try {
                const parsed = new URL(val);
                if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
                return parsed.href;
            } catch {
                throw new Error(`${label} harus berupa URL lengkap diawali https://`);
            }
        };

        try {
            state.outlet = {
                name: $('outletName').value.trim() || 'ROCKET CHICKEN',
                branch: $('outletBranch').value.trim(),
                address: $('outletAddress').value.trim(),
                hours: $('outletHours').value.trim(),
                whatsapp: $('outletWhatsapp').value.replace(/\D/g, ''),
                whatsapp_message: $('outletWaMessage').value.trim(),
                maps_url: validateUrl($('outletMaps').value.trim(), 'Link Google Maps'),
                instagram_url: validateUrl($('outletInstagram').value.trim(), 'Link Instagram'),
                tiktok_url: validateUrl($('outletTiktok').value.trim(), 'Link TikTok'),
                facebook_url: validateUrl($('outletFacebook').value.trim(), 'Link Facebook')
            };
        } catch (error) {
            msg('outletStatus', error.message);
            return;
        }

        persistDraft(true);
        msg('outletStatus', 'Info outlet & link tombol kontak diterapkan ke draft. Klik Unduh menus.json untuk menerbitkan.');
        msg('syncStatus', 'Info outlet diperbarui di draft. Klik Unduh menus.json untuk menyimpan file.');
    }

    function downloadJson() {
        state.updated_at = new Date().toISOString();
        const blob = new Blob([JSON.stringify(state, null, 2) + '\n'], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'menus.json';
        a.click();
        URL.revokeObjectURL(a.href);
        dirtyCount = 0;
        updateDraftBadge();
        try {
            localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ state, dirtyCount: 0 }));
        } catch {
            // Ignore
        }
        msg('syncStatus', 'File menus.json berhasil diunduh! Unggah ke folder data/menus.json di GitHub untuk menerbitkan perubahan.');
    }

    function handleImport(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(String(reader.result));
                state = normalizeDataset(parsed);
                persistDraft(true);
                fillOutletForm();
                refreshCategoryControls();
                renderList();
                msg('syncStatus', `Berhasil mengimpor ${state.menus.length} menu dari "${file.name}".`);
            } catch (error) {
                msg('syncStatus', `File JSON tidak valid: ${error.message}`);
            }
            event.target.value = '';
        };
        reader.readAsText(file);
    }

    async function loadFromSite(force = false) {
        if (!force) {
            try {
                const saved = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || 'null');
                if (saved?.state?.menus?.length && saved.dirtyCount > 0) {
                    state = normalizeDataset(saved.state);
                    dirtyCount = saved.dirtyCount;
                    fillOutletForm();
                    refreshCategoryControls();
                    renderList();
                    updateDraftBadge();
                    msg('syncStatus', `Memulihkan draft lokal (${dirtyCount} perubahan belum diunduh). Klik "Reset ke data situs" untuk membuang draft.`);
                    return;
                }
            } catch {
                // Ignore corrupted draft
            }
        }

        msg('syncStatus', 'Memuat data terbaru dari data/menus.json...');
        try {
            const res = await fetch(DATA_URL, { cache: 'no-cache' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            state = normalizeDataset(data);
            clearStoredDraft();
            fillOutletForm();
            refreshCategoryControls();
            renderList();
            msg('syncStatus', `Berhasil memuat ${state.menus.length} menu dari data/menus.json.`);
        } catch (error) {
            msg('syncStatus', `Gagal membaca data/menus.json (${error.message}). Kamu tetap bisa memakai tombol "Impor JSON" untuk membuka file lokal.`);
            fillOutletForm();
            refreshCategoryControls();
            renderList();
        }
    }

    $('saveBtn').addEventListener('click', saveItem);
    $('clearBtn').addEventListener('click', clearForm);
    $('saveOutletBtn').addEventListener('click', saveOutlet);
    $('downloadBtn').addEventListener('click', downloadJson);
    $('importFile').addEventListener('change', handleImport);
    $('reloadLiveBtn').addEventListener('click', () => {
        if (dirtyCount > 0 && !confirm('Buang semua perubahan draft yang belum diunduh dan muat ulang data dari situs?')) return;
        loadFromSite(true);
    });
    $('filter').addEventListener('input', renderList);
    $('categoryFilter').addEventListener('change', renderList);
    $('statusFilter').addEventListener('change', renderList);
    $('imageUrl').addEventListener('input', updateImagePreview);

    window.addEventListener('beforeunload', event => {
        if (dirtyCount > 0) {
            event.preventDefault();
            event.returnValue = '';
        }
    });

    loadFromSite(false);
})();
