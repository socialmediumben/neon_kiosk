const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Helper to generate the Neon Authorization header
const getNeonAuth = () => {
    const orgId = process.env.NEON_ORG_ID;
    const apiKey = process.env.NEON_API_KEY;
    if (!orgId || !apiKey) {
        console.error("Missing NEON_ORG_ID or NEON_API_KEY environment variables.");
    }
    return Buffer.from(`${orgId}:${apiKey}`).toString('base64');
};

// SERVE FRONTEND: This fixes the "Cannot GET /" error
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// DISCOVERY ROUTE: Visit https://neon-kiosk.onrender.com/discovery/fields
app.get('/discovery/fields', async (req, res) => {
    try {
        const response = await fetch('https://api.neoncrm.com/v2/customFields?category=Individual', {
            headers: { 'Authorization': `Basic ${getNeonAuth()}` }
        });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch fields: ' + err.message });
    }
});

// MAIN PROXY ROUTE: Forwards all /api/* requests to Neon CRM v2
app.all('/api/*', async (req, res) => {
    try {
        const neonPath = req.path.replace('/api', '');
        const url = `https://api.neoncrm.com${neonPath}`;
        
        const fetchOptions = {
            method: req.method,
            headers: {
                'Authorization': `Basic ${getNeonAuth()}`,
                'Content-Type': 'application/json'
            }
        };

        if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
            fetchOptions.body = JSON.stringify(req.body);
        }

        const response = await fetch(url, fetchOptions);
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        console.error("Proxy Error:", error);
        res.status(500).json({ error: 'Neon API Connection Failed' });
    }
});

app.listen(port, () => console.log(`Neon Proxy active on port ${port}`));
