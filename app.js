// Global state
let scanData = null;
let currentFolderNode = null;
let navigationHistory = [];
let sortField = 'size'; // 'name' or 'size'
let sortDirection = 'desc'; // 'asc' or 'desc'
let activeExtensionFilter = null; // Filter current folder files by extension

// Colors for the extension chart (10 premium dark-mode matching colors)
const EXTENSION_COLORS = [
  '#7f00ff', // Purple
  '#e100ff', // Magenta
  '#0072ff', // Blue
  '#00f2fe', // Cyan
  '#2ecc71', // Green
  '#f1c40f', // Yellow
  '#e67e22', // Orange
  '#e74c3c', // Red
  '#1abc9c', // Teal
  '#9b59b6'  // Amethyst
];

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  // Try to load default file in case it is served via HTTP
  loadDefaultData();
});

// Setup event listeners
function setupEventListeners() {
  // Drive selection dropdown
  const driveSelect = document.getElementById('drive-select');
  driveSelect.addEventListener('change', handleDriveSelect);

  // Export for Agent button
  const btnExportAgent = document.getElementById('btn-export-agent');
  if (btnExportAgent) {
    btnExportAgent.addEventListener('click', exportDataForAgent);
  }

  // Back button
  const btnBack = document.getElementById('btn-back');
  btnBack.addEventListener('click', navigateUp);

  // Tree Back button
  const btnTreeBack = document.getElementById('btn-tree-back');
  if (btnTreeBack) {
    btnTreeBack.addEventListener('click', navigateUp);
  }

  // Table sorting
  document.getElementById('sort-name').addEventListener('click', () => toggleSort('name'));
  document.getElementById('sort-size').addEventListener('click', () => toggleSort('size'));

  // Search input
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', handleSearch);

  // Run Scan button
  const btnRunScan = document.getElementById('btn-run-scan');
  if (btnRunScan) {
    btnRunScan.addEventListener('click', startScanFlow);
  }
}

// Start scan flow
async function startScanFlow() {
  const overlay = document.getElementById('scanning-overlay');
  const btn = document.getElementById('btn-run-scan');
  
  if (btn) btn.disabled = true;
  if (overlay) overlay.classList.remove('hidden');
  
  try {
    const res = await fetch('/api/scan', { method: 'POST' });
    if (res.ok) {
      // Poll status
      pollScanStatus();
    } else {
      const err = await res.json();
      alert(`Error starting scan: ${err.message || 'Unknown error'}`);
      if (btn) btn.disabled = false;
      if (overlay) overlay.classList.add('hidden');
    }
  } catch (err) {
    alert(`Failed to trigger scan: ${err.message}`);
    if (btn) btn.disabled = false;
    if (overlay) overlay.classList.add('hidden');
  }
}

// Poll scan status
function pollScanStatus() {
  const overlay = document.getElementById('scanning-overlay');
  const btn = document.getElementById('btn-run-scan');
  
  const interval = setInterval(async () => {
    try {
      const res = await fetch('/api/scan/status');
      if (res.ok) {
        const status = await res.json();
        if (!status.scanning) {
          clearInterval(interval);
          if (overlay) overlay.classList.add('hidden');
          if (btn) btn.disabled = false;
          // Reload scans info and load the latest scan
          await loadDefaultData();
          showToast("Scan completed and data updated!");
        }
      }
    } catch (err) {
      console.error("Error polling scan status:", err);
    }
  }, 2000);
}

// Load a specific scan JSON file from dropdown
async function handleDriveSelect(event) {
  const fileName = event.target.value;
  if (!fileName) return;
  await loadScanData(fileName);
}

// Helper to fetch and load a JSON file
async function loadScanData(fileName) {
  try {
    const response = await fetch(fileName);
    if (response.ok) {
      const data = await response.json();
      initializeDashboard(data);
    } else {
      alert(`Could not load scan file "${fileName}". Please check if it was generated successfully.`);
    }
  } catch (error) {
    alert(`Error loading scan data: ${error.message}`);
    console.error(error);
  }
}

