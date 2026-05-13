/* Impressoras Homologadas - lógica da página */
const API = 'tables/impressoras';
const LOCAL_STORAGE_KEY = 'impressoras_homologadas_cache';

let allPrinters = [];
let currentSearch = '';
let currentStatus = 'all';
let currentSort = 'modelo_asc';
let usingLocalFallback = false;

const elements = {};

document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  setupEvents();
  loadPrinters();
});

function cacheElements() {
  elements.searchInput = document.getElementById('searchInput');
  elements.clearSearch = document.getElementById('clearSearch');
  elements.statusFilters = document.getElementById('statusFilters');
  elements.sortSelect = document.getElementById('sortSelect');
  elements.printersGrid = document.getElementById('printersGrid');
  elements.loadingState = document.getElementById('loadingState');
  elements.emptyState = document.getElementById('emptyState');
  elements.resultsCount = document.getElementById('resultsCount');
  elements.printerForm = document.getElementById('printerForm');
  elements.formTitle = document.getElementById('form-title');
  elements.fieldId = document.getElementById('fieldId');
  elements.fieldMarca = document.getElementById('fieldMarca');
  elements.fieldModelo = document.getElementById('fieldModelo');
  elements.fieldTipo = document.getElementById('fieldTipo');
  elements.fieldConexao = document.getElementById('fieldConexao');
  elements.fieldStatus = document.getElementById('fieldStatus');
  elements.fieldObservacoes = document.getElementById('fieldObservacoes');
  elements.fieldAtivo = document.getElementById('fieldAtivo');
  elements.btnSavePrinter = document.getElementById('btnSavePrinter');
  elements.btnResetForm = document.getElementById('btnResetForm');
  elements.brandSuggestions = document.getElementById('brandSuggestions');
  elements.statTotal = document.getElementById('statTotal');
  elements.statHomologadas = document.getElementById('statHomologadas');
  elements.statMarcas = document.getElementById('statMarcas');
  elements.toast = document.getElementById('toast');
}

