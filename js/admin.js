/* =============================================
   CENTRAL DE DRIVERS - ADMIN.JS
   ============================================= */

const API = 'tables/drivers';
let allDrivers = [];
let deleteTargetId = null;
let adminFilter = '';

// ── INIT ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadDrivers();
  setupAdminSearch();
  setupForm();
  setupDeleteModal();

  document.getElementById('btnAddDriver').addEventListener('click', () => openForm());

  // toggle label
  document.getElementById('fieldAtivo').addEventListener('change', e => {
    document.getElementById('toggleLabel').textContent =
      e.target.checked ? 'Ativo (visível no site)' : 'Inativo (oculto no site)';
  });
});

// ── LOAD ──────────────────────────────────────
async function loadDrivers() {
  try {
    const res  = await fetch(`${API}?limit=500&sort=nome`);
    const data = await res.json();
    allDrivers = data.data || [];
    renderTable();
    renderStats();
  } catch (err) {
    console.error('Erro ao carregar:', err);
    showToast('Erro ao carregar drivers.', 'error');
    document.getElementById('tableContainer').innerHTML =
      `<div class="table-empty"><i class="fa-solid fa-triangle-exclamation"></i><p>Erro ao carregar dados.</p></div>`;
  }
}

// ── STATS ─────────────────────────────────────
function renderStats() {
  const active = allDrivers.filter(d => d.ativo !== false);
  document.getElementById('statTotal').textContent    = active.length;
  document.getElementById('statGenerica').textContent = active.filter(d => d.marca === 'Genérica').length;
  document.getElementById('statBematech').textContent = active.filter(d => d.marca === 'Bematech').length;
  document.getElementById('statElgin').textContent    = active.filter(d => d.marca === 'Elgin').length;
  document.getElementById('statEpson').textContent    = active.filter(d => d.marca === 'Epson').length;
}

