const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const getNeonAuth = () => {
    const orgId = process.env.NEON_ORG_ID;
    const apiKey = process.env.NEON_API_KEY;
    return Buffer.from(`${orgId}:${apiKey}`).toString('base64');
};

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// BULK FETCH: Pulls the first 200 accounts to build the lookup table
app.get('/discovery/bulk-accounts', async (req, res) => {
    try {
        const response = await fetch('https://api.neoncrm.com/v2/accounts?pageSize=200&userType=INDIVIDUAL', {
            headers: { 'Authorization': `Basic ${getNeonAuth()}` }
        });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.all('/api/*', async (req, res) => {
    try {
        const neonPath = req.path.replace('/api', '');
        const url = `https://api.neoncrm.com${neonPath}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;
        const fetchOptions = {
            method: req.method,
            headers: { 'Authorization': `Basic ${getNeonAuth()}`, 'Content-Type': 'application/json' }
        };
        if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
            fetchOptions.body = JSON.stringify(req.body);
        }
        const response = await fetch(url, fetchOptions);
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        res.status(500).json({ error: 'Neon API Connection Failed' });
    }
});

app.listen(port, () => console.log(`Neon Proxy active on port ${port}`));
