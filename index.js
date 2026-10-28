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

// Serve everything else, like discovery.html
app.use(express.static(__dirname));

// Neon One Constituent OAuth Token Exchange
const NEON_OAUTH_CLIENT_ID = process.env.NEON_OAUTH_CLIENT_ID || 'QBY_hNyRYp1-aVKwOmQ8ELY6tCd6vW2KJ00k57X3hWCY1wsiz87dFfD7lT7hVgqiyjsBkw8VUPJoOuBy0xVnfg==';
const NEON_OAUTH_CLIENT_SECRET = process.env.NEON_OAUTH_CLIENT_SECRET || 'ab489c86-81c7-3a9d-a2a8-82a5e95e3ae8';
const NEON_OAUTH_TOKEN_URL = 'https://socialmedium.app.neoncrm.com/nx/auth/oauth/token';

app.post('/api/oauth/token', async (req, res) => {
    try {
        const { code, redirect_uri } = req.body;
        if (!code) {
            return res.status(400).json({ error: 'Authorization code is required' });
        }

        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('client_id', NEON_OAUTH_CLIENT_ID);
        params.append('client_secret', NEON_OAUTH_CLIENT_SECRET);
        params.append('code', code);
        params.append('redirect_uri', redirect_uri || 'https://app.socialmedium.space/auth/callback');

        const tokenUrl = `${NEON_OAUTH_TOKEN_URL}?${params.toString()}`;

        const tokenResponse = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/json'
            }
        });

        const text = await tokenResponse.text();
        try {
            const data = JSON.parse(text);
            return res.status(tokenResponse.status).json(data);
        } catch (e) {
            return res.status(tokenResponse.status).send(text);
        }
    } catch (err) {
        console.error('OAuth token exchange error:', err);
        return res.status(500).json({ error: 'OAuth exchange failed', message: err.message });
    }
});

// Full API Proxy for direct account lookups and check-in activities
app.all('/api/*', async (req, res) => {
    try {
        const neonPath = req.path.replace('/api', '');
        const url = `https://api.neoncrm.com${neonPath}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;
        
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
        const text = await response.text();
        try {
            const data = JSON.parse(text);
            res.status(response.status).json(data);
        } catch (e) {
            res.status(response.status).send(text);
        }
    } catch (error) {
        console.error("Proxy Error:", error.message);
        res.status(500).json({ error: 'Neon API Connection Failed', message: error.message });
    }
});

app.listen(port, () => console.log(`Kiosk Proxy active on port ${port}`));