// ── TABLE ─────────────────────────────────────
function renderTable() {
  const q = adminFilter.toLowerCase();
  const list = allDrivers.filter(d =>
    !q ||
    (d.nome  || '').toLowerCase().includes(q) ||
    (d.marca || '').toLowerCase().includes(q) ||
    (d.modelo|| '').toLowerCase().includes(q) ||
    (d.sistema_operacional || '').toLowerCase().includes(q)
  );

  if (list.length === 0) {
    document.getElementById('tableContainer').innerHTML = `
      <div class="table-empty">
        <i class="fa-solid fa-folder-open"></i>
        <p>${adminFilter ? 'Nenhum resultado para "' + escHtml(adminFilter) + '".' : 'Nenhum driver cadastrado ainda. Clique em "Adicionar Driver" para começar!'}</p>
      </div>`;
    return;
  }

  const rows = list.map(d => {
    const ativo = d.ativo !== false;
    const gdLink = d.link_download
      ? `<a href="${escHtml(d.link_download)}" target="_blank" rel="noopener" class="link-cell" title="${escHtml(d.link_download)}">
           <i class="fa-brands fa-google-drive"></i> Ver link
         </a>`
      : '<span style="color:#94a3b8">—</span>';

    return `
      <tr>
        <td><strong>${escHtml(d.nome || '')}</strong></td>
        <td><span class="badge badge-brand brand-${(d.marca||'').toLowerCase()}">${escHtml(d.marca || '—')}</span></td>
        <td>${escHtml(d.modelo || '—')}</td>
        <td>${escHtml(d.sistema_operacional || '—')}</td>
        <td>${escHtml(d.versao || '—')}</td>
        <td>${gdLink}</td>
        <td><span class="status-dot ${ativo ? 'active' : ''}">${ativo ? 'Ativo' : 'Inativo'}</span></td>
        <td>
          <div class="td-actions">
            <button class="btn-edit" onclick="openForm('${d.id}')"><i class="fa-solid fa-pen"></i> Editar</button>
            <button class="btn-danger" onclick="confirmDelete('${d.id}', '${escHtml(d.nome || '')}')"><i class="fa-solid fa-trash"></i> Excluir</button>
          </div>
        </td>
      </tr>`;
  }).join('');

  document.getElementById('tableContainer').innerHTML = `
    <div style="overflow-x:auto;">
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Marca</th>
            <th>Modelo</th>
            <th>Sistema Oper.</th>
            <th>Versão</th>
            <th>Link Drive</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function setupAdminSearch() {
  document.getElementById('adminSearch').addEventListener('input', e => {
    adminFilter = e.target.value.trim();
    renderTable();
  });
}

// ── FORM ──────────────────────────────────────
function openForm(id = null) {
  const overlay = document.getElementById('formOverlay');
  const form    = document.getElementById('driverForm');
  form.reset();
  document.getElementById('fieldId').value = '';
  document.getElementById('fieldAtivo').checked = true;
  document.getElementById('toggleLabel').textContent = 'Ativo (visível no site)';

  if (id) {
    const d = allDrivers.find(x => x.id === id);
    if (!d) return;
    document.getElementById('formTitle').innerHTML = '<i class="fa-solid fa-pen"></i> Editar Driver';
    document.getElementById('fieldId').value     = d.id;
    document.getElementById('fieldNome').value   = d.nome || '';
    document.getElementById('fieldMarca').value  = d.marca || '';
    document.getElementById('fieldModelo').value = d.modelo || '';
    document.getElementById('fieldSO').value     = d.sistema_operacional || '';
    document.getElementById('fieldVersao').value = d.versao || '';
    document.getElementById('fieldLink').value   = d.link_download || '';
    document.getElementById('fieldDesc').value   = stripHTML(d.descricao || '');
    document.getElementById('fieldAtivo').checked = d.ativo !== false;
    document.getElementById('toggleLabel').textContent =
      d.ativo !== false ? 'Ativo (visível no site)' : 'Inativo (oculto no site)';
  } else {
    document.getElementById('formTitle').innerHTML = '<i class="fa-solid fa-plus"></i> Adicionar Driver';
  }

  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('fieldNome').focus(), 100);
}

function closeForm() {
  document.getElementById('formOverlay').style.display = 'none';
  document.body.style.overflow = '';
}

function setupForm() {
  document.getElementById('btnCancelForm').addEventListener('click', closeForm);
  document.getElementById('formOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('formOverlay')) closeForm();
  });

  document.getElementById('driverForm').addEventListener('submit', async e => {
    e.preventDefault();
    await saveDriver();
  });
}

async function saveDriver() {
  const id    = document.getElementById('fieldId').value;
  const nome  = document.getElementById('fieldNome').value.trim();
  const marca = document.getElementById('fieldMarca').value;
  const link  = document.getElementById('fieldLink').value.trim();

  if (!nome)  { showToast('O nome do driver é obrigatório.', 'error'); return; }
  if (!marca) { showToast('Selecione a marca.', 'error'); return; }
  if (!link)  { showToast('O link do Google Drive é obrigatório.', 'error'); return; }

  const payload = {
    nome,
    marca,
    modelo:              document.getElementById('fieldModelo').value.trim(),
    sistema_operacional: document.getElementById('fieldSO').value,
    versao:              document.getElementById('fieldVersao').value.trim(),
    link_download:       link,
    descricao:           document.getElementById('fieldDesc').value.trim(),
    ativo:               document.getElementById('fieldAtivo').checked,
  };

  const btn = document.getElementById('btnSaveForm');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

  try {
    let res;
    if (id) {
      res = await fetch(`${API}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    if (!res.ok) throw new Error('Erro na API');

    showToast(id ? 'Driver atualizado com sucesso!' : 'Driver adicionado com sucesso!', 'success');
    closeForm();
    await loadDrivers();
  } catch (err) {
    console.error(err);
    showToast('Erro ao salvar. Tente novamente.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar Driver';
  }
}

// ── DELETE ────────────────────────────────────
function confirmDelete(id, name) {
  deleteTargetId = id;
  document.getElementById('deleteDriverName').textContent = name;
  document.getElementById('confirmOverlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function setupDeleteModal() {
  document.getElementById('btnCancelDelete').addEventListener('click', () => {
    document.getElementById('confirmOverlay').style.display = 'none';
    document.body.style.overflow = '';
    deleteTargetId = null;
  });

  document.getElementById('btnConfirmDelete').addEventListener('click', async () => {
    if (!deleteTargetId) return;
    const btn = document.getElementById('btnConfirmDelete');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Excluindo...';

    try {
      const res = await fetch(`${API}/${deleteTargetId}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('Erro ao excluir');
      showToast('Driver excluído com sucesso.', 'success');
      document.getElementById('confirmOverlay').style.display = 'none';
      document.body.style.overflow = '';
      deleteTargetId = null;
      await loadDrivers();
    } catch (err) {
      console.error(err);
      showToast('Erro ao excluir. Tente novamente.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-trash"></i> Sim, excluir';
    }
  });
}

// ── TOAST ─────────────────────────────────────
function showToast(msg, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="fa-solid ${icon}"></i> ${msg}`;
  document.body.appendChild(t);

  setTimeout(() => {
    t.classList.add('hide');
    setTimeout(() => t.remove(), 350);
  }, 3500);
}

// ── HELPERS ───────────────────────────────────
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
