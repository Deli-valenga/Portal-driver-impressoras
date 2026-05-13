/* Impressoras Homologadas - lógica da página */
const SUPABASE_URL = 'https://kvlzaigjcbjfhfbmsmfw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2bHphaWdqY2JqZmhmYm1zbWZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0Njc4MTAsImV4cCI6MjA5NDA0MzgxMH0.FyfXGEzd2vSpRJ7F8-zm-5IxSgzA_8q4gB52__vKZ4c';
const API_ENDPOINT = `${SUPABASE_URL}/rest/v1/impressoras`;
const LOCAL_STORAGE_KEY = 'impressoras_fallback';

let allPrinters = [];
let deleteTargetId = null;
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
    // CORREÇÃO: O Supabase usa '?select=*&order=modelo.asc'
    const response = await fetch(`${API_ENDPOINT}?select=*&order=modelo.asc`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Erro do Supabase ao ler: ${err.message}`);
    }
    
    // CORREÇÃO: O Supabase devolve direto um Array (uma lista), e não { data: [...] }
    const result = await response.json();
    allPrinters = Array.isArray(result) ? result : [];
    usingLocalFallback = false;

  } catch (error) {
    console.warn("Falha ao carregar do Supabase. Ativando modo local.", error);
    usingLocalFallback = true;
    allPrinters = readLocalPrinters();
    if (!allPrinters.length) {
      allPrinters = getInitialExamples();
      persistLocalPrinters();
    }
  } finally {
    setLoading(false);
    renderPrinters();
    renderStats();
    renderBrandSuggestions();
  }
}

async function savePrinter() {
  try {
    // 1. Coleta e Valida os dados usando a função getFormPayload
    const payload = getFormPayload();
    if (!payload) return; // Se os campos obrigatórios estiverem vazios, a função para aqui
    setSaving(true); // Ativa o efeito visual de "Salvando..." no botão

    // 2. Define se é uma edição (ID existente) ou um novo cadastro
    const campoId = elements.fieldId.value;
    
    // Busca se já existe uma impressora igual para evitar duplicados no banco
    const impressoraExistente = allPrinters.find(p => 
      (p.marca || '').toLowerCase() === payload.marca.toLowerCase() && 
      (p.modelo || '').toLowerCase() === payload.modelo.toLowerCase()
    );

    // Prioriza o ID da existente (para atualizar) ou o ID que está no campo oculto do formulário
    const id = impressoraExistente ? impressoraExistente.id : campoId;

    // 3. Configura a URL e o Método para o Supabase
    // Se tem ID, usamos PATCH (editar). Se não tem, usamos POST (criar).
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
      console.error("ERRO DETALHADO DO SUPABASE:", errorData);
      throw new Error(errorData.message || 'Erro ao comunicar com o banco');
    }

    // 4. Feedback de Sucesso
    showToast(id ? 'Dados atualizados com sucesso!' : 'Impressora cadastrada com sucesso!', 'success');

    await loadPrinters(); // Recarrega a lista para atualizar os cards na tela
    resetForm();          // Limpa o formulário e volta o título para "Adicionar"

  } catch (error) {
    console.error("ERRO AO SALVAR:", error);
    showToast('Erro ao salvar no banco de dados.', 'error');
  } finally {
    setSaving(false); // Garante que o botão volte ao estado normal (Salvar modelo)
  }
}

async function deletePrinter(id) {
  // 1. A CORREÇÃO ESTÁ AQUI: Transformamos ambos em String (texto) para comparar com segurança
  const printer = allPrinters.find(item => String(item.id) === String(id));
  
  if (!printer) {
    console.error("Erro: Impressora não encontrada na lista com o ID:", id);
    return;
  }

  const confirmed = window.confirm(`Deseja excluir o modelo ${printer.modelo || ''} da marca ${printer.marca || ''}?`);
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
      
      // Captura o erro exato se o Supabase recusar a exclusão
      if (!response.ok && response.status !== 204) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao excluir no Supabase');
      }
      
      await loadPrinters();
    }

    if (usingLocalFallback) {
      renderPrinters();
      renderStats();
      renderBrandSuggestions();
    }

    showToast('Modelo excluído com sucesso.', 'success');
    if (elements.fieldId.value === String(id)) resetForm();
    
  } catch (error) {
    console.error("ERRO AO EXCLUIR NO SUPABASE:", error);
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

  return {
    marca,
    modelo,
    tipo: elements.fieldTipo.value,
    conexao: elements.fieldConexao.value,
    status: elements.fieldStatus.value,
    observacoes: elements.fieldObservacoes.value.trim(),
    // REMOVA A LINHA DO ATIVO DAQUI!
    imprimeComandas: document.querySelector('input[name="imprimeComandas"]:checked')?.value === 'Sim',
    imprimeNfe: document.querySelector('input[name="imprimeNfe"]:checked')?.value === 'Sim',
    imprimeQr: document.querySelector('input[name="imprimeQr"]:checked')?.value === 'Sim'
  };
}

function createPrinterCard(printer) {
  const statusClass = getStatusClass(printer.status);
  const notes = stripHtml(printer.observacoes || '');
  const visibleLabel = printer.ativo === false ? '<span class="badge"><i class="fa-solid fa-eye-slash"></i> Oculto</span>' : '';

  // A CORREÇÃO ESTÁ AQUI: 
  // O JavaScript lê o 'true' do banco e transforma na palavra 'Sim'. Se for 'false', vira 'Não'.
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
  // 1. CORREÇÃO DO ID: Convertendo os dois para texto igual no Delete
  const printer = allPrinters.find(item => String(item.id) === String(id));
  
  if (!printer) {
    console.error("Erro: Impressora não encontrada para edição.");
    return;
  }

  elements.fieldId.value = printer.id;
  elements.fieldMarca.value = printer.marca || '';
  elements.fieldModelo.value = printer.modelo || '';
  elements.fieldTipo.value = printer.tipo || 'Térmica';
  elements.fieldConexao.value = printer.conexao || 'USB';
  elements.fieldStatus.value = printer.status || 'Homologada';
  elements.fieldObservacoes.value = stripHtml(printer.observacoes || '');
  if (elements.fieldAtivo) elements.fieldAtivo.checked = printer.ativo !== false;

  // 2. CORREÇÃO DOS RADIOS (SIM/NÃO): 
  // Lê o true/false do Supabase e traduz para marcar a bolinha certa
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
  
  // Rola a tela suavemente até o formulário
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