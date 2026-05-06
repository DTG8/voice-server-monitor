function updateClock() {
    const now = new Date();
    document.getElementById('clock').textContent = now.toLocaleTimeString();
}
setInterval(updateClock, 1000);
updateClock();

async function fetchStatus() {
    try {
        const response = await fetch('/api/status');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        renderServers(data);
    } catch (error) {
        console.error('Failed to fetch status:', error);
        document.getElementById('global-status-text').textContent = 'Connection Lost';
        document.querySelector('.indicator').className = 'indicator global-down';
    }
}

function renderServers(servers) {
    const grid = document.getElementById('server-grid');
    grid.innerHTML = ''; // Clear loading or previous state

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
        
        const lastCheckedStr = server.lastChecked 
            ? new Date(server.lastChecked).toLocaleTimeString() 
            : 'Never';

        card.innerHTML = `
            <div class="card-header">
                <div class="server-info">
                    <h2>${server.name}</h2>
                    <p>${server.host}</p>
                </div>
                <div class="status-badge ${statusClass}">
                    <span class="indicator ${statusClass}"></span>
                    ${server.status.toUpperCase()}
                </div>
            </div>
            
            <div class="card-metrics">
                <div class="metric">
                    <span class="metric-label">Latency</span>
                    <span class="metric-value ${isDown ? 'error' : ''}">${server.latency || '--'}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Uptime</span>
                    <span class="metric-value">${isUp ? '100%' : (isDown ? '0%' : '--')}</span>
                </div>
            </div>

            <div class="card-footer">
                Last checked: ${lastCheckedStr}
            </div>
        `;
        
        grid.appendChild(card);
    });

    // Update global status
    const globalText = document.getElementById('global-status-text');
    const globalIndicator = document.querySelector('.indicator');
    
    if (servers.length === 0) {
        globalText.textContent = 'No Servers Configured';
        globalIndicator.className = 'indicator global-down';
    } else if (allUp) {
        globalText.textContent = 'All Systems Operational';
        globalIndicator.className = 'indicator global-up';
    } else {
        globalText.textContent = 'System Disruptions Detected';
        globalIndicator.className = 'indicator global-down';
    }
}

// Initial fetch and set interval for polling every 5 seconds
fetchStatus();
setInterval(fetchStatus, 5000);