// Try to auto-load scans and auto-select latest scan
async function loadDefaultData() {
  try {
    // 1. Try to load scans metadata from custom server API
    const infoRes = await fetch('/api/scans/info');
    if (infoRes.ok) {
      const scansInfo = await infoRes.json();
      
      // Update options in drive-select dropdown dynamically!
      const driveSelect = document.getElementById('drive-select');
      if (driveSelect && Object.keys(scansInfo).length > 0) {
        // Keep only the default disabled option
        driveSelect.innerHTML = '<option value="" disabled>Select Scan</option>';
        
        for (const [filename, meta] of Object.entries(scansInfo)) {
          const opt = document.createElement('option');
          opt.value = filename;
          
          let displayLabel = meta.label;
          if (meta.target_path) {
            displayLabel += ` (${meta.target_path})`;
          }
          opt.textContent = displayLabel;
          driveSelect.appendChild(opt);
        }
      }
      
      let latestFile = null;
      let latestMtime = 0;
      
      for (const [filename, meta] of Object.entries(scansInfo)) {
        if (meta.mtime > latestMtime) {
          latestMtime = meta.mtime;
          latestFile = filename;
        }
      }
      
      if (latestFile) {
        console.log(`Auto-selecting latest scan: ${latestFile}`);
        if (driveSelect) {
          driveSelect.value = latestFile;
        }
        await loadScanData(latestFile);
        return;
      }
    }
  } catch (error) {
    console.log("Could not fetch scans info from server API, falling back to static scan_results.json");
  }
  
  // Fallback to static scan_results.json
  try {
    const response = await fetch('scan_results.json');
    if (response.ok) {
      const data = await response.json();
      initializeDashboard(data);
    }
  } catch (error) {
    console.log("Could not auto-load scan_results.json. Please ensure a scan has been run first.");
  }
}

// Show a simple toast notification
function showToast(message) {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
}

// Helper to recursively traverse the tree and find the largest folders
function getLargestFolders(rootNode, limit = 10) {
  const folders = [];
  
  function traverse(node) {
    if (!node) return;
    if (node.is_dir) {
      folders.push({ name: node.name, path: node.path, size: node.size });
      if (node.children) {
        node.children.forEach(child => traverse(child));
      }
    }
  }
  
  traverse(rootNode);
  folders.sort((a, b) => b.size - a.size);
  // Skip the absolute root node which is index 0
  return folders.slice(1, limit + 1);
}

