// Theme Setup
const themeToggle = document.getElementById('theme-toggle');
const htmlEl = document.documentElement;
const iconDark = document.getElementById('theme-icon-dark');
const iconLight = document.getElementById('theme-icon-light');

function setTheme(theme) {
    htmlEl.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    if (theme === 'light') {
        iconDark.style.display = 'none';
        iconLight.style.display = 'block';
    } else {
        iconDark.style.display = 'block';
        iconLight.style.display = 'none';
    }
}

const savedTheme = localStorage.getItem('theme') || 'dark';
setTheme(savedTheme);

themeToggle.addEventListener('click', () => {
    const currentTheme = htmlEl.getAttribute('data-theme');
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
});

// Clock
function updateClock() {
    document.getElementById('clock').textContent = new Date().toLocaleTimeString();
}
setInterval(updateClock, 1000);
updateClock();

// Modal Logic
const modal = document.getElementById('add-modal');
const btnAddDevice = document.getElementById('add-device-btn');
const btnCloseModal = document.getElementById('close-modal');
const formAddDevice = document.getElementById('add-device-form');

btnAddDevice.addEventListener('click', () => modal.classList.remove('hidden'));
btnCloseModal.addEventListener('click', () => modal.classList.add('hidden'));

formAddDevice.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('dev-name').value;
    const host = document.getElementById('dev-host').value;
    const type = document.getElementById('dev-type').value;

    try {
        const res = await fetch('/api/devices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, host, type })
        });
        if (res.ok) {
            modal.classList.add('hidden');
            formAddDevice.reset();
            fetchStatus(); // Refresh instantly
        } else {
            alert('Error adding device');
        }
    } catch (err) {
        console.error(err);
        alert('Network error');
    }
});

// Context Menu Logic
const contextMenu = document.getElementById('context-menu');
let currentContextHost = null;

document.addEventListener('click', () => {
    contextMenu.classList.add('hidden');
});

document.getElementById('menu-ping').addEventListener('click', async () => {
    if (!currentContextHost) return;
    try {
        const res = await fetch(`/api/ping/${currentContextHost}`, { method: 'POST' });
        if (res.ok) fetchStatus();
    } catch (e) {
        console.error("Ping error", e);
    }
});

// History Modal Logic
const historyModal = document.getElementById('history-modal');
const btnCloseHistoryModal = document.getElementById('close-history-modal');
const historyTableBody = document.getElementById('history-table-body');
const historyEmpty = document.getElementById('history-empty');

btnCloseHistoryModal.addEventListener('click', () => historyModal.classList.add('hidden'));

document.getElementById('menu-history').addEventListener('click', async () => {
    if (!currentContextHost) return;
    try {
        const res = await fetch(`/api/history/${currentContextHost}`);
        if (res.ok) {
            const historyData = await res.json();
            historyTableBody.innerHTML = '';
            
            if (historyData.length === 0) {
                historyTableBody.parentElement.style.display = 'none';
                historyEmpty.classList.remove('hidden');
            } else {
                historyTableBody.parentElement.style.display = 'table';
                historyEmpty.classList.add('hidden');
                
                // Reverse to show latest first
                historyData.slice().reverse().forEach(record => {
                    const tr = document.createElement('tr');
                    const eventClass = record.event === 'Downtime' ? 'event-down' : 'event-up';
                    
                    let durationText = '--';
                    if (record.durationMs) {
                        const seconds = Math.floor(record.durationMs / 1000);
                        if (seconds < 60) durationText = `${seconds}s`;
                        else {
                            const minutes = Math.floor(seconds / 60);
                            durationText = `${minutes}m ${seconds % 60}s`;
                        }
                    }
                    
                    tr.innerHTML = `
                        <td class="${eventClass}">${record.event}</td>
                        <td>${new Date(record.time).toLocaleString()}</td>
                        <td>${durationText}</td>
                    `;
                    historyTableBody.appendChild(tr);
                });
            }
            historyModal.classList.remove('hidden');
        }
    } catch (e) {
        console.error("Fetch history error", e);
    }
});

document.getElementById('menu-delete').addEventListener('click', async () => {
    if (!currentContextHost) return;
    if (confirm(`Are you sure you want to delete ${currentContextHost}?`)) {
        try {
            const res = await fetch(`/api/devices/${currentContextHost}`, { method: 'DELETE' });
            if (res.ok) fetchStatus();
        } catch (e) {
            console.error("Delete error", e);
        }
    }
});

// Fetching & Rendering Status
async function fetchStatus() {
    try {
        const response = await fetch('/api/status');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        renderServers(data);
    } catch (error) {
        console.error('Failed to fetch status:', error);
        document.getElementById('global-status-text').textContent = 'UPLINK_ERR';
        document.querySelector('.indicator').className = 'indicator global-down';
    }
}

function getIconForType(type) {
    if (type === 'router') return 'images/router.png';
    if (type === 'switch') return 'images/switch.png';
    return 'images/server.png'; // default
}

function renderServers(servers) {
    const grid = document.getElementById('server-grid');
    grid.innerHTML = ''; 

    let allUp = true;

    servers.forEach(server => {
        if (server.status !== 'Up') allUp = false;

        const isUp = server.status === 'Up';
        const isDown = server.status === 'Down';
        
        let statusClass = 'unknown';
        if (isUp) statusClass = 'up';
        if (isDown) statusClass = 'down';

        const card = document.createElement('div');
        card.className = `server-card status-${statusClass}`;
        
        // Context menu event
        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            currentContextHost = server.host;
            contextMenu.style.left = `${e.pageX}px`;
            contextMenu.style.top = `${e.pageY}px`;
            contextMenu.classList.remove('hidden');
        });

        const lastCheckedStr = server.lastChecked 
            ? new Date(server.lastChecked).toLocaleTimeString() 
            : 'PENDING';

        const iconSrc = getIconForType(server.type);

        card.innerHTML = `
            <div class="card-header">
                <img src="${iconSrc}" class="device-icon" alt="${server.type}">
                <div class="server-info">
                    <h2 title="${server.name}">${server.name}</h2>
                    <p>${server.host}</p>
                </div>
                <div class="status-badge ${statusClass}">
                    <span class="indicator ${statusClass}"></span>
                    ${server.status.substring(0,3).toUpperCase()}
                </div>
            </div>
            
            <div class="card-metrics">
                <div>
                    <span class="metric-label">LATENCY</span>
                    <span class="metric-value ${isDown ? 'error' : ''}">${server.latency || '--'}</span>
                </div>
                <div>
                    <span class="metric-label">UPTIME</span>
                    <span class="metric-value">${isUp ? '100%' : (isDown ? '0%' : '--')}</span>
                </div>
            </div>

            <div class="card-footer">
                LST_CHK: ${lastCheckedStr}
            </div>
        `;
        
        grid.appendChild(card);
    });

    const globalText = document.getElementById('global-status-text');
    const globalIndicator = document.querySelector('.indicator');
    
    if (servers.length === 0) {
        globalText.textContent = 'NO_DEVICES';
        globalIndicator.className = 'indicator global-down';
    } else if (allUp) {
        globalText.textContent = 'SYS_NOMINAL';
        globalIndicator.className = 'indicator global-up';
    } else {
        globalText.textContent = 'SYS_WARN';
        globalIndicator.className = 'indicator global-down';
    }
}

fetchStatus();
setInterval(fetchStatus, 5000);
