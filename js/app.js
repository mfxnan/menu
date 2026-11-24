const DATA_URL = 'data/menus.json';

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

const menuGrid = document.getElementById('menuGrid');
const categoryList = document.getElementById('categoryList');
const statusLabel = document.getElementById('connectionStatus');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearch');
const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

let menuItems = [];
let categoryOrder = [...DEFAULT_CATEGORY_ORDER];
let activeCategory = '';
let categoryCarousel = null;
let toastTimeout;

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('visible'), 3600);
}

function setConnection(message, state = '') {
    statusLabel.textContent = message;
    statusLabel.className = `connection ${state}`.trim();
}

function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function safeImageUrl(url) {
    if (!url) return '';
    try {
        const parsed = new URL(url, window.location.href);
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
    } catch {
        return '';
    }
}

function safeExternalUrl(url) {
    if (!url) return '';
    try {
        const parsed = new URL(String(url).trim());
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
    } catch {
        return '';
    }
}

function setLinkButton(id, href) {
    const el = document.getElementById(id);
    if (!el) return;
    if (href) {
        el.href = href;
        el.classList.remove('hidden');
    } else {
        el.removeAttribute('href');
        el.classList.add('hidden');
    }
}

function applyOutletInfo(outlet) {
    if (!outlet || typeof outlet !== 'object') return;

    const name = String(outlet.name || 'ROCKET CHICKEN').trim();
    const branch = String(outlet.branch || 'Outlet KS Tubun - Rejasari - Purwokerto').trim();
    document.getElementById('outletName').textContent = name;
    document.getElementById('outletBranch').textContent = branch;
    document.getElementById('footerOutlet').textContent = `${name} · ${branch}`;

    const phone = String(outlet.whatsapp || '').replace(/\D/g, '');
    const waText = String(outlet.whatsapp_message || 'Halo Rocket Chicken KS Tubun, saya ingin bertanya tentang menu dan harga.').trim();
    const waHref = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(waText)}` : '';

    const mapsHref = safeExternalUrl(outlet.maps_url);
    const igHref = safeExternalUrl(outlet.instagram_url);
    const tiktokHref = safeExternalUrl(outlet.tiktok_url);
    const fbHref = safeExternalUrl(outlet.facebook_url);

    setLinkButton('contactWaBtn', waHref);
    setLinkButton('contactMapsBtn', mapsHref);
    setLinkButton('contactIgBtn', igHref);
    setLinkButton('contactTiktokBtn', tiktokHref);
    setLinkButton('contactFbBtn', fbHref);

    setLinkButton('headerMapsBtn', mapsHref);
    setLinkButton('heroMapsBtn', mapsHref);

    const headerWa = document.getElementById('headerWaBtn');
    if (waHref) {
        headerWa.href = waHref;
        headerWa.target = '_blank';
        headerWa.rel = 'noopener noreferrer';
        headerWa.textContent = 'WhatsApp';
    } else {
        headerWa.href = '#kontak';
        headerWa.removeAttribute('target');
        headerWa.removeAttribute('rel');
        headerWa.textContent = 'Hubungi outlet';
    }

    const meta = document.getElementById('outletMeta');
    meta.replaceChildren();
    if (outlet.address) meta.append(makeElement('span', '', `📍 ${String(outlet.address).trim()}`));
    if (outlet.hours) meta.append(makeElement('span', '', `🕒 ${String(outlet.hours).trim()}`));
}

function normalizeMenuItem(item) {
    if (!item) return null;
    const active = item.active !== undefined ? Boolean(item.active) : Boolean(item.is_available !== false);
    if (!active) return null;
    const category = String(item.display_category || item.category || 'Lainnya').trim() || 'Lainnya';
    return {
        id: String(item.id || ''),
        name: String(item.name || '').trim(),
        description: String(item.description || '').trim(),
        category,
        price: Number(item.price) || 0,
        image_url: safeImageUrl(item.image_url || ''),
        search_terms: String(item.search_terms || '').trim(),
        sort_order: Number(item.sort_order) || 100
    };
}

function renderCategories() {
    const categories = [...new Set(menuItems.map(item => item.category).filter(Boolean))];
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
        if (searchInput.value.trim()) {
            searchInput.value = '';
        }
        categoryList.querySelectorAll('.category-button').forEach(categoryButton => {
            const isActive = categoryButton.dataset.category === activeCategory;
            categoryButton.classList.toggle('active', isActive);
            categoryButton.setAttribute('aria-pressed', String(isActive));
        });
        if (changed || !searchInput.value.trim()) renderMenu();
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
            start: Math.max(0, categories.indexOf(activeCategory)),
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
        categoryCarousel.on('moved', index => {
            if (!searchInput.value.trim()) selectCategory(categories[index]);
        });
        categoryCarousel.mount();
        requestAnimationFrame(() => categoryCarousel?.refresh());
    }
}

function sortItemsForDisplay(items, category) {
    const sorted = [...items].sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return a.name.localeCompare(b.name, 'id', { sensitivity: 'base' });
    });

    if (['Paket Geprek', 'Chicken Produk'].includes(category)) {
        const itemRank = item => {
            const name = (item.name || '').toLocaleLowerCase('id-ID');
            const packageNumber = name.match(/\b(?:paket|geprek)\s*(?:no\.?\s*)?([1-3])\b/);
            if (packageNumber) return Number(packageNumber[1]) - 1;
            if (/\bsayap\b/.test(name)) return 3;
            if (/\bpaha\s*bawah\b/.test(name)) return 4;
            if (/\bdada\b|\bpaha\s*atas\b/.test(name)) return 5;
            return 6;
        };
        sorted.sort((first, second) => itemRank(first) - itemRank(second));
    }
    return sorted;
}

function renderMenu() {
    const query = searchInput.value.trim().toLocaleLowerCase('id-ID');
    const isSearching = query.length > 0;
    clearSearchBtn.classList.toggle('hidden', !isSearching);

    let filtered = menuItems.filter(item => {
        if (!isSearching) return item.category === activeCategory;
        const searchText = `${item.name} ${item.description} ${item.category} ${item.search_terms}`.toLocaleLowerCase('id-ID');
        return searchText.includes(query);
    });

    filtered = sortItemsForDisplay(filtered, isSearching ? '' : activeCategory);

    document.getElementById('resultCount').textContent = isSearching
        ? `${filtered.length} menu ditemukan di semua kategori`
        : `${filtered.length} menu · ${activeCategory || 'Semua'}`;

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
        empty.append(makeElement('p', '', 'Coba kata pencarian lain atau hapus filter pencarian untuk melihat semua kategori.'));
        menuGrid.append(empty);
        return;
    }

    filtered.forEach((item, index) => {
        const card = makeElement('article', 'menu-card');
        card.style.animationDelay = `${Math.min(index * 30, 180)}ms`;

        const photo = makeElement('div', 'menu-photo');
        if (item.image_url) {
            const image = document.createElement('img');
            image.src = item.image_url;
            image.alt = item.name;
            image.loading = 'lazy';
            image.decoding = 'async';
            image.onerror = () => {
                image.remove();
                photo.prepend(makeElement('div', 'photo-fallback', 'Foto menu'));
            };
            photo.append(image);
        } else {
            photo.append(makeElement('div', 'photo-fallback', 'Rocket Chicken'));
        }

        const content = makeElement('div', 'menu-content');
        content.append(makeElement('div', 'menu-category', item.category || 'Menu'));
        content.append(makeElement('h3', '', item.name));
        content.append(makeElement('p', 'menu-description', item.description || 'Menu Rocket Chicken favoritmu.'));

        const priceRow = makeElement('div', 'menu-price-row');
        priceRow.append(makeElement('div', 'menu-price', rupiah.format(item.price)));
        content.append(priceRow);

        card.append(photo, content);
        menuGrid.append(card);
    });
}

function formatUpdatedDate(isoString) {
    if (!isoString) return 'Daftar harga aktif';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return 'Daftar harga aktif';
    return `Diperbarui ${date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

async function loadMenu() {
    setConnection('Memuat daftar menu...');
    menuGrid.innerHTML = '<div class="skeleton" aria-label="Memuat menu"></div>';

    let payload;
    try {
        const response = await fetch(DATA_URL, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        payload = await response.json();
    } catch (error) {
        setConnection('Gagal memuat daftar menu', 'error');
        menuItems = [];
        renderCategories();
        renderMenu();
        showToast(`Daftar menu belum dapat dimuat: ${error.message}`);
        return;
    }

    const rawList = Array.isArray(payload) ? payload : (Array.isArray(payload?.menus) ? payload.menus : []);
    if (!Array.isArray(payload)) {
        if (Array.isArray(payload?.category_order) && payload.category_order.length) {
            categoryOrder = payload.category_order.map(c => String(c).trim()).filter(Boolean);
        }
        applyOutletInfo(payload?.outlet);
        setConnection(formatUpdatedDate(payload?.updated_at), 'online');
    } else {
        setConnection('Daftar harga aktif', 'online');
    }

    menuItems = rawList.map(normalizeMenuItem).filter(Boolean);
    renderCategories();
    renderMenu();
}

searchInput.addEventListener('input', renderMenu);
clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchInput.focus();
    renderMenu();
});
document.getElementById('refreshMenu').addEventListener('click', loadMenu);

loadMenu();
