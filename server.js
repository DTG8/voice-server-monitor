const express = require('express');
const cors = require('cors');
const ping = require('ping');
const path = require('path');
const fs = require('fs');
const { sendAlertEmail } = require('./mailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}
const devicesFile = path.join(dataDir, 'devices.json');

// Initialize devices file if not exists
if (!fs.existsSync(devicesFile)) {
    fs.writeFileSync(devicesFile, JSON.stringify([]));
}

let servers = [];
try {
    servers = JSON.parse(fs.readFileSync(devicesFile, 'utf8'));
} catch (e) {
    console.error("Failed to parse devices.json", e);
    servers = [];
}

// In-memory state
const serverStates = {};

function initServerState(s) {
    if (!serverStates[s.host]) {
        serverStates[s.host] = {
            name: s.name,
            host: s.host,
            type: s.type || 'server',
            status: 'Unknown',
            latency: null,
            lastChecked: null,
            isDownAlertSent: false
        };
    } else {
        // Update name and type if changed
        serverStates[s.host].name = s.name;
        serverStates[s.host].type = s.type || 'server';
    }
}

servers.forEach(initServerState);

async function pingHost(host) {
    try {
        return await ping.promise.probe(host, { timeout: 3 });
    } catch (err) {
        console.error(`[MONITOR] Error pinging ${host}:`, err);
        return { alive: false, time: 'unknown' };
    }
}

async function checkServers() {
    console.log(`[MONITOR] Pinging servers at ${new Date().toLocaleTimeString()}...`);
    for (const server of servers) {
        const state = serverStates[server.host];
        if (!state) continue;

        const res = await pingHost(server.host);
        state.lastChecked = new Date().toISOString();
        
        if (res.alive) {
            state.status = 'Up';
            state.latency = res.time === 'unknown' ? 'N/A' : res.time + ' ms';
            
            // If it was down and now is up, send recovery email
            if (state.isDownAlertSent) {
                await sendAlertEmail(server, 'Up');
                state.isDownAlertSent = false;
            }
        } else {
            state.status = 'Down';
            state.latency = 'Timeout';
            
            // If it wasn't marked down already, send alert
            if (!state.isDownAlertSent) {
                await sendAlertEmail(server, 'Down');
                state.isDownAlertSent = true;
            }
        }
    }
}

// Start monitoring loop
const PING_INTERVAL_MS = parseInt(process.env.PING_INTERVAL_MS) || 60000;
setInterval(checkServers, PING_INTERVAL_MS);

// Initial check
checkServers();

// --- API Endpoints ---

app.get('/api/status', (req, res) => {
    // Return only states for currently configured servers
    const currentStates = servers.map(s => serverStates[s.host]);
    res.json(currentStates);
});

app.post('/api/devices', (req, res) => {
    const { name, host, type } = req.body;
    if (!name || !host) {
        return res.status(400).json({ error: "Name and host are required" });
    }

    const existingIndex = servers.findIndex(s => s.host === host);
    const newDevice = { name, host, type: type || 'server' };

    if (existingIndex >= 0) {
        servers[existingIndex] = newDevice;
    } else {
        servers.push(newDevice);
    }

    fs.writeFileSync(devicesFile, JSON.stringify(servers, null, 2));
    initServerState(newDevice);
    
    // Trigger an immediate check for this new device in the background
    pingHost(host).then(pingRes => {
        const state = serverStates[host];
        state.lastChecked = new Date().toISOString();
        if (pingRes.alive) {
            state.status = 'Up';
            state.latency = pingRes.time === 'unknown' ? 'N/A' : pingRes.time + ' ms';
        } else {
            state.status = 'Down';
            state.latency = 'Timeout';
        }
    });

    res.json({ message: "Device added/updated successfully", device: newDevice });
});

app.delete('/api/devices/:host', (req, res) => {
    const host = req.params.host;
    const initialLength = servers.length;
    servers = servers.filter(s => s.host !== host);
    
    if (servers.length < initialLength) {
        fs.writeFileSync(devicesFile, JSON.stringify(servers, null, 2));
        delete serverStates[host];
        res.json({ message: "Device deleted successfully" });
    } else {
        res.status(404).json({ error: "Device not found" });
    }
});

app.post('/api/ping/:host', async (req, res) => {
    const host = req.params.host;
    const state = serverStates[host];
    
    if (!state) {
        return res.status(404).json({ error: "Device not configured" });
    }

    const pingRes = await pingHost(host);
    state.lastChecked = new Date().toISOString();
    
    if (pingRes.alive) {
        state.status = 'Up';
        state.latency = pingRes.time === 'unknown' ? 'N/A' : pingRes.time + ' ms';
    } else {
        state.status = 'Down';
        state.latency = 'Timeout';
    }

    res.json(state);
});

app.listen(PORT, () => {
    console.log(`🚀 Voice Server Monitor running on http://localhost:${PORT}`);
    console.log(`🕒 Ping interval set to ${PING_INTERVAL_MS / 1000} seconds.`);
});
