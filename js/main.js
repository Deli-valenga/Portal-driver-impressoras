/* =============================================
   CENTRAL DE DRIVERS - MAIN.JS
   ============================================= */

const API = 'tables/drivers';

let allDrivers = [];
let currentBrand = 'all';
let currentOS    = 'all';
let currentQuery = '';
let currentSort  = 'nome_asc';

// ── BRAND CONFIG ──────────────────────────────
const BRAND_CONFIG = {
  'Genérica':  { icon: 'fa-microchip',     color: '#6d28d9' },
  'Bematech':  { icon: 'fa-receipt',       color: '#e63946' },
  'Elgin':     { icon: 'fa-bolt',          color: '#f97316' },
  'Epson':     { icon: 'fa-droplet',       color: '#0077b6' },
};

// ── INIT ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadDrivers();
  setupFilters();
  setupSearch();
  setupModal();
  setupSort();
});

// ── LOAD DATA ─────────────────────────────────
async function loadDrivers() {
  showLoading(true);
  try {
    const res  = await fetch(`${API}?limit=500`);
    const data = await res.json();
    allDrivers = (data.data || []).filter(d => d.ativo !== false);
    renderDrivers();
  } catch (err) {
    console.error('Erro ao carregar drivers:', err);
    showEmpty(true);
  } finally {
    showLoading(false);
  }
}

// ── RENDER ────────────────────────────────────
function renderDrivers() {
  const grid = document.getElementById('driversGrid');
  const filtered = getFiltered();

  document.getElementById('resultsCount').innerHTML =
    `<i class="fa-solid fa-circle-info"></i> ${filtered.length} driver${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''}`;

  if (filtered.length === 0) {
    grid.innerHTML = '';
    showEmpty(true);
    return;
  }

  showEmpty(false);
  grid.innerHTML = filtered.map(d => createCardHTML(d)).join('');

  // attach events
  grid.querySelectorAll('.btn-download').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.closest('.driver-card').dataset.id;
      openModal(id);
    });
  });
  grid.querySelectorAll('.btn-info').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.closest('.driver-card').dataset.id;
      openModal(id);
    });
  });
  grid.querySelectorAll('.driver-card').forEach(card => {
    card.addEventListener('click', () => openModal(card.dataset.id));
  });
}

function createCardHTML(d) {
  const cfg   = BRAND_CONFIG[d.marca] || { icon: 'fa-print', color: '#2563eb' };
  const marca = d.marca || 'Genérica';
  const desc  = stripHTML(d.descricao || '');

  return `
    <article class="driver-card" data-id="${d.id}" data-brand="${marca}" role="button" tabindex="0"
             aria-label="Driver ${d.nome}, marca ${marca}">
      <div class="card-header">
        <div class="card-brand-icon" style="background:${cfg.color}18; color:${cfg.color}">
          <i class="fa-solid ${cfg.icon}"></i>
        </div>
        <div class="card-title-wrapper">
          <h3 class="card-title">${escHtml(d.nome)}</h3>
          ${d.modelo ? `<p class="card-modelo"><i class="fa-solid fa-tag fa-xs"></i> ${escHtml(d.modelo)}</p>` : ''}
        </div>
      </div>

      <div class="card-badges">
        <span class="badge badge-brand">${escHtml(marca)}</span>
        ${d.sistema_operacional ? `<span class="badge badge-os"><i class="fa-brands fa-windows fa-xs"></i> ${escHtml(d.sistema_operacional)}</span>` : ''}
        ${d.versao ? `<span class="badge badge-ver"><i class="fa-solid fa-code-branch fa-xs"></i> v${escHtml(d.versao)}</span>` : ''}
      </div>

      ${desc ? `<p class="card-desc">${escHtml(desc)}</p>` : ''}

      <div class="card-footer">
        <button class="btn-download" style="background:${cfg.color}" aria-label="Baixar driver ${d.nome}">
          <i class="fa-solid fa-download"></i> Baixar Driver
        </button>
        <button class="btn-info" aria-label="Mais informações">
          <i class="fa-solid fa-circle-info"></i>
        </button>
      </div>
    </article>`;
}