// Export dashboard data formatted as an detailed, comprehensive markdown prompt for the agent
function exportDataForAgent() {
  if (!scanData) {
    alert("No scan data loaded to export.");
    return;
  }
  
  const info = scanData.scan_info;
  const topFiles = scanData.top_large_files.slice(0, 20);
  const extensions = scanData.extension_stats.slice(0, 15);
  const topFolders = getLargestFolders(scanData.tree, 15);
  const cacheSuggestions = scanData.cache_suggestions || [];
  
  // Determine the exe path and scan file path
  const exePath = 'DiskSpaceAnalyzer.exe';
  const guidePath = 'AI_GUIDE.md';
  const scanFilename = getCurrentScanFilename();
  // Build the full path using the page URL as a hint
  const scanFilePath = `${window.location.origin}/${scanFilename}`;
  
  let md = `Baseado no repositório do github https://github.com/Mapa0/disk-space-analyzer, preciso realizar uma análise e limpeza de disco.\n\n`;
  
  // ── CLI Tools Section ──
  md += `## 🛠️ Ferramentas Disponíveis\n\n`;
  md += `Você tem acesso ao executável **Disk Space Analyzer** com modo CLI. Localize o \`${exePath}\` no sistema do usuário.\n\n`;
  md += `- **Arquivo de scan atual:** \`${scanFilename}\` (localizado junto ao executável)\n`;
  md += `- **Documentação completa para IA:** \`${guidePath}\` (junto ao executável)\n\n`;
  md += `### Comandos CLI disponíveis:\n`;
  md += `\`\`\`bash\n`;
  md += `# Listar scans disponíveis com metadados\n`;
  md += `"${exePath}" list\n\n`;
  md += `# Escanear todos os drives\n`;
  md += `"${exePath}" scan --all\n\n`;
  md += `# Escanear um diretório específico\n`;
  md += `"${exePath}" scan --path "C:\\\\Users" --output custom_scan.json\n\n`;
  md += `# Exportar análise completa formatada\n`;
  md += `"${exePath}" export --scan ${scanFilename}\n\n`;
  md += `# Comparar scan atual vs. anterior\n`;
  md += `"${exePath}" compare --scan ${scanFilename}\n\n`;
  md += `# Ver caches detectados\n`;
  md += `"${exePath}" caches\n`;
  md += `\`\`\`\n\n`;
  md += `---\n\n`;
  
  // ── Scan Data Section ──
  md += `## 📊 Dados da Análise Atual\n\n`;
  md += `### Informações Gerais:\n`;
  md += `- **Scan Utilizado:** \`${scanFilename}\`\n`;
  md += `- **Diretório Raiz Escaneado:** \`${info.target_path}\`\n`;
  md += `- **Tamanho Total:** ${formatBytes(info.total_size)}\n`;
  md += `- **Total de Arquivos:** ${info.total_files.toLocaleString()}\n`;
  md += `- **Total de Pastas:** ${info.total_folders.toLocaleString()}\n`;
  
  const scanDate = new Date(info.timestamp);
  md += `- **Data da Varredura:** ${scanDate.toLocaleString()}\n`;
  
  const ageHours = (Date.now() - scanDate.getTime()) / (1000 * 60 * 60);
  if (ageHours > 24) {
    md += `- ⚠️ **ATENÇÃO:** Esta análise tem ${Math.floor(ageHours)} horas. Considere rodar um novo scan: \`"${exePath}" scan --all\`\n`;
  }
  md += `\n`;
  
  // ── Caches ──
  md += `### 🧹 Caches e Arquivos Temporários Detectados:\n`;
  if (cacheSuggestions.length > 0) {
    const totalCache = cacheSuggestions.reduce((sum, c) => sum + (c.size || 0), 0);
    md += `**Total estimado de caches limpos:** ${formatBytes(totalCache)}\n\n`;
    cacheSuggestions.forEach(cache => {
      const pathsText = cache.paths.map(p => `\`${p}\``).join(', ');
      md += `- **${cache.name}**: ${formatBytes(cache.size)}  \n  *Caminhos:* ${pathsText}  \n  *Descrição:* ${cache.description}\n`;
    });
  } else {
    md += `*Nenhum cache mapeado foi encontrado ou todos já foram limpos.*\n`;
  }
  md += `\n`;
  
  // ── Top Folders ──
  md += `### 📂 Maiores Pastas Encontradas (Top 15):\n`;
  topFolders.forEach((f, idx) => {
    md += `${idx + 1}. \`${f.path}\` (${formatBytes(f.size)})\n`;
  });
  md += `\n`;
  
  // ── Top Files ──
  md += `### 📄 Maiores Arquivos Encontrados (Top 20):\n`;
  topFiles.forEach((f, idx) => {
    md += `${idx + 1}. \`${f.path}\` (${formatBytes(f.size)})\n`;
  });
  md += `\n`;
  
  // ── Extensions ──
  md += `### 📊 Principais Extensões de Arquivos (Top 15):\n`;
  extensions.forEach(ext => {
    md += `- \`${ext.ext}\`: ${formatBytes(ext.size)}\n`;
  });
  md += `\n`;
  
  // ── Agent Instructions (safe-first strategy) ──
  md += `---\n\n`;
  md += `## 🤖 Instruções para o Agente de IA:\n\n`;
  md += `1. **Verifique a atualidade dos dados:** Se a data da varredura for antiga (>24h), rode um novo scan: \`"${exePath}" scan --all\`\n`;
  md += `2. **Consulte a documentação:** Leia o arquivo \`${guidePath}\` (junto ao executável) para acessar estratégias detalhadas de limpeza, comandos PowerShell avançados, e melhores práticas.\n`;
  md += `3. **FASE 1 — Limpeza Segura (execute imediatamente):** Limpe APENAS os itens 100% seguros listados acima (caches, temp files). Esses normalmente liberam pouco espaço mas são risco zero. Execute a limpeza e reporte quanto liberou.\n`;
  md += `4. **FASE 2 — Análise de Oportunidades Grandes:** Após a limpeza segura, analise as maiores pastas e arquivos. Identifique os itens que oferecem **o maior ganho de espaço** (projetos antigos, backups, VMs, node_modules duplicados, downloads antigos, etc.). Para CADA item grande, explique:\n`;
  md += `   - O que é e por que está ocupando espaço\n`;
  md += `   - Quanto espaço seria liberado ao remover/limpar\n`;
  md += `   - O risco envolvido (pode perder dados? é reversível?)\n`;
  md += `   - **Peça confirmação explícita do usuário antes de executar qualquer ação grande.**\n`;
  md += `5. **Execução Segura:** Use PowerShell. Sempre mostre o que será removido antes de executar. Use \`-WhatIf\` quando possível.\n`;
  md += `6. **Pós-Limpeza OBRIGATÓRIO:** Após qualquer limpeza, SEMPRE rode:\n`;
  md += `   \`\`\`bash\n   "${exePath}" scan --all\n   \`\`\`\n`;
  md += `   Isso atualiza os dados do dashboard para que o usuário veja os resultados visualmente.\n`;
  md += `7. **Compare resultados:** Rode \`"${exePath}" compare --scan ${scanFilename}\` para mostrar exatamente quanto espaço foi liberado.\n`;
  
  // Copy to clipboard
  navigator.clipboard.writeText(md).then(() => {
    showToast("Prompt completo copiado! Cole na conversa com o agente de IA.");
  }).catch(err => {
    // Fallback: download as file
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'disk_analysis_prompt.md';
    a.click();
    URL.revokeObjectURL(url);
    showToast("Salvo como arquivo de prompt!");
  });
}

// Helper to get the currently selected scan filename
function getCurrentScanFilename() {
  const driveSelect = document.getElementById('drive-select');
  return driveSelect ? (driveSelect.value || 'C_drive_results.json') : 'C_drive_results.json';
}