function setupEvents() {
  elements.searchInput.addEventListener('input', () => {
    currentSearch = elements.searchInput.value.trim();
    elements.clearSearch.classList.toggle('visible', currentSearch.length > 0);
    renderPrinters();
  });

  elements.clearSearch.addEventListener('click', () => {
    elements.searchInput.value = '';
    currentSearch = '';
    elements.clearSearch.classList.remove('visible');
    renderPrinters();
    elements.searchInput.focus();
  });

  document.getElementById('heroSearchForm').addEventListener('submit', event => {
    event.preventDefault();
    document.getElementById('catalogo-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  elements.statusFilters.addEventListener('click', event => {
    const chip = event.target.closest('.filter-chip');
    if (!chip) return;
    elements.statusFilters.querySelectorAll('.filter-chip').forEach(item => item.classList.remove('active'));
    chip.classList.add('active');
    currentStatus = chip.dataset.status;
    renderPrinters();
  });

  elements.sortSelect.addEventListener('change', () => {
    currentSort = elements.sortSelect.value;
    renderPrinters();
  });

  elements.printerForm.addEventListener('submit', async event => {
    event.preventDefault();
    await savePrinter();
  });

  elements.btnResetForm.addEventListener('click', resetForm);

  elements.printersGrid.addEventListener('click', event => {
    const editButton = event.target.closest('[data-action="edit"]');
    const deleteButton = event.target.closest('[data-action="delete"]');

    if (editButton) {
      fillFormForEdit(editButton.dataset.id);
      return;
    }

    if (deleteButton) {
      deletePrinter(deleteButton.dataset.id);
    }
  });
}

async function loadPrinters() {
  setLoading(true);
  try {
    const response = await fetch(`${API}?limit=500&sort=modelo`);
    if (!response.ok) throw new Error('API indisponível');
    const result = await response.json();
    allPrinters = Array.isArray(result.data) ? result.data : [];
    usingLocalFallback = false;
  } catch (error) {
    usingLocalFallback = true;
    allPrinters = readLocalPrinters();
    if (!allPrinters.length) {
      allPrinters = getInitialExamples();
      persistLocalPrinters();
    }
    console.info('Usando armazenamento local temporário para desenvolvimento.', error);
  } finally {
    setLoading(false);
    renderPrinters();
    renderStats();
    renderBrandSuggestions();
  }
}

async function savePrinter() {
  const payload = getFormPayload();
  if (!payload) return;

  const id = elements.fieldId.value;
  setSaving(true);

  try {
    if (usingLocalFallback) {
      if (id) {
        allPrinters = allPrinters.map(printer => printer.id === id ? { ...printer, ...payload, id, updated_at: Date.now() } : printer);
      } else {
        allPrinters.unshift({ ...payload, id: crypto.randomUUID(), created_at: Date.now(), updated_at: Date.now() });
      }
      persistLocalPrinters();
    } else {
      const response = await fetch(id ? `${API}/${id}` : API, {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Falha ao salvar na API');
      await loadPrinters();
    }

    if (usingLocalFallback) {
      renderPrinters();
      renderStats();
      renderBrandSuggestions();
    }

    showToast(id ? 'Modelo atualizado com sucesso.' : 'Modelo adicionado com sucesso.', 'success');
    resetForm();
  } catch (error) {
    console.error(error);
    showToast('Não foi possível salvar. Tente novamente.', 'error');
  } finally {
    setSaving(false);
  }
}

async function deletePrinter(id) {
  const printer = allPrinters.find(item => item.id === id);
  if (!printer) return;

  const confirmed = window.confirm(`Deseja excluir o modelo ${printer.modelo || ''} da marca ${printer.marca || ''}?`);
  if (!confirmed) return;

  try {
    if (usingLocalFallback) {
      allPrinters = allPrinters.filter(item => item.id !== id);
      persistLocalPrinters();
    } else {
      const response = await fetch(`${API}/${id}`, { method: 'DELETE' });
      if (!response.ok && response.status !== 204) throw new Error('Falha ao excluir na API');
      await loadPrinters();
    }

    if (usingLocalFallback) {
      renderPrinters();
      renderStats();
      renderBrandSuggestions();
    }

    showToast('Modelo excluído com sucesso.', 'success');
    if (elements.fieldId.value === id) resetForm();
  } catch (error) {
    console.error(error);
    showToast('Não foi possível excluir. Tente novamente.', 'error');
  }
}

function getFormPayload() {
  const marca = elements.fieldMarca.value.trim();
  const modelo = elements.fieldModelo.value.trim();

  if (!marca) {
    showToast('Informe a marca da impressora.', 'error');
    elements.fieldMarca.focus();
    return null;
  }

  if (!modelo) {
    showToast('Informe o modelo da impressora.', 'error');
    elements.fieldModelo.focus();
    return null;
  }

  // CAPTURA DOS NOVOS CAMPOS
  return {
    marca,
    modelo,
    tipo: elements.fieldTipo.value,
    conexao: elements.fieldConexao.value,
    status: elements.fieldStatus.value,
    observacoes: elements.fieldObservacoes.value.trim(),
    ativo: elements.fieldAtivo.checked,
    imprimeComandas: document.querySelector('input[name="imprimeComandas"]:checked')?.value || 'Não',
    imprimeNfe: document.querySelector('input[name="imprimeNfe"]:checked')?.value || 'Não',
    imprimeQr: document.querySelector('input[name="imprimeQr"]:checked')?.value || 'Não'
  };
}

function renderPrinters() {
  const filtered = getFilteredPrinters();
  elements.resultsCount.textContent = `${filtered.length} modelo${filtered.length === 1 ? '' : 's'} encontrado${filtered.length === 1 ? '' : 's'}`;

  if (!filtered.length) {
    elements.printersGrid.innerHTML = '';
    elements.emptyState.hidden = false;
    return;
  }

  elements.emptyState.hidden = true;
  elements.printersGrid.innerHTML = filtered.map(createPrinterCard).join('');
}

function createPrinterCard(printer) {
  const statusClass = getStatusClass(printer.status);
  const notes = stripHtml(printer.observacoes || '');
  const visibleLabel = printer.ativo === false ? '<span class="badge"><i class="fa-solid fa-eye-slash"></i> Oculto</span>' : '';

  // LÊ DOS DADOS SALVOS NO OBJETO
  const imprimeComandas = printer.imprimeComandas || 'Não';
  const imprimeNfe = printer.imprimeNfe || 'Não';
  const imprimeQr = printer.imprimeQr || 'Não';

  return `
    <article class="printer-card" data-id="${escapeHtml(printer.id)}">
      <div class="card-top">
        <div class="printer-brand-icon" aria-hidden="true"><i class="fa-solid fa-print"></i></div>
        <div class="card-title-group">
          <p class="brand-name">${escapeHtml(printer.marca || 'Sem marca')}</p>
          <h3>${escapeHtml(printer.modelo || 'Modelo não informado')}</h3>
        </div>
      </div>
      <div class="card-meta">
        <span class="badge badge-status ${statusClass}"><i class="fa-solid fa-certificate"></i> ${escapeHtml(printer.status || 'Homologada')}</span>
        ${printer.tipo ? `<span class="badge"><i class="fa-solid fa-tag"></i> ${escapeHtml(printer.tipo)}</span>` : ''}
        ${printer.conexao ? `<span class="badge"><i class="fa-solid fa-plug"></i> ${escapeHtml(printer.conexao)}</span>` : ''}
        ${visibleLabel}
        
        <span class="badge ${imprimeComandas === 'Sim' ? 'feature-yes' : 'feature-no'}">Cmd: ${imprimeComandas}</span>
        <span class="badge ${imprimeNfe === 'Sim' ? 'feature-yes' : 'feature-no'}">NFe: ${imprimeNfe}</span>
        <span class="badge ${imprimeQr === 'Sim' ? 'feature-yes' : 'feature-no'}">QR: ${imprimeQr}</span>
      </div>
      ${notes ? `<p class="card-notes">${escapeHtml(notes)}</p>` : '<p class="card-notes">Sem observações técnicas cadastradas.</p>'}
      <div class="card-actions">
        <button class="btn-edit-card" type="button" data-action="edit" data-id="${escapeHtml(printer.id)}"><i class="fa-solid fa-pen"></i> Editar</button>
        <button class="btn-delete-card" type="button" data-action="delete" data-id="${escapeHtml(printer.id)}"><i class="fa-solid fa-trash"></i> Excluir</button>
      </div>
    </article>`;
}

function getFilteredPrinters() {
  const query = currentSearch.toLowerCase();
  let list = [...allPrinters];

  if (currentStatus !== 'all') {
    list = list.filter(printer => (printer.status || '') === currentStatus);
  }

  if (query) {
    list = list.filter(printer => [
      printer.marca,
      printer.modelo,
      printer.tipo,
      printer.conexao,
      printer.status,
      stripHtml(printer.observacoes || ''),
    ].some(value => String(value || '').toLowerCase().includes(query)));
  }

  list.sort((a, b) => {
    if (currentSort === 'marca_asc') return compareText(a.marca, b.marca) || compareText(a.modelo, b.modelo);
    if (currentSort === 'status_asc') return compareText(a.status, b.status) || compareText(a.modelo, b.modelo);
    if (currentSort === 'recentes') return (b.created_at || 0) - (a.created_at || 0);
    return compareText(a.modelo, b.modelo) || compareText(a.marca, b.marca);
  });

  return list;
}

function renderStats() {
  const activePrinters = allPrinters.filter(printer => printer.ativo !== false);
  const brands = new Set(activePrinters.map(printer => normalizeText(printer.marca)).filter(Boolean));
  elements.statTotal.textContent = activePrinters.length;
  elements.statHomologadas.textContent = activePrinters.filter(printer => printer.status === 'Homologada').length;
  elements.statMarcas.textContent = brands.size;
}

function renderBrandSuggestions() {
  const brands = [...new Set(allPrinters.map(printer => printer.marca).filter(Boolean))].sort(compareText);
  elements.brandSuggestions.innerHTML = brands.map(brand => `<option value="${escapeHtml(brand)}"></option>`).join('');
}

function fillFormForEdit(id) {
  const printer = allPrinters.find(item => item.id === id);
  if (!printer) return;

  elements.fieldId.value = printer.id;
  elements.fieldMarca.value = printer.marca || '';
  elements.fieldModelo.value = printer.modelo || '';
  elements.fieldTipo.value = printer.tipo || 'Térmica';
  elements.fieldConexao.value = printer.conexao || 'USB';
  elements.fieldStatus.value = printer.status || 'Homologada';
  elements.fieldObservacoes.value = stripHtml(printer.observacoes || '');
  elements.fieldAtivo.checked = printer.ativo !== false;

  // Selecionar os radio buttons corretos baseados nos dados salvos
  const cmdRadio = document.querySelector(`input[name="imprimeComandas"][value="${printer.imprimeComandas || 'Não'}"]`);
  if (cmdRadio) cmdRadio.checked = true;

  const nfeRadio = document.querySelector(`input[name="imprimeNfe"][value="${printer.imprimeNfe || 'Não'}"]`);
  if (nfeRadio) nfeRadio.checked = true;

  const qrRadio = document.querySelector(`input[name="imprimeQr"][value="${printer.imprimeQr || 'Não'}"]`);
  if (qrRadio) qrRadio.checked = true;

  elements.formTitle.textContent = 'Editar impressora';
  elements.btnSavePrinter.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Atualizar modelo';
  document.getElementById('cadastro-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  elements.fieldMarca.focus();
}

function resetForm() {
  elements.printerForm.reset();
  elements.fieldId.value = '';
  elements.fieldTipo.value = 'Térmica';
  elements.fieldConexao.value = 'USB';
  elements.fieldStatus.value = 'Homologada';
  elements.fieldAtivo.checked = true;
  
  // VOLTA PARA O PADRÃO NÃO
  const cmdRadio = document.querySelector('input[name="imprimeComandas"][value="Não"]');
  if (cmdRadio) cmdRadio.checked = true;

  const nfeRadio = document.querySelector('input[name="imprimeNfe"][value="Não"]');
  if (nfeRadio) nfeRadio.checked = true;

  const qrRadio = document.querySelector('input[name="imprimeQr"][value="Não"]');
  if (qrRadio) qrRadio.checked = true;
  
  elements.formTitle.textContent = 'Adicionar impressora';
  elements.btnSavePrinter.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar modelo';
}

function setLoading(isLoading) {
  elements.loadingState.style.display = isLoading ? 'grid' : 'none';
  elements.printersGrid.style.display = isLoading ? 'none' : 'grid';
}

function setSaving(isSaving) {
  elements.btnSavePrinter.disabled = isSaving;
  if (isSaving) elements.btnSavePrinter.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
}

function showToast(message, type = 'info') {
  elements.toast.textContent = message;
  elements.toast.className = `toast visible ${type}`;
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    elements.toast.className = 'toast';
  }, 3200);
}

function readLocalPrinters() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function persistLocalPrinters() {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allPrinters));
}

