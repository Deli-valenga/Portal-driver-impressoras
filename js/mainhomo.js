/* Impressoras Homologadas - lógica da página */
const SUPABASE_URL = 'https://kvlzaigjcbjfhfbmsmfw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2bHphaWdqY2JqZmhmYm1zbWZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0Njc4MTAsImV4cCI6MjA5NDA0MzgxMH0.FyfXGEzd2vSpRJ7F8-zm-5IxSgzA_8q4gB52__vKZ4c';
const API_ENDPOINT = `${SUPABASE_URL}/rest/v1/impressoras`;
const LOCAL_STORAGE_KEY = 'impressoras_fallback';

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
  
  // Elementos do Formulário
  elements.cadastroSection = document.getElementById('cadastro-section');
  elements.btnToggleForm = document.getElementById('btnToggleForm');
  elements.btnCloseForm = document.getElementById('btnCloseForm');
  
  elements.printerForm = document.getElementById('printerForm');
  elements.formTitle = document.getElementById('form-title');
  elements.fieldId = document.getElementById('fieldId');
  elements.fieldMarca = document.getElementById('fieldMarca');
  elements.fieldModelo = document.getElementById('fieldModelo');
  elements.fieldTipo = document.getElementById('fieldTipo');
  elements.fieldConexao = document.getElementById('fieldConexao');
  elements.fieldStatus = document.getElementById('fieldStatus');
  elements.fieldObservacoes = document.getElementById('fieldObservacoes');
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

  // Eventos para ABRIR e FECHAR o formulário
  if (elements.btnToggleForm) {
    elements.btnToggleForm.addEventListener('click', event => {
      event.preventDefault();
      resetForm();
      openForm();
    });
  }

  if (elements.btnCloseForm) {
    elements.btnCloseForm.addEventListener('click', closeForm);
  }