// Render the Cache & Temporary Files suggestions panel
function renderCacheSuggestions(cacheSuggestions) {
  const grid = document.getElementById('cache-grid');
  const panel = document.getElementById('cache-panel');
  if (!grid || !panel) return;

  grid.innerHTML = '';

  if (!cacheSuggestions || cacheSuggestions.length === 0) {
    panel.style.display = 'none'; // Hide panel if no caches
    return;
  }

  panel.style.display = 'flex'; // Show panel

  cacheSuggestions.forEach(cache => {
    const card = document.createElement('div');
    card.className = 'cache-card';
    
    const pathsJoined = cache.paths.join(', ');

    card.innerHTML = `
      <div class="cache-card-header">
        <span class="cache-title">${cache.name}</span>
        <span class="cache-size">${formatBytes(cache.size)}</span>
      </div>
      <p class="cache-desc">${cache.description}</p>
      <div class="cache-path-container" title="Copy primary path: ${cache.paths[0]}">
        <span class="cache-path-text">${cache.paths[0]} ${cache.paths.length > 1 ? `(+${cache.paths.length - 1} outros)` : ''}</span>
        <button class="cache-action-btn btn-copy-cache-path" data-path="${cache.paths[0]}">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
        </button>
      </div>
    `;

    // Copy path hook
    const copyBtn = card.querySelector('.btn-copy-cache-path');
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const path = copyBtn.getAttribute('data-path');
      navigator.clipboard.writeText(path.replace(/\\/g, '/')).then(() => {
        showToast("Caminho do cache copiado!");
      }).catch(err => {
        console.error("Failed to copy cache path: ", err);
      });
    });

    grid.appendChild(card);
  });
}

// Initialize dashboard with scan data
function initializeDashboard(data) {
  if (!data || !data.scan_info || !data.tree) {
    alert("Invalid JSON format. Expected properties: 'scan_info', 'tree', 'top_large_files', 'extension_stats'.");
    return;
  }

  scanData = data;
  currentFolderNode = data.tree;
  navigationHistory = [];
  activeExtensionFilter = null; // Reset filter on new scan load

  // Update Header Metadata
  const dateStr = new Date(data.scan_info.timestamp).toLocaleString();
  const duration = data.scan_info.duration_seconds ? `in ${data.scan_info.duration_seconds.toFixed(1)}s` : '';
  const scanMeta = document.getElementById('scan-meta');
  scanMeta.innerHTML = `
    <div class="meta-item"><span class="meta-label">Path:</span><span class="meta-value">${data.scan_info.target_path}</span></div>
    <div class="meta-item"><span class="meta-label">Scanned:</span><span class="meta-value">${dateStr} ${duration}</span></div>
  `;

  // Update Stats Cards
  document.getElementById('stat-total-size').textContent = formatBytes(data.scan_info.total_size);
  document.getElementById('stat-total-folders').textContent = data.scan_info.total_folders.toLocaleString();
  document.getElementById('stat-total-files').textContent = data.scan_info.total_files.toLocaleString();

  // Load Folder Explorer (which will also calculate extension stats and render tree for the root folder)
  renderFolderExplorer();

  // Load Top Large Files List
  renderLargeFilesList(data.top_large_files);
  
  // Render Cache & Temp Suggestions
  renderCacheSuggestions(data.cache_suggestions);
}

// Helper to format bytes to human readable sizes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Navigate into a subfolder
function navigateToFolder(folderNode) {
  if (!folderNode.is_dir) return;
  if (currentFolderNode && folderNode.path === currentFolderNode.path) return;
  
  navigationHistory.push(currentFolderNode);
  currentFolderNode = folderNode;
  
  // Clear search input and extension filter on folder change
  document.getElementById('search-input').value = '';
  activeExtensionFilter = null;
  
  renderFolderExplorer();
}

// Navigate up to parent folder
function navigateUp() {
  if (navigationHistory.length === 0) return;
  currentFolderNode = navigationHistory.pop();
  
  // Clear search input and extension filter on folder change
  document.getElementById('search-input').value = '';
  activeExtensionFilter = null;
  
  renderFolderExplorer();
}

// Navigate directly to a specific ancestor path in history
function navigateToAncestor(index) {
  if (index >= navigationHistory.length) return;
  
  // Update current node to that history point
  const targetNode = navigationHistory[index];
  
  // Truncate history after that point
  navigationHistory = navigationHistory.slice(0, index);
  currentFolderNode = targetNode;
  
  // Clear search input and extension filter on folder change
  document.getElementById('search-input').value = '';
  activeExtensionFilter = null;
  
  renderFolderExplorer();
}

// Helper to render breadcrumbs for a specific container and back button
function renderBreadcrumbsForContainer(containerId, backButtonId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  // Root drive/path representation
  const rootBtn = document.createElement('span');
  rootBtn.className = 'breadcrumb-item';
  rootBtn.textContent = 'Root';
  rootBtn.addEventListener('click', () => {
    if (navigationHistory.length > 0) {
      navigateToAncestor(0);
    }
  });
  container.appendChild(rootBtn);

  // Append history paths
  navigationHistory.forEach((node, idx) => {
    const sep = document.createElement('span');
    sep.className = 'breadcrumb-separator';
    sep.textContent = '>';
    container.appendChild(sep);

    const item = document.createElement('span');
    item.className = 'breadcrumb-item';
    item.textContent = node.name;
    item.addEventListener('click', () => navigateToAncestor(idx));
    container.appendChild(item);
  });

  // Current active folder (non-clickable)
  if (navigationHistory.length > 0 || currentFolderNode !== scanData.tree) {
    const sep = document.createElement('span');
    sep.className = 'breadcrumb-separator';
    sep.textContent = '>';
    container.appendChild(sep);

    const activeItem = document.createElement('span');
    activeItem.className = 'breadcrumb-item breadcrumb-active';
    activeItem.textContent = currentFolderNode.name;
    container.appendChild(activeItem);
  }

  // Update back button status
  const backBtn = document.getElementById(backButtonId);
  if (backBtn) {
    backBtn.disabled = (navigationHistory.length === 0);
  }
}

// Build breadcrumbs path representation
function renderBreadcrumbs() {
  renderBreadcrumbsForContainer('breadcrumbs', 'btn-back');
  renderBreadcrumbsForContainer('tree-breadcrumbs', 'btn-tree-back');
}

// Helper to get file extension in lowercase (returns 'no_ext' if none)
function getFileExtension(filename) {
  const idx = filename.lastIndexOf('.');
  if (idx === -1 || idx === 0) return 'no_ext';
  return filename.substring(idx).toLowerCase();
}

// Sort active children based on state
function getSortedChildren(node, filterQuery = '') {
  if (!node || !node.children) return [];

  let items = [...node.children];

  // Apply extension filter first if active
  if (activeExtensionFilter) {
    items = items.filter(item => {
      if (item.is_dir) return false; // Hide directories when filtering by file type
      const ext = getFileExtension(item.name);
      return ext === activeExtensionFilter;
    });
  }

  // Apply search query filter if exists
  if (filterQuery) {
    const query = filterQuery.toLowerCase();
    items = items.filter(item => item.name.toLowerCase().includes(query));
  }

  // Sort
  items.sort((a, b) => {
    let comparison = 0;
    if (sortField === 'name') {
      comparison = a.name.localeCompare(b.name);
    } else {
      comparison = a.size - b.size;
    }
    return sortDirection === 'desc' ? -comparison : comparison;
  });

  return items;
}