function getInitialExamples() {
  const now = Date.now();
  return [
    {
      id: crypto.randomUUID(),
      marca: 'Epson',
      modelo: 'TM-T20X',
      tipo: 'Térmica',
      conexao: 'USB/Ethernet',
      status: 'Homologada',
      observacoes: 'Modelo térmico recomendado para pontos de venda com conexão de rede.',
      ativo: true,
      created_at: now - 3000,
    },
    {
      id: crypto.randomUUID(),
      marca: 'Elgin',
      modelo: 'i9 Full',
      tipo: 'Térmica',
      conexao: 'USB',
      status: 'Homologada',
      observacoes: 'Compatível com ambientes Windows e uso em emissão de comprovantes.',
      ativo: true,
      created_at: now - 2000,
    },
    {
      id: crypto.randomUUID(),
      marca: 'Bematech',
      modelo: 'MP-4200 TH',
      tipo: 'Térmica',
      conexao: 'USB',
      status: 'Em análise',
      observacoes: 'Validar versão de firmware antes da implantação.',
      ativo: true,
      created_at: now - 1000,
    },
  ];
}

function getStatusClass(status = '') {
  const normalized = normalizeText(status);
  if (normalized === 'em análise') return 'analysis';
  if (normalized === 'reprovada') return 'rejected';
  if (normalized === 'descontinuada') return 'discontinued';
  return '';
}

function normalizeText(value = '') {
  return String(value).trim();
}

function compareText(a = '', b = '') {
  return String(a || '').localeCompare(String(b || ''), 'pt-BR', { sensitivity: 'base' });
}

function stripHtml(value = '') {
  const temp = document.createElement('div');
  temp.innerHTML = value;
  return temp.textContent || temp.innerText || '';
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