elements.printersGrid.addEventListener('click', event => {
    
    // --- NOVA LÓGICA DE COLAPSAR/EXPANDIR ---
    const header = event.target.closest('.brand-group-header');
    if (header) {
      const targetId = header.getAttribute('data-target');
      const contentBlock = document.getElementById(targetId);
      const icon = header.querySelector('.toggle-icon');
      
      if (contentBlock.style.display === 'none') {
        contentBlock.style.display = 'contents'; // Mostra os cards devolvendo para a grade
        icon.style.transform = 'rotate(0deg)';   // Setinha para cima
      } else {
        contentBlock.style.display = 'none';     // Esconde os cards
        icon.style.transform = 'rotate(180deg)'; // Setinha para baixo girando suavemente
      }
      return; // Importante para parar a execução do clique aqui
    }
    // -----------------------------------------

    // A lógica original de clicar nos botões Editar/Excluir continua igual
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


// ==========================================
// FUNÇÕES DE EXIBIÇÃO DO FORMULÁRIO
// ==========================================
function openForm() {
  if (elements.cadastroSection) {
    elements.cadastroSection.style.display = 'block';
    setTimeout(() => {
      elements.cadastroSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      elements.fieldMarca.focus();
    }, 50);
  }
}

function closeForm() {
  if (elements.cadastroSection) {
    elements.cadastroSection.style.display = 'none';
    resetForm();
  }
}

// ==========================================
// INTEGRAÇÃO COM O SUPABASE
// ==========================================
async function loadPrinters() {
  setLoading(true);
  try {
    const response = await fetch(`${API_ENDPOINT}?select=*&order=modelo.asc`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Erro do Supabase: ${err.message}`);
    }
    
    const result = await response.json();
    if (Array.isArray(result) && result.length > 0) {
      allPrinters = result;
      usingLocalFallback = false;
    } else {
      throw new Error('Banco vazio');
    }

  } catch (error) {
    console.warn("Carregando modo local/exemplos.", error);
    usingLocalFallback = true;
    allPrinters = readLocalPrinters();
    if (!allPrinters || allPrinters.length === 0) {
      allPrinters = getInitialExamples();
    }
  } finally {
    setLoading(false);
    renderPrinters(); // Esta função precisa existir para desenhar a tela!
    renderStats();
    renderBrandSuggestions();
  }
}

async function savePrinter() {
  try {
    const payload = getFormPayload();
    if (!payload) return; 

    setSaving(true);
    const campoId = elements.fieldId.value;
    
    const impressoraExistente = allPrinters.find(p => 
      (p.marca || '').toLowerCase() === payload.marca.toLowerCase() && 
      (p.modelo || '').toLowerCase() === payload.modelo.toLowerCase()
    );

    const id = impressoraExistente ? impressoraExistente.id : campoId;
    const url = id ? `${API_ENDPOINT}?id=eq.${id}` : API_ENDPOINT;
    const metodo = id ? 'PATCH' : 'POST';

    const response = await fetch(url, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Erro ao salvar no banco');
    }

    showToast(id ? 'Dados atualizados com sucesso!' : 'Impressora cadastrada com sucesso!', 'success');
    await loadPrinters(); 
    closeForm(); // Fecha o formulário ao terminar

  } catch (error) {
    console.error("ERRO AO SALVAR:", error);
    showToast('Erro ao salvar. Verifique o console.', 'error');
  } finally {
    setSaving(false); 
  }
}

async function deletePrinter(id) {
  const printer = allPrinters.find(item => String(item.id) === String(id));
  if (!printer) return;

  const confirmed = window.confirm(`Deseja excluir o modelo ${printer.modelo || ''}?`);
  if (!confirmed) return;

  try {
    if (usingLocalFallback) {
      allPrinters = allPrinters.filter(item => String(item.id) !== String(id));
      persistLocalPrinters();
    } else {
      const response = await fetch(`${API_ENDPOINT}?id=eq.${id}`, { 
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });
      
      if (!response.ok && response.status !== 204) throw new Error('Falha ao excluir');
      await loadPrinters();
    }

    showToast('Modelo excluído com sucesso.', 'success');
    if (elements.fieldId.value === String(id)) closeForm();
    
  } catch (error) {
    console.error(error);
    showToast('Não foi possível excluir.', 'error');
  }
}

// ==========================================
// LÓGICA DE DADOS E RENDERIZAÇÃO
// ==========================================
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

  return {
    marca,
    modelo,
    tipo: elements.fieldTipo.value,
    conexao: elements.fieldConexao.value,
    status: elements.fieldStatus.value,
    observacoes: elements.fieldObservacoes.value.trim(),
    imprimeComandas: document.querySelector('input[name="imprimeComandas"]:checked')?.value === 'Sim',
    imprimeNfe: document.querySelector('input[name="imprimeNfe"]:checked')?.value === 'Sim',
    imprimeQr: document.querySelector('input[name="imprimeQr"]:checked')?.value === 'Sim'
  };
}

function renderPrinters() {
  const filtered = getFilteredPrinters();

  if (elements.resultsCount) {
    elements.resultsCount.textContent = filtered.length === 1 
      ? '1 modelo encontrado' 
      : `${filtered.length} modelos encontrados`;
  }

  const hasResults = filtered.length > 0;
  if (elements.emptyState) elements.emptyState.hidden = hasResults;
  if (elements.printersGrid) elements.printersGrid.style.display = hasResults ? 'grid' : 'none';

  if (elements.printersGrid) {
    const impressorasPorMarca = {};
    
    filtered.forEach(printer => {
      const marca = printer.marca ? printer.marca.trim() : 'Outros';
      if (!impressorasPorMarca[marca]) impressorasPorMarca[marca] = [];
      impressorasPorMarca[marca].push(printer);
    });

    const marcasOrdenadas = Object.keys(impressorasPorMarca).sort(compareText);
    let htmlFinal = '';

    marcasOrdenadas.forEach((marca, index) => {
      // 1. Cria um ID único para cada grupo de marca
      const groupId = `grupo-marca-${index}`;

      // 2. Cabeçalho (agora tem cursor: pointer e um ícone de setinha)
      htmlFinal += `
        <div class="brand-group-header" data-target="${groupId}" style="grid-column: 1 / -1; margin-top: 1.5rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; cursor: pointer; user-select: none; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; color: #1e293b; font-size: 1.25rem; display: flex; align-items: center;">
            <i class="fa-solid fa-layer-group" style="color: #64748b; font-size: 1rem; margin-right: 8px;"></i> 
            ${escapeHtml(marca)}
            <span style="background: #f1f5f9; color: #64748b; font-size: 0.8rem; font-weight: normal; padding: 2px 8px; border-radius: 12px; margin-left: 12px;">
              ${impressorasPorMarca[marca].length}
            </span>
          </h3>
          <i class="fa-solid fa-chevron-up toggle-icon" style="color: #94a3b8; transition: transform 0.3s ease;"></i>
        </div>
      `;
      
      // 3. O Wrapper dos cards. 'display: contents' não quebra o seu layout Grid, mas permite o JavaScript esconder tudo de uma vez.
      htmlFinal += `<div id="${groupId}" class="brand-group-content" style="display: contents;">`;
      htmlFinal += impressorasPorMarca[marca].map(printer => createPrinterCard(printer)).join('');
      htmlFinal += `</div>`;
    });

    elements.printersGrid.innerHTML = htmlFinal;
  }
}

function createPrinterCard(printer) {
  const statusClass = getStatusClass(printer.status);
  const notes = stripHtml(printer.observacoes || '');
  
  const imprimeComandas = printer.imprimeComandas ? 'Sim' : 'Não';
  const imprimeNfe = printer.imprimeNfe ? 'Sim' : 'Não';
  const imprimeQr = printer.imprimeQr ? 'Sim' : 'Não';

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
    if (currentSort === 'recentes') {
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(); 
    }
    return compareText(a.modelo, b.modelo) || compareText(a.marca, b.marca);
  });

  return list;
}

function fillFormForEdit(id) {
  openForm(); // Mostra o formulário antes de preencher
  
  const printer = allPrinters.find(item => String(item.id) === String(id));
  if (!printer) return;

  elements.fieldId.value = printer.id;
  elements.fieldMarca.value = printer.marca || '';
  elements.fieldModelo.value = printer.modelo || '';
  elements.fieldTipo.value = printer.tipo || 'Térmica';
  elements.fieldConexao.value = printer.conexao || 'USB';
  elements.fieldStatus.value = printer.status || 'Homologada';
  elements.fieldObservacoes.value = stripHtml(printer.observacoes || '');

  const valorCmd = printer.imprimeComandas ? 'Sim' : 'Não';
  const cmdRadio = document.querySelector(`input[name="imprimeComandas"][value="${valorCmd}"]`);
  if (cmdRadio) cmdRadio.checked = true;

  const valorNfe = printer.imprimeNfe ? 'Sim' : 'Não';
  const nfeRadio = document.querySelector(`input[name="imprimeNfe"][value="${valorNfe}"]`);
  if (nfeRadio) nfeRadio.checked = true;

  const valorQr = printer.imprimeQr ? 'Sim' : 'Não';
  const qrRadio = document.querySelector(`input[name="imprimeQr"][value="${valorQr}"]`);
  if (qrRadio) qrRadio.checked = true;

  elements.formTitle.textContent = 'Editar impressora';
  elements.btnSavePrinter.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Atualizar modelo';
}

function resetForm() {
  if (elements.printerForm) elements.printerForm.reset();
  if (elements.fieldId) elements.fieldId.value = '';
  if (elements.fieldTipo) elements.fieldTipo.value = 'Térmica';
  if (elements.fieldConexao) elements.fieldConexao.value = 'USB';
  if (elements.fieldStatus) elements.fieldStatus.value = 'Homologada';

  const cmdRadio = document.querySelector('input[name="imprimeComandas"][value="Não"]');
  if (cmdRadio) cmdRadio.checked = true;

  const nfeRadio = document.querySelector('input[name="imprimeNfe"][value="Não"]');
  if (nfeRadio) nfeRadio.checked = true;

  const qrRadio = document.querySelector('input[name="imprimeQr"][value="Não"]');
  if (qrRadio) qrRadio.checked = true;

  if (elements.formTitle) elements.formTitle.textContent = 'Adicionar impressora';
  if (elements.btnSavePrinter) elements.btnSavePrinter.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar modelo';
}

function renderStats() {
  const brands = new Set(allPrinters.map(printer => normalizeText(printer.marca)).filter(Boolean));
  if (elements.statTotal) elements.statTotal.textContent = allPrinters.length;
  if (elements.statHomologadas) elements.statHomologadas.textContent = allPrinters.filter(p => p.status === 'Homologada').length;
  if (elements.statMarcas) elements.statMarcas.textContent = brands.size;
}

function renderBrandSuggestions() {
  if (!elements.brandSuggestions) return;
  const brands = [...new Set(allPrinters.map(printer => printer.marca).filter(Boolean))].sort(compareText);
  elements.brandSuggestions.innerHTML = brands.map(brand => `<option value="${escapeHtml(brand)}"></option>`).join('');
}

function setLoading(isLoading) {
  if (elements.loadingState) elements.loadingState.style.display = isLoading ? 'grid' : 'none';
  if (elements.printersGrid) elements.printersGrid.style.display = isLoading ? 'none' : 'grid';
}

function setSaving(isSaving) {
  if (elements.btnSavePrinter) {
    elements.btnSavePrinter.disabled = isSaving;
    if (isSaving) elements.btnSavePrinter.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
  }
}

function showToast(message, type = 'info') {
  if (!elements.toast) return;
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
    { id: crypto.randomUUID(), marca: 'Epson', modelo: 'TM-T20X', tipo: 'Térmica', conexao: 'USB/Ethernet', status: 'Homologada', observacoes: 'Modelo recomendado.', imprimeComandas: true, imprimeNfe: true, imprimeQr: true, created_at: now - 3000 },
    { id: crypto.randomUUID(), marca: 'Elgin', modelo: 'i9 Full', tipo: 'Térmica', conexao: 'USB', status: 'Homologada', observacoes: 'Compatível Windows.', imprimeComandas: true, imprimeNfe: true, imprimeQr: true, created_at: now - 2000 }
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