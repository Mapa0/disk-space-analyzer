// Global state
let scanData = null;
let currentFolderNode = null;
let navigationHistory = [];
let sortField = 'size'; // 'name' or 'size'
let sortDirection = 'desc'; // 'asc' or 'desc'

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

  // JSON upload file reader
  const jsonUpload = document.getElementById('json-upload');
  jsonUpload.addEventListener('change', handleJsonUpload);

  // Back button
  const btnBack = document.getElementById('btn-back');
  btnBack.addEventListener('click', navigateUp);

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
        const driveSelect = document.getElementById('drive-select');
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
    console.log("Could not auto-load scan_results.json (this is normal if running via file:// protocol). Please upload the file manually using the button.");
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

// Handle local file uploads
function handleJsonUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      // Reset dropdown select
      document.getElementById('drive-select').value = '';
      initializeDashboard(data);
    } catch (err) {
      alert("Error parsing JSON file. Please make sure it is a valid scanner output file.");
      console.error(err);
    }
  };
  reader.readAsText(file);
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

  // Load Folder Explorer
  renderFolderExplorer();

  // Load Extensions Chart
  renderExtensionChart(data.extension_stats);

  // Load Top Large Files List
  renderLargeFilesList(data.top_large_files);
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
  
  navigationHistory.push(currentFolderNode);
  currentFolderNode = folderNode;
  
  // Clear search input on folder change
  document.getElementById('search-input').value = '';
  
  renderFolderExplorer();
}

// Navigate up to parent folder
function navigateUp() {
  if (navigationHistory.length === 0) return;
  currentFolderNode = navigationHistory.pop();
  
  // Clear search input on folder change
  document.getElementById('search-input').value = '';
  
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
  
  // Clear search input on folder change
  document.getElementById('search-input').value = '';
  
  renderFolderExplorer();
}

// Build breadcrumbs path representation
function renderBreadcrumbs() {
  const container = document.getElementById('breadcrumbs');
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
    // separator
    const sep = document.createElement('span');
    sep.className = 'breadcrumb-separator';
    sep.textContent = '>';
    container.appendChild(sep);

    // item
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
  document.getElementById('btn-back').disabled = (navigationHistory.length === 0);
}

// Sort active children based on state
function getSortedChildren(node, filterQuery = '') {
  if (!node || !node.children) return [];

  let items = [...node.children];

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
        showToast();
      }).catch(err => {
        console.error("Failed to copy path: ", err);
      });
    });

    tbody.appendChild(tr);
  });
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
function renderExtensionChart(extensionStats) {
  const svg = document.getElementById('extension-chart');
  const legendContainer = document.getElementById('chart-legend');
  
  // Clear previous children except background circle
  while (svg.childNodes.length > 2) {
    svg.removeChild(svg.lastChild);
  }
  legendContainer.innerHTML = '';

  if (!extensionStats || extensionStats.length === 0) {
    return;
  }

  // Calculate total extension size to determine slices percentage
  const totalExtSize = extensionStats.reduce((sum, item) => sum + item.size, 0);
  if (totalExtSize === 0) return;

  const radius = 60;
  const circumference = 2 * Math.PI * radius; // ~376.99
  let accumulatedPercent = 0;

  extensionStats.forEach((item, index) => {
    const color = EXTENSION_COLORS[index % EXTENSION_COLORS.length];
    const percent = (item.size / totalExtSize) * 100;
    
    // Draw SVG circle slice if percentage is significant
    if (percent > 0.1) {
      const circleSlice = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circleSlice.setAttribute('cx', '100');
      circleSlice.setAttribute('cy', '100');
      circleSlice.setAttribute('r', radius.toString());
      circleSlice.setAttribute('fill', 'transparent');
      circleSlice.setAttribute('stroke', color);
      circleSlice.setAttribute('stroke-width', '20');
      circleSlice.className.baseVal = 'donut-segment';

      // Dash offset and size
      const dashSize = (percent / 100) * circumference;
      const gapSize = circumference - dashSize;
      circleSlice.setAttribute('stroke-dasharray', `${dashSize} ${gapSize}`);
      
      // Calculate rotation based on cumulative percentage
      const startAngle = (accumulatedPercent * 3.6) - 90;
      circleSlice.setAttribute('transform', `rotate(${startAngle}, 100, 100)`);
      
      // Hover tooltip effect
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${item.ext}: ${formatBytes(item.size)} (${percent.toFixed(1)}%)`;
      circleSlice.appendChild(title);

      svg.appendChild(circleSlice);
    }

    // Build Legend item
    const legendItem = document.createElement('div');
    legendItem.className = 'legend-item';
    legendItem.innerHTML = `
      <div class="legend-color" style="background-color: ${color}"></div>
      <span class="legend-name" title="${item.ext}">${item.ext}</span>
      <span class="legend-val">${formatBytes(item.size)}</span>
    `;
    legendContainer.appendChild(legendItem);

    accumulatedPercent += percent;
  });
}

// Render Top 100 files scrollbar list
function renderLargeFilesList(topFiles) {
  const container = document.getElementById('large-files-list');
  container.innerHTML = '';

  if (!topFiles || topFiles.length === 0) {
    container.innerHTML = `<li style="text-align: center; color: var(--text-muted); padding: 1rem;">No large files recorded</li>`;
    return;
  }

  topFiles.forEach(file => {
    const li = document.createElement('li');
    li.className = 'large-file-item';
    li.innerHTML = `
      <div class="large-file-details">
        <div class="large-file-title" title="${file.name}">${file.name}</div>
        <div class="large-file-path" title="${file.path}">${file.path}</div>
      </div>
      <div class="large-file-size">${formatBytes(file.size)}</div>
      <button class="action-btn-copy" title="Copy full path" data-path="${file.path.replace(/\\/g, '/')}">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
        </svg>
      </button>
    `;

    // Copy path clipboard hook
    const copyBtn = li.querySelector('.action-btn-copy');
    copyBtn.addEventListener('click', (e) => {
      const path = copyBtn.getAttribute('data-path');
      navigator.clipboard.writeText(path).then(() => {
        showToast();
      }).catch(err => {
        console.error("Failed to copy path: ", err);
      });
    });

    container.appendChild(li);
  });
}

// Show copying path notification
function showToast() {
  const toast = document.getElementById('toast');
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}