// Render the Folder Explorer rows
function renderFolderExplorer() {
  renderBreadcrumbs();

  const tbody = document.getElementById('explorer-tbody');
  tbody.innerHTML = '';

  const query = document.getElementById('search-input').value;
  const sortedItems = getSortedChildren(currentFolderNode, query);

  if (sortedItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">
          No folders or files found.
        </td>
      </tr>
    `;
    return;
  }

  const parentSize = currentFolderNode.size || 1;

  sortedItems.forEach(item => {
    const tr = document.createElement('tr');
    tr.className = item.is_dir ? 'is-directory' : 'is-file';
    
    // Calculate percentage size of the parent
    const percent = ((item.size / parentSize) * 100).toFixed(1);

    // Name column HTML with appropriate icon
    const nameCell = `
      <td class="col-name">
        <div class="item-name-cell">
          <div class="item-icon">
            ${item.is_dir ? 
              `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>` : 
              `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`
            }
          </div>
          <span class="item-name-text" title="${item.name}">${item.name}</span>
        </div>
      </td>
    `;

    // Size column
    const sizeCell = `
      <td class="col-size">
        <span class="size-text">${formatBytes(item.size)}</span>
      </td>
    `;

    // Progress percentage bar
    const barCell = `
      <td class="col-bar">
        <div class="progress-container">
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${percent}%"></div>
          </div>
          <span class="progress-percent">${percent}%</span>
        </div>
      </td>
    `;

    // Copy path action
    const actionsCell = `
      <td class="col-actions">
        <button class="action-btn-copy" title="Copy full path" data-path="${item.path.replace(/\\/g, '/')}">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
        </button>
      </td>
    `;

    tr.innerHTML = nameCell + sizeCell + barCell + actionsCell;

    // Drills down on click if it's a directory
    if (item.is_dir) {
      tr.addEventListener('click', (e) => {
        // If clicking copy action button, do not navigate
        if (e.target.closest('.action-btn-copy')) return;
        navigateToFolder(item);
      });
    }

    // Copy clip hook
    const copyBtn = tr.querySelector('.action-btn-copy');
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const path = copyBtn.getAttribute('data-path');
      navigator.clipboard.writeText(path).then(() => {
        showToast("Path copied to clipboard!");
      }).catch(err => {
        console.error("Failed to copy path: ", err);
      });
    });

    tbody.appendChild(tr);
  });
  
  // Calculate and Render File Type Breakdown for the active folder
  const folderExtStats = calculateFolderExtensionStats(currentFolderNode);
  renderExtensionChart(folderExtStats);

  // Render collapsible folder tree hierarchy
  renderFolderTree();
}

// Search input keypress
function handleSearch(event) {
  renderFolderExplorer();
}

// Change sorting field
function toggleSort(field) {
  const indicators = {
    name: document.getElementById('sort-name').querySelector('.sort-indicator'),
    size: document.getElementById('sort-size').querySelector('.sort-indicator')
  };

  if (sortField === field) {
    // Reverse direction
    sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
  } else {
    // Change field, default to desc
    sortField = field;
    sortDirection = 'desc';
  }

  // Update indicators text
  indicators.name.textContent = '';
  indicators.size.textContent = '';
  indicators[field].textContent = sortDirection;

  renderFolderExplorer();
}

// Render dynamic custom SVG donut chart & legend
// Helper to draw a circular arc for donut chart slice
function describeArc(cx, cy, r, startAngle, endAngle) {
  const startX = cx + r * Math.cos(startAngle);
  const startY = cy + r * Math.sin(startAngle);
  const endX = cx + r * Math.cos(endAngle);
  const endY = cy + r * Math.sin(endAngle);
  
  const angleDiff = endAngle - startAngle;
  const largeArcFlag = angleDiff > Math.PI ? 1 : 0;
  
  return `M ${startX} ${startY} A ${r} ${r} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
}

// Render dynamic custom SVG donut chart & legend
function renderExtensionChart(extensionStats) {
  const svg = document.getElementById('extension-chart');
  const legendContainer = document.getElementById('chart-legend');
  
  // Clear previous donut segments using class selector to keep background circle intact!
  const oldSegments = svg.querySelectorAll('.donut-segment');
  oldSegments.forEach(seg => seg.remove());
  
  legendContainer.innerHTML = '';

  if (!extensionStats || extensionStats.length === 0) {
    return;
  }

  // Calculate total extension size to determine slices percentage
  const totalExtSize = extensionStats.reduce((sum, item) => sum + item.size, 0);
  if (totalExtSize === 0) return;

  const radius = 60;
  let accumulatedAngle = 0; // Starts at 3 o'clock (0 radians)

  extensionStats.forEach((item, index) => {
    const color = EXTENSION_COLORS[index % EXTENSION_COLORS.length];
    const percent = (item.size / totalExtSize) * 100;
    
    // Draw SVG arc path slice if percentage is significant
    if (percent > 0.1) {
      let segmentAngle = (item.size / totalExtSize) * 2 * Math.PI;
      // Special case: if segment is 100%, leave a tiny gap so startX and endX do not overlap
      if (segmentAngle >= 2 * Math.PI) {
        segmentAngle = 2 * Math.PI - 0.001;
      }
      
      const startAngle = accumulatedAngle;
      const endAngle = startAngle + segmentAngle;
      
      const pathSlice = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathSlice.setAttribute('d', describeArc(100, 100, radius, startAngle, endAngle));
      pathSlice.setAttribute('fill', 'none');
      pathSlice.setAttribute('stroke', color);
      pathSlice.setAttribute('stroke-width', '20');
      
      // Use standard class assignment for SVG
      let cssClass = 'donut-segment';
      if (activeExtensionFilter) {
        if (activeExtensionFilter === item.ext) {
          cssClass += ' filtered';
        } else {
          cssClass += ' dimmed';
        }
      }
      pathSlice.setAttribute('class', cssClass);
      
      // Hover tooltip effect
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${item.ext}: ${formatBytes(item.size)} (${percent.toFixed(1)}%)`;
      pathSlice.appendChild(title);

      // Interactive Hover Center Text updates
      pathSlice.addEventListener('mouseenter', () => {
        const centerTitle = document.getElementById('donut-center-title');
        const centerSize = document.getElementById('donut-center-size');
        if (centerTitle && centerSize) {
          centerTitle.textContent = item.ext;
          centerSize.textContent = formatBytes(item.size);
          centerSize.style.opacity = '1';
        }
      });
      
      pathSlice.addEventListener('mouseleave', () => {
        const centerTitle = document.getElementById('donut-center-title');
        const centerSize = document.getElementById('donut-center-size');
        if (centerTitle && centerSize) {
          centerTitle.textContent = 'Extensions';
          centerSize.textContent = '';
          centerSize.style.opacity = '0';
        }
      });

      // Filter click handler
      pathSlice.addEventListener('click', () => toggleExtensionFilter(item.ext));

      svg.appendChild(pathSlice);
      
      accumulatedAngle += segmentAngle;
    }

    // Build Legend item
    const legendItem = document.createElement('div');
    
    let legendClass = 'legend-item';
    if (activeExtensionFilter) {
      if (activeExtensionFilter === item.ext) {
        legendClass += ' filtered';
      } else {
        legendClass += ' dimmed';
      }
    }
    legendItem.className = legendClass;
    
    legendItem.innerHTML = `
      <div class="legend-color" style="background-color: ${color}"></div>
      <span class="legend-name" title="${item.ext}">${item.ext}</span>
      <span class="legend-val">${formatBytes(item.size)}</span>
    `;
    
    // Interactive Legend Hover
    legendItem.addEventListener('mouseenter', () => {
      const centerTitle = document.getElementById('donut-center-title');
      const centerSize = document.getElementById('donut-center-size');
      if (centerTitle && centerSize) {
        centerTitle.textContent = item.ext;
        centerSize.textContent = formatBytes(item.size);
        centerSize.style.opacity = '1';
      }
      
      // Find corresponding SVG segment slice (match by color stroke)
      const slices = svg.querySelectorAll('.donut-segment');
      slices.forEach(slice => {
        if (slice.getAttribute('stroke') === color) {
          slice.style.strokeWidth = '25';
          slice.style.filter = 'drop-shadow(0 0 4px rgba(255, 255, 255, 0.15))';
        }
      });
    });
    
    legendItem.addEventListener('mouseleave', () => {
      const centerTitle = document.getElementById('donut-center-title');
      const centerSize = document.getElementById('donut-center-size');
      if (centerTitle && centerSize) {
        centerTitle.textContent = 'Extensions';
        centerSize.textContent = '';
        centerSize.style.opacity = '0';
      }
      
      const slices = svg.querySelectorAll('.donut-segment');
      slices.forEach(slice => {
        slice.style.strokeWidth = '';
        slice.style.filter = '';
      });
    });

    // Filter click handler
    legendItem.addEventListener('click', () => toggleExtensionFilter(item.ext));
    
    legendContainer.appendChild(legendItem);
  });
}

// Toggle file extension filter
function toggleExtensionFilter(ext) {
  if (activeExtensionFilter === ext) {
    activeExtensionFilter = null;
  } else {
    activeExtensionFilter = ext;
  }
  
  // Re-render components to show filtering states
  renderFolderExplorer();
}

// Render Top Files table
function renderLargeFilesList(topFiles) {
  const tbody = document.getElementById('large-files-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!topFiles || topFiles.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No large files recorded</td></tr>`;
    return;
  }

  // Limit to top 20 files for neat display
  const displayFiles = topFiles.slice(0, 20);

  displayFiles.forEach((file, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight: 600; color: var(--text-muted); text-align: center;">${index + 1}</td>
      <td class="col-name">
        <div class="item-name-cell">
          <div class="item-icon" style="color: var(--text-muted);">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
          </div>
          <span class="item-name-text" title="${file.name}">${file.name}</span>
        </div>
      </td>
      <td style="color: var(--text-muted); font-size: 0.85rem; max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        <span title="${file.path}">${file.path}</span>
      </td>
      <td style="font-weight: 600; color: var(--accent); font-family: monospace;">${formatBytes(file.size)}</td>
      <td style="text-align: right;">
        <button class="action-btn-copy" title="Copy full path" data-path="${file.path.replace(/\\/g, '/')}">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
        </button>
      </td>
    `;

    // Copy path clipboard hook
    const copyBtn = tr.querySelector('.action-btn-copy');
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const path = copyBtn.getAttribute('data-path');
      navigator.clipboard.writeText(path).then(() => {
        showToast("Path copied to clipboard!");
      }).catch(err => {
        console.error("Failed to copy path: ", err);
      });
    });

    tbody.appendChild(tr);
  });
}

// Recursively calculate file type breakdown for the active folder node
function calculateFolderExtensionStats(node) {
  const stats = {};
  
  function traverse(currentNode) {
    if (!currentNode) return;
    if (!currentNode.is_dir) {
      const ext = getFileExtension(currentNode.name);
      stats[ext] = (stats[ext] || 0) + (currentNode.size || 0);
    } else if (currentNode.children) {
      currentNode.children.forEach(child => traverse(child));
    }
  }
  
  traverse(node);
  
  // Convert stats dictionary to sorted array
  const sortedStats = Object.entries(stats)
    .map(([ext, size]) => ({ ext, size }))
    .sort((a, b) => b.size - a.size);
  
  // Format it (top 15 extensions, rest grouped as others)
  const extensionsList = sortedStats.slice(0, 15);
  const otherSize = sortedStats.slice(15).reduce((sum, item) => sum + item.size, 0);
  if (otherSize > 0) {
    extensionsList.push({ ext: 'others', size: otherSize });
  }
  
  return extensionsList;
}

// Helper to get color gradient based on folder size ratio
function getIntensityColor(ratio) {
  // Interpolate Hue from 200 (cool cyan/blue) to 360 (hot red)
  // Use Math.pow(ratio, 0.7) to push mid-sized folders to warmer purple/magenta colors faster
  const hue = 200 + Math.pow(ratio, 0.7) * 160;
  return `hsl(${hue}, 100%, 60%)`;
}

// Generate the collapsible folder tree hierarchy using Apache ECharts
function renderFolderTree() {
  const chartDom = document.getElementById('folder-tree-chart');
  if (!chartDom) return;

  if (!currentFolderNode) return;

  // 1. Build a clean tree structure of folders with >= 1% weight
  let nodeIdCounter = 0;
  const rootSize = currentFolderNode.size || 1;
  const treeData = buildTreeData(currentFolderNode, 0, 3, rootSize);
  if (!treeData) {
    chartDom.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No directory data available for tree graph</div>`;
    return;
  }

  // 2. Initialize ECharts instance
  let treeChart = echarts.getInstanceByDom(chartDom);
  if (!treeChart) {
    treeChart = echarts.init(chartDom);
  }

  // 3. Define option configuration
  const parentSize = currentFolderNode.size || 1;
  const option = {
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove',
      backgroundColor: 'rgba(11, 12, 16, 0.95)',
      borderColor: 'rgba(255, 255, 255, 0.25)',
      borderWidth: 1,
      textStyle: {
        color: '#ffffff',
        fontFamily: 'Outfit, sans-serif',
        fontSize: 12
      },
      formatter: (params) => {
        return `<b>${params.data.name}</b><br/>Size: ${formatBytes(params.data.size)}<br/>Path: ${params.data.path}`;
      }
    },
    series: [
      {
        type: 'tree',
        data: [treeData],
        orient: 'BT', // Bottom to Top vertical orientation
        roam: true, // Enable panning and zooming
        top: '18%', // Margins to avoid labels clipping at top/bottom/sides
        bottom: '8%',
        left: '12%',
        right: '12%',
        nodePadding: 60, // Spacing between sibling nodes (increased to 60px for extra space)
        symbol: 'circle',
        symbolSize: (value, params) => {
          // Linear size difference for clear intensity feel (from 12px to 60px)
          const ratio = params.data.size / parentSize;
          return Math.max(12, 12 + ratio * 48);
        },
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.25)',
          width: 2,
          curveness: 0.5
        },
        label: {
          show: false, // HIDE LABELS BY DEFAULT to prevent overlap / clutter
          position: 'right',
          verticalAlign: 'middle',
          align: 'left',
          color: '#ffffff',
          fontSize: 12,
          fontFamily: 'Outfit, sans-serif',
          fontWeight: 600,
          distance: 10,
          formatter: (params) => {
            return `${params.name}\n(${formatBytes(params.data.size)})`;
          },
          lineHeight: 14
        },
        leaves: {
          label: {
            show: false, // HIDE LEAF LABELS BY DEFAULT
            position: 'top', // Labels for leaf nodes sit above the node when hovered
            verticalAlign: 'bottom',
            align: 'center',
            distance: 8
          }
        },
        emphasis: {
          label: {
            show: true // SHOW LABELS ONLY ON HOVER
          },
          lineStyle: {
            color: '#ffffff',
            width: 4
          }
        },
        expandAndCollapse: false, // Ensure nodes do not collapse on click (since click navigates)
        initialTreeDepth: 3
      }
    ]
  };

  treeChart.setOption(option);

  // 4. Set up click navigation
  treeChart.off('click');
  treeChart.on('click', (params) => {
    if (params.data && params.data.nodeRef) {
      navigateToFolder(params.data.nodeRef);
    }
  });

  // Resize listener
  window.addEventListener('resize', () => {
    treeChart.resize();
  });
}

// Helper to compile directory sub-nodes recursively
function buildTreeData(node, depth, maxDepth, rootSize) {
  if (!node || !node.is_dir || depth > maxDepth) return null;
  
  const ratio = node.size / rootSize;
  const color = getIntensityColor(ratio);
  
  const treeNode = {
    name: node.name,
    size: node.size,
    path: node.path,
    is_dir: true,
    itemStyle: {
      color: '#0b0c10',
      borderColor: color,
      borderWidth: 2.5
    },
    emphasis: {
      itemStyle: {
        color: color,
        borderColor: color,
        shadowBlur: 15,
        shadowColor: color
      }
    },
    children: []
  };
  
  // Save parent or node reference if needed
  treeNode.nodeRef = node;
  
  if (node.children) {
    // Only process subfolders that consume at least 1% of this folder's size
    const threshold = currentFolderNode.size * 0.01;
    node.children.forEach(child => {
      if (child.is_dir && child.size >= threshold) {
        const childTree = buildTreeData(child, depth + 1, maxDepth, rootSize);
        if (childTree) {
          treeNode.children.push(childTree);
        }
      }
    });
  }
  
  return treeNode;
}
