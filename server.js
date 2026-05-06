const express = require('express');
const cors = require('cors');
const ping = require('ping');
const path = require('path');
const { sendAlertEmail } = require('./mailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

let servers = [];
try {
    servers = JSON.parse(process.env.SERVERS || '[]');
} catch (e) {
    console.error("Failed to parse SERVERS from .env", e);
}

// In-memory state
const serverStates = {};
servers.forEach(s => {
    serverStates[s.host] = {
        name: s.name,
        host: s.host,
        status: 'Unknown',
        latency: null,
        lastChecked: null,
        isDownAlertSent: false
    };
});

async function checkServers() {
    console.log(`[MONITOR] Pinging servers at ${new Date().toLocaleTimeString()}...`);
    for (const server of servers) {
        const state = serverStates[server.host];
        try {
            const res = await ping.promise.probe(server.host, {
                timeout: 3
            });

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
        } catch (err) {
            console.error(`[MONITOR] Error pinging ${server.host}:`, err);
            state.status = 'Error';
            state.latency = 'Error';
        }
    }
}

// Start monitoring loop
const PING_INTERVAL_MS = parseInt(process.env.PING_INTERVAL_MS) || 60000;
setInterval(checkServers, PING_INTERVAL_MS);

// Initial check
checkServers();

// API Endpoint for frontend
app.get('/api/status', (req, res) => {
    res.json(Object.values(serverStates));
});

// Update servers endpoint (optional functionality)
app.post('/api/servers', (req, res) => {
    // Basic placeholder for adding/updating servers on the fly
    res.json({ message: "Not implemented yet. Update .env for now." });
});

app.listen(PORT, () => {
    console.log(`🚀 Voice Server Monitor running on http://localhost:${PORT}`);
    console.log(`🕒 Ping interval set to ${PING_INTERVAL_MS / 1000} seconds.`);
});