// ── FILTERS ───────────────────────────────────
function getFiltered() {
  let list = [...allDrivers];

  if (currentBrand !== 'all') list = list.filter(d => d.marca === currentBrand);
  if (currentOS    !== 'all') list = list.filter(d =>
    (d.sistema_operacional || '').toLowerCase().includes(currentOS.toLowerCase())
  );
  if (currentQuery) {
    const q = currentQuery.toLowerCase();
    list = list.filter(d =>
      (d.nome  || '').toLowerCase().includes(q) ||
      (d.marca || '').toLowerCase().includes(q) ||
      (d.modelo|| '').toLowerCase().includes(q) ||
      (d.sistema_operacional || '').toLowerCase().includes(q) ||
      (d.versao || '').toLowerCase().includes(q)
    );
  }

  // sort
  list.sort((a, b) => {
    switch (currentSort) {
      case 'nome_asc':  return (a.nome  || '').localeCompare(b.nome  || '');
      case 'nome_desc': return (b.nome  || '').localeCompare(a.nome  || '');
      case 'marca_asc': return (a.marca || '').localeCompare(b.marca || '');
      case 'newest':    return (b.created_at || 0) - (a.created_at || 0);
      default: return 0;
    }
  });

  return list;
}

function setupFilters() {
  // brand tabs
  document.getElementById('filterTabs').addEventListener('click', e => {
    const tab = e.target.closest('.filter-tab');
    if (!tab) return;
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentBrand = tab.dataset.brand;
    renderDrivers();
  });

  // OS chips
  document.getElementById('osChips').addEventListener('click', e => {
    const chip = e.target.closest('.os-chip');
    if (!chip) return;
    document.querySelectorAll('.os-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentOS = chip.dataset.os;
    renderDrivers();
  });
}

function setupSearch() {
  const input = document.getElementById('searchInput');
  const clear = document.getElementById('clearSearch');

  input.addEventListener('input', () => {
    currentQuery = input.value.trim();
    clear.classList.toggle('visible', currentQuery.length > 0);
    renderDrivers();
  });

  clear.addEventListener('click', () => {
    input.value  = '';
    currentQuery = '';
    clear.classList.remove('visible');
    renderDrivers();
    input.focus();
  });
}

function setupSort() {
  document.getElementById('sortSelect').addEventListener('change', e => {
    currentSort = e.target.value;
    renderDrivers();
  });
}

// ── MODAL ─────────────────────────────────────
function setupModal() {
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('downloadModal').addEventListener('click', e => {
    if (e.target === document.getElementById('downloadModal')) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
}

function openModal(id) {
  const d = allDrivers.find(x => x.id === id);
  if (!d) return;

  const cfg   = BRAND_CONFIG[d.marca] || { icon: 'fa-print', color: '#2563eb' };
  const modal = document.getElementById('downloadModal');

  // icon color
  document.querySelector('.modal-icon').style.cssText =
    `background:${cfg.color}18; color:${cfg.color}`;
  document.querySelector('.modal-icon i').className = `fa-solid ${cfg.icon}`;

  document.getElementById('modalTitle').textContent = d.nome;

  // badges
  const info = document.getElementById('modalInfo');
  info.innerHTML = `
    <span class="badge badge-brand" style="background:${cfg.color}18; color:${cfg.color}">${escHtml(d.marca || 'Genérica')}</span>
    ${d.modelo ? `<span class="badge badge-os"><i class="fa-solid fa-tag fa-xs"></i> ${escHtml(d.modelo)}</span>` : ''}
    ${d.sistema_operacional ? `<span class="badge badge-os"><i class="fa-brands fa-windows fa-xs"></i> ${escHtml(d.sistema_operacional)}</span>` : ''}
    ${d.versao ? `<span class="badge badge-ver"><i class="fa-solid fa-code-branch fa-xs"></i> v${escHtml(d.versao)}</span>` : ''}
  `;

  // description
  const descEl = document.getElementById('modalDesc');
  descEl.innerHTML = d.descricao || '';

  // download button
  const btn = document.getElementById('modalDownloadBtn');
  if (d.link_download) {
    btn.href = formatGDriveLink(d.link_download);
    btn.style.display = 'flex';
  } else {
    btn.style.display = 'none';
  }

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('downloadModal').style.display = 'none';
  document.body.style.overflow = '';
}

// ── HELPERS ───────────────────────────────────
function showLoading(show) {
  document.getElementById('loadingState').style.display = show ? 'block' : 'none';
}

function showEmpty(show) {
  document.getElementById('emptyState').style.display = show ? 'block' : 'none';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripHTML(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

/** Converte links do Google Drive para link de download direto */
function formatGDriveLink(url) {
  if (!url) return '#';
  // Converte link de visualização para download direto
  const matchId = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (matchId) {
    return `https://drive.google.com/uc?export=download&id=${matchId[1]}`;
  }
  return url;
}
