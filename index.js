require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const app = express();
const port = process.env.PORT || 3000;
let activeCronJob = null;

app.use(cors());
app.use(express.json());

// Neon CRM Auth & Endpoints
const getNeonAuth = () => {
    const orgId = process.env.NEON_ORG_ID;
    const apiKey = process.env.NEON_API_KEY;
    return Buffer.from(`${orgId}:${apiKey}`).toString('base64');
};
const getNeonApiUrl = () => process.env.NEON_API_URL || 'https://api.neoncrm.com/v2';

// Serve Kiosk Front-End
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
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
        params.append('redirect_uri', redirect_uri || 'https://app.socialmedium.space/auth/callback/');

        const tokenUrl = `${NEON_OAUTH_TOKEN_URL}?${params.toString()}`;
        console.log(`[OAuth] Exchanging code for token with redirect_uri: ${redirect_uri || 'https://app.socialmedium.space/auth/callback/'}`);

        const tokenResponse = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/json'
            }
        });

        const text = await tokenResponse.text();
        console.log(`[OAuth] Neon response status: ${tokenResponse.status}, body: ${text}`);
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

// ============================================================================
// Announcements API (Community Noticeboard for Social Medium App)
// ============================================================================
const ANNOUNCEMENT_FILE = path.join(__dirname, 'announcement.json');

const DEFAULT_ANNOUNCEMENT = {
    id: 'sm-announcement-default',
    title: 'Welcome to Social Medium!',
    message: 'Welcome to the official Social Medium Makerspace app! Check out upcoming events, view your tool certifications, and keep your profile up to date.',
    author: 'Ben Braunstein',
    updatedAt: new Date().toISOString(),
    active: true
};

const getStoredAnnouncement = () => {
    try {
        if (fs.existsSync(ANNOUNCEMENT_FILE)) {
            const raw = fs.readFileSync(ANNOUNCEMENT_FILE, 'utf8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.error('[Announcement] Error reading announcement.json:', e);
    }
    return DEFAULT_ANNOUNCEMENT;
};

const saveStoredAnnouncement = (data) => {
    try {
        fs.writeFileSync(ANNOUNCEMENT_FILE, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error('[Announcement] Error writing announcement.json:', e);
        return false;
    }
};

app.get('/api/announcement', (req, res) => {
    const announcement = getStoredAnnouncement();
    res.json({ success: true, announcement });
});

app.post('/api/announcement', (req, res) => {
    try {
        const { title, message, author, active } = req.body;
        if (!title || !message) {
            return res.status(400).json({ success: false, error: 'Title and message are required.' });
        }
        const current = getStoredAnnouncement();
        const updated = {
            id: current.id || 'sm-announcement-' + Date.now(),
            title: String(title).trim(),
            message: String(message).trim(),
            author: author ? String(author).trim() : (current.author || 'Makerspace Staff'),
            updatedAt: new Date().toISOString(),
            active: active !== undefined ? Boolean(active) : true
        };
        saveStoredAnnouncement(updated);
        console.log(`[Announcement] Updated by ${updated.author}: "${updated.title}"`);
        res.json({ success: true, announcement: updated });
    } catch (err) {
        console.error('[Announcement] Failed to save announcement:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================================================
// Neon CRM Activities Intelligence Dashboard Backend Routes
// ============================================================================

// Mock Data Generator
const generateMockActivities = () => {
    const subjects = [
        'Membership Renewal Welcome Call',
        'Follow up on Annual Gala Ticket Purchase',
        'Major Donor Coffee Meeting',
        'Volunteer Orientation Follow-up',
        'Corporate Sponsorship Outreach',
        'Inquiry about Monthly Giving Circle',
        'Stewardship Call - 5 Year Donor Anniversary',
        'Legacy Gift Inquiry Response',
        'Website Feedback Intake Call',
        'Newsletter Unsubscribe Retention Call',
        'Thank You Call - First Time Donation',
        'Board Meeting Agenda Review',
        'Fall Festival Volunteer Recruitment',
        'End of Year Campaign Prep Meeting'
    ];

    const types = ['Phone Call', 'Email', 'Meeting', 'Task', 'Letter', 'Event'];
    const statuses = ['Pending', 'Completed', 'In Progress', 'Deferred', 'Cancelled'];
    const priorities = ['High', 'Normal', 'Low'];
    const members = [
        { id: '10982', name: 'Alice Henderson' },
        { id: '10432', name: 'Robert Chen' },
        { id: '10283', name: 'Samantha Carter' },
        { id: '10741', name: 'James Peterson' },
        { id: '10512', name: 'Marcus Aurelius' },
        { id: '10884', name: 'Elena Rostova' },
        { id: '11023', name: 'David Beckham' }
    ];
    const staff = ['Sarah Jenkins', 'Michael Chang', 'Emily Rodriguez', 'David Kim'];
    const notes = [
        'Spoke on phone, very excited to renew membership next month.',
        'Sent follow up email with Gala details and parking directions.',
        'Discussed corporate giving pathways and sponsor benefits.',
        'Completed orientation registration, scheduled first shift.',
        'Voicemail left. Will call back in 3 business days.',
        'Constituent expressed interest in legacy giving, requested brochure.',
        'Verified updated address and email details during conversation.',
        'Meeting rescheduled to next Friday at 10:00 AM.'
    ];

    const mockList = [];
    const now = new Date();

    for (let i = 0; i < 45; i++) {
        const activityDate = new Date();
        const offsetDays = Math.floor(Math.random() * 37) - 30; // -30 to +7 days
        activityDate.setDate(now.getDate() + offsetDays);

        const isPast = activityDate < now;
        let status = 'Pending';
        if (isPast) {
            status = Math.random() > 0.3 ? 'Completed' : (Math.random() > 0.5 ? 'Deferred' : 'Pending');
        } else {
            status = Math.random() > 0.8 ? 'Completed' : 'Pending';
        }

        const member = members[Math.floor(Math.random() * members.length)];
        const priority = priorities[Math.floor(Math.random() * priorities.length)];

        mockList.push({
            'Activity ID': (20450 + i).toString(),
            'Activity Subject': subjects[Math.floor(Math.random() * subjects.length)],
            'Activity Date': activityDate.toISOString().split('T')[0],
            'Status': status,
            'Priority': priority,
            'Activity Type': types[Math.floor(Math.random() * types.length)],
            'Client ID': member.id,
            'Client Name': member.name,
            'Created By': staff[Math.floor(Math.random() * staff.length)],
            'Activity Note': notes[Math.floor(Math.random() * notes.length)]
        });
    }

    return mockList.sort((a, b) => new Date(b['Activity Date']) - new Date(a['Activity Date']));
};

// Update .env file helper
const updateEnvFile = (config) => {
    try {
        const envPath = path.join(__dirname, '.env');
        let envContent = '';
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }

        const lines = envContent.split('\n');
        const updatedKeys = new Set();

        const newLines = lines.map(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return line;
            const parts = trimmed.split('=');
            const key = parts[0].trim();
            if (config.hasOwnProperty(key)) {
                updatedKeys.add(key);
                return `${key}=${config[key]}`;
            }
            return line;
        });

        Object.keys(config).forEach(key => {
            if (!updatedKeys.has(key)) {
                newLines.push(`${key}=${config[key]}`);
            }
        });

        fs.writeFileSync(envPath, newLines.join('\n'), 'utf8');
    } catch (_) {}

    // Update in memory
    Object.keys(config).forEach(key => {
        process.env[key] = config[key];
    });
};

// API: Status and Config Check
app.get('/api/status', async (req, res) => {
    const isNeonConfigured = !!(process.env.NEON_ORG_ID && process.env.NEON_API_KEY);
    const isSMTPConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

    let apiConnectionValid = false;
    let apiErrorMessage = '';

    if (isNeonConfigured) {
        try {
            const auth = getNeonAuth();
            const response = await fetch(`${getNeonApiUrl()}/activities/search/searchFields`, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'NEON-API-VERSION': '2.11',
                    'Content-Type': 'application/json'
                },
                signal: AbortSignal.timeout(5000)
            });

            if (response.ok) {
                apiConnectionValid = true;
            } else {
                apiErrorMessage = `API returned HTTP ${response.status} (${response.statusText})`;
            }
        } catch (err) {
            apiErrorMessage = `Connection failed: ${err.message}`;
        }
    }

    res.json({
        neonConfigured: isNeonConfigured,
        smtpConfigured: isSMTPConfigured,
        apiConnectionValid,
        apiErrorMessage,
        config: {
            neonOrgId: process.env.NEON_ORG_ID || '',
            neonApiUrl: getNeonApiUrl(),
            smtpHost: process.env.SMTP_HOST || '',
            smtpPort: process.env.SMTP_PORT || '587',
            smtpSecure: process.env.SMTP_SECURE === 'true',
            smtpUser: process.env.SMTP_USER || '',
            emailFrom: process.env.EMAIL_FROM || 'Neon CRM Dashboard <noreply@yourdomain.com>',
            emailRecipient: process.env.EMAIL_RECIPIENT || '',
            emailSchedule: process.env.EMAIL_SCHEDULE || '0 8 * * *',
            emailEnabled: process.env.EMAIL_ENABLED === 'true',
            emailReportType: process.env.EMAIL_REPORT_TYPE || 'all'
        }
    });
});

// API: Update Config
app.post('/api/config', (req, res) => {
    try {
        const {
            neonOrgId,
            neonApiKey,
            neonApiUrl,
            smtpHost,
            smtpPort,
            smtpSecure,
            smtpUser,
            smtpPass,
            emailFrom,
            emailRecipient,
            emailSchedule,
            emailEnabled,
            emailReportType
        } = req.body;

        const newConfig = {};
        if (neonOrgId !== undefined) newConfig.NEON_ORG_ID = neonOrgId.trim();
        if (neonApiKey !== undefined) newConfig.NEON_API_KEY = neonApiKey.trim();
        if (neonApiUrl !== undefined) newConfig.NEON_API_URL = neonApiUrl.trim();
        if (smtpHost !== undefined) newConfig.SMTP_HOST = smtpHost.trim();
        if (smtpPort !== undefined) newConfig.SMTP_PORT = smtpPort.toString();
        if (smtpSecure !== undefined) newConfig.SMTP_SECURE = smtpSecure.toString();
        if (smtpUser !== undefined) newConfig.SMTP_USER = smtpUser.trim();
        if (smtpPass !== undefined) newConfig.SMTP_PASS = smtpPass.trim();
        if (emailFrom !== undefined) newConfig.EMAIL_FROM = emailFrom.trim();
        if (emailRecipient !== undefined) newConfig.EMAIL_RECIPIENT = emailRecipient.trim();
        if (emailSchedule !== undefined) newConfig.EMAIL_SCHEDULE = emailSchedule.trim();
        if (emailEnabled !== undefined) newConfig.EMAIL_ENABLED = emailEnabled.toString();
        if (emailReportType !== undefined) newConfig.EMAIL_REPORT_TYPE = emailReportType.trim();

        updateEnvFile(newConfig);
        initializeScheduler();

        res.json({ success: true, message: 'Configuration updated successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: `Failed to update configuration: ${err.message}` });
    }
});

// API: Fetch Events with Attendee Counts
app.get('/api/events', async (req, res) => {
    if (!process.env.NEON_ORG_ID || !process.env.NEON_API_KEY) {
        return res.status(503).json({ success: false, message: 'Neon CRM API not configured.' });
    }

    try {
        const auth = getNeonAuth();
        const apiBase = getNeonApiUrl();

        const searchFields = [];
        if (req.query.after) {
            searchFields.push({ field: 'Event Start Date', operator: 'GREATER_AND_EQUAL', value: req.query.after });
        }
        if (req.query.before) {
            searchFields.push({ field: 'Event Start Date', operator: 'LESS_AND_EQUAL', value: req.query.before });
        }
        if (searchFields.length === 0) {
            searchFields.push({ field: 'Event Start Date', operator: 'GREATER_THAN', value: '1970-01-01' });
        }

        let currentPage = 0;
        let totalPages = 1;
        let rawResults = [];

        while (currentPage < totalPages) {
            const response = await fetch(`${apiBase}/events/search`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'NEON-API-VERSION': '2.11',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    searchFields,
                    outputFields: [
                        'Event ID',
                        'Event Name',
                        'Event Start Date',
                        'Event End Date',
                        'Event Capacity',
                        'Event Category Name',
                        'Event Registration Attendee Count',
                        'Registrants',
                        'Marked Attended'
                    ],
                    pagination: {
                        currentPage,
                        pageSize: 200,
                        sortColumn: 'Event Start Date',
                        sortDirection: 'DESC'
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Neon API Error: HTTP ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            rawResults = rawResults.concat(data.searchResults || []);
            totalPages = data.pagination ? data.pagination.totalPages : 1;
            currentPage++;
            if (currentPage >= 10) break;
        }

        const events = rawResults.map(item => ({
            'Event ID': item['Event ID'] || '',
            'Event Name': item['Event Name'] || 'Untitled Event',
            'Event Date': item['Event Start Date'] || '',
            'Event End Date': item['Event End Date'] || '',
            'Category': item['Event Category Name'] || '',
            'Capacity': item['Event Capacity'] ? parseInt(item['Event Capacity']) : null,
            'Registrants': parseInt(item['Registrants'] || item['Event Registration Attendee Count'] || '0', 10),
            'Attended': parseInt(item['Marked Attended'] || '0', 10)
        }));

        console.log(`✅ [Events API] Fetched ${events.length} events.`);
        res.json({ success: true, events });
    } catch (err) {
        console.error('❌ [Events API] Error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// API: Fetch Activities (Real or Mock)
app.get('/api/activities', async (req, res) => {
    const isMock = req.query.mock === 'true' || !process.env.NEON_ORG_ID || !process.env.NEON_API_KEY;
    const reportType = req.query.report || 'all';

    if (isMock) {
        const activities = generateMockActivities();
        let filtered = [...activities];
        if (req.query.status) {
            filtered = filtered.filter(a => a.Status.toLowerCase() === req.query.status.toLowerCase());
        }
        if (req.query.priority) {
            filtered = filtered.filter(a => a.Priority.toLowerCase() === req.query.priority.toLowerCase());
        }

        if (reportType === 'staff-activity') {
            filtered = filtered.filter(a => {
                const subject = a['Activity Subject'] || '';
                const type = a['Activity Type'] || '';
                return !subject.toLowerCase().includes('check-in') && type.toLowerCase() !== 'check-in';
            });
        }

        return res.json({
            searchResults: filtered,
            pagination: {
                currentPage: 0,
                pageSize: 100,
                totalResults: filtered.length,
                totalPages: 1
            },
            mock: true
        });
    }

    try {
        const auth = getNeonAuth();
        const apiBase = getNeonApiUrl();
        const searchFields = [];

        if (req.query.status) {
            searchFields.push({
                field: 'Activity Status',
                operator: 'EQUAL',
                value: req.query.status
            });
        }
        if (req.query.priority) {
            searchFields.push({
                field: 'Activity Priority',
                operator: 'EQUAL',
                value: req.query.priority
            });
        }

        if (reportType === 'staff-activity') {
            searchFields.push({
                field: 'Activity Solicitation Method',
                operator: 'NOT_EQUAL',
                value: 'Check-In'
            });
        } else {
            if (searchFields.length === 0) {
                searchFields.push({
                    field: 'Activity Start Date',
                    operator: 'GREATER_THAN',
                    value: '1970-01-01'
                });
            }
        }

        let currentPage = 0;
        let totalPages = 1;
        let rawResults = [];

        while (currentPage < totalPages) {
            const body = {
                searchFields,
                outputFields: [
                    'Activity ID',
                    'Activity Subject',
                    'Activity Start Date',
                    'Activity Status',
                    'Activity Priority',
                    'Activity System User',
                    'Activity Contact Account ID',
                    'Account Name',
                    'Activity Solicitation Method',
                    'Activity Note'
                ],
                pagination: {
                    currentPage,
                    pageSize: 200,
                    sortColumn: 'Activity Start Date',
                    sortDirection: 'DESC'
                }
            };

            await sleep(1100);
            let attempts = 3;
            let response;
            while (attempts > 0) {
                response = await fetch(`${apiBase}/activities/search`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'NEON-API-VERSION': '2.11',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                });

                if (response.status === 429) {
                    attempts--;
                    const backoff = 2000 * (3 - attempts);
                    console.warn(`⚠️ [Activities API] Rate limited, retrying in ${backoff}ms (${attempts} attempts left)`);
                    await sleep(backoff);
                    continue;
                }
                break;
            }

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Neon API Error: HTTP ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            rawResults = rawResults.concat(data.searchResults || []);
            totalPages = data.pagination ? data.pagination.totalPages : 1;
            currentPage++;
            if (currentPage >= 15) break;
        }

        let searchResults = rawResults.map(item => ({
            'Activity ID': item['Activity ID'] || '',
            'Activity Subject': item['Activity Subject'] || 'Untitled Activity',
            'Activity Date': item['Activity Start Date'] || '',
            'Status': item['Activity Status'] || 'Pending',
            'Priority': item['Activity Priority'] || 'Normal',
            'Activity Type': item['Activity Solicitation Method'] || 'Activity',
            'Client ID': item['Activity Contact Account ID'] || '',
            'Client Name': item['Account Name'] || '',
            'Created By': item['Activity System User'] || '',
            'Activity Note': item['Activity Note'] || ''
        }));

        if (reportType === 'staff-activity') {
            searchResults = searchResults.filter(item => {
                const subject = item['Activity Subject'] || '';
                return !subject.toLowerCase().includes('check-in');
            });
        }

        res.json({
            searchResults,
            pagination: {
                currentPage: 0,
                pageSize: 100,
                totalResults: searchResults.length,
                totalPages: 1
            },
            mock: false
        });
    } catch (err) {
        console.error('❌ [Activities API] Error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Compile HTML email report helper
const compileEmailHTML = (activities) => {
    const total = activities.length;
    const completed = activities.filter(a => a.Status.toLowerCase() === 'completed').length;
    const pending = activities.filter(a => a.Status.toLowerCase() === 'pending' || a.Status.toLowerCase() === 'in progress').length;
    
    const now = new Date();
    now.setHours(0,0,0,0);
    const overdue = activities.filter(a => {
        const isPending = a.Status.toLowerCase() === 'pending' || a.Status.toLowerCase() === 'in progress';
        const isPast = new Date(a['Activity Date']) < now;
        return isPending && isPast;
    }).length;

    const criticalActivities = activities
        .filter(a => a.Status.toLowerCase() !== 'completed' && a.Status.toLowerCase() !== 'cancelled')
        .slice(0, 12);

    let tableRows = '';
    if (criticalActivities.length === 0) {
        tableRows = '<tr><td colspan="5" style="padding: 15px; text-align: center; color: #888;">No pending or critical activities found.</td></tr>';
    } else {
        criticalActivities.forEach(a => {
            const isOverdue = new Date(a['Activity Date']) < now;
            const dateColor = isOverdue ? '#ff3b30' : '#333';
            const dateWeight = isOverdue ? 'bold' : 'normal';
            
            let priorityBadge = '';
            if (a.Priority.toLowerCase() === 'high') {
                priorityBadge = `<span style="background-color: #ffebeb; color: #ff3b30; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; border: 1px solid #ffd1d1;">High</span>`;
            } else if (a.Priority.toLowerCase() === 'low') {
                priorityBadge = `<span style="background-color: #f2f2f7; color: #8e8e93; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold;">Low</span>`;
            } else {
                priorityBadge = `<span style="background-color: #e5f6ff; color: #007aff; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold;">Normal</span>`;
            }

            tableRows += `
                <tr style="border-bottom: 1px solid #e5e5ea;">
                    <td style="padding: 10px; font-size: 13px; color: ${dateColor}; font-weight: ${dateWeight};">${a['Activity Date']}</td>
                    <td style="padding: 10px; font-size: 13px; color: #1c1c1e; font-weight: bold;">${a['Activity Subject']}</td>
                    <td style="padding: 10px; font-size: 13px; color: #48484a;">${a['Activity Type']}</td>
                    <td style="padding: 10px; font-size: 13px; color: #48484a;">Member #${a['Client ID']}</td>
                    <td style="padding: 10px; text-align: center;">${priorityBadge}</td>
                </tr>
            `;
        });
    }

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Neon CRM Activities Digest</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f6f6f6; margin: 0; padding: 20px; -webkit-font-smoothing: antialiased;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #e5e5ea;">
                <tr>
                    <td style="background: linear-gradient(135deg, #0b0914 0%, #1e133d 100%); padding: 30px; text-align: center;">
                        <h1 style="color: #00f2fe; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 0.5px; text-shadow: 0 0 10px rgba(0,242,254,0.3);">Neon CRM Dashboard</h1>
                        <p style="color: #ff007f; margin: 5px 0 0 0; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Daily Activities Digest</p>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 20px;">
                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                                <td width="31%" style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; text-align: center; border: 1px solid #e5e5ea;">
                                    <div style="font-size: 11px; text-transform: uppercase; color: #8e8e93; font-weight: bold; letter-spacing: 0.5px;">Total Logged</div>
                                    <div style="font-size: 24px; font-weight: bold; color: #1c1c1e; margin-top: 5px;">${total}</div>
                                </td>
                                <td width="3%">&nbsp;</td>
                                <td width="31%" style="background-color: #fff9e6; border-radius: 8px; padding: 15px; text-align: center; border: 1px solid #ffeeba;">
                                    <div style="font-size: 11px; text-transform: uppercase; color: #b78103; font-weight: bold; letter-spacing: 0.5px;">Pending</div>
                                    <div style="font-size: 24px; font-weight: bold; color: #b78103; margin-top: 5px;">${pending}</div>
                                </td>
                                <td width="3%">&nbsp;</td>
                                <td width="31%" style="background-color: #ffebeb; border-radius: 8px; padding: 15px; text-align: center; border: 1px solid #ffd1d1;">
                                    <div style="font-size: 11px; text-transform: uppercase; color: #ff3b30; font-weight: bold; letter-spacing: 0.5px;">Overdue</div>
                                    <div style="font-size: 24px; font-weight: bold; color: #ff3b30; margin-top: 5px;">${overdue}</div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 0 20px 10px 20px;">
                        <h2 style="font-size: 16px; color: #1c1c1e; margin: 0; border-bottom: 2px solid #e5e5ea; padding-bottom: 8px;">Critical / Pending Activities</h2>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 0 20px 20px 20px;">
                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 2px solid #e5e5ea; text-align: left;">
                                    <th style="padding: 8px 10px; font-size: 12px; text-transform: uppercase; color: #8e8e93;">Date</th>
                                    <th style="padding: 8px 10px; font-size: 12px; text-transform: uppercase; color: #8e8e93;">Subject</th>
                                    <th style="padding: 8px 10px; font-size: 12px; text-transform: uppercase; color: #8e8e93;">Type</th>
                                    <th style="padding: 8px 10px; font-size: 12px; text-transform: uppercase; color: #8e8e93;">Member ID</th>
                                    <th style="padding: 8px 10px; font-size: 12px; text-transform: uppercase; color: #8e8e93; text-align: center;">Priority</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                            </tbody>
                        </table>
                    </td>
                </tr>
                <tr>
                    <td style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #8e8e93; border-top: 1px solid #e5e5ea;">
                        <p style="margin: 0;">This report was automatically compiled by the Social Medium Neon Activities Server.</p>
                        <p style="margin: 5px 0 0 0;">Date generated: ${new Date().toLocaleString()}</p>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;
};

// API: Send Report Manually
app.post('/api/send-report', async (req, res) => {
    try {
        const isMock = !process.env.NEON_ORG_ID || !process.env.NEON_API_KEY;
        const recipient = process.env.EMAIL_RECIPIENT;
        
        if (!recipient) {
            return res.status(400).json({ success: false, message: 'Recipient email is not configured in settings.' });
        }

        if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
            return res.status(400).json({ success: false, message: 'SMTP credentials are not configured in settings.' });
        }

        const reportType = process.env.EMAIL_REPORT_TYPE || 'all';
        let activities = [];

        if (isMock) {
            activities = generateMockActivities();
            if (reportType === 'staff-activity') {
                activities = activities.filter(a => {
                    const subject = a['Activity Subject'] || '';
                    const type = a['Activity Type'] || '';
                    return !subject.toLowerCase().includes('check-in') && type.toLowerCase() !== 'check-in';
                });
            }
        } else {
            const auth = getNeonAuth();
            const apiBase = getNeonApiUrl();
            const searchFields = [];

            if (reportType === 'staff-activity') {
                searchFields.push({
                    field: 'Activity Solicitation Method',
                    operator: 'NOT_EQUAL',
                    value: 'Check-In'
                });
            } else {
                searchFields.push({
                    field: 'Activity Start Date',
                    operator: 'GREATER_THAN',
                    value: '1970-01-01'
                });
            }

            let currentPage = 0;
            let totalPages = 1;
            let rawResults = [];

            while (currentPage < totalPages) {
                const response = await fetch(`${apiBase}/activities/search`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'NEON-API-VERSION': '2.11',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        searchFields,
                        outputFields: [
                            'Activity ID',
                            'Activity Subject',
                            'Activity Start Date',
                            'Activity Status',
                            'Activity Priority',
                            'Activity System User',
                            'Activity Contact Account ID',
                            'Account Name',
                            'Activity Solicitation Method',
                            'Activity Note'
                        ],
                        pagination: {
                            currentPage,
                            pageSize: 200,
                            sortColumn: 'Activity Start Date',
                            sortDirection: 'DESC'
                        }
                    })
                });

                if (!response.ok) {
                    throw new Error(`Failed to retrieve live activities for email report: HTTP ${response.status}`);
                }

                const data = await response.json();
                rawResults = rawResults.concat(data.searchResults || []);
                totalPages = data.pagination ? data.pagination.totalPages : 1;
                currentPage++;
                if (currentPage >= 15) break;
            }

            activities = rawResults.map(item => ({
                'Activity ID': item['Activity ID'] || '',
                'Activity Subject': item['Activity Subject'] || 'Untitled Activity',
                'Activity Date': item['Activity Start Date'] || '',
                'Status': item['Activity Status'] || 'Pending',
                'Priority': item['Activity Priority'] || 'Normal',
                'Activity Type': item['Activity Solicitation Method'] || 'Activity',
                'Client ID': item['Activity Contact Account ID'] || '',
                'Client Name': item['Account Name'] || '',
                'Created By': item['Activity System User'] || '',
                'Activity Note': item['Activity Note'] || ''
            }));

            if (reportType === 'staff-activity') {
                activities = activities.filter(item => {
                    const subject = item['Activity Subject'] || '';
                    return !subject.toLowerCase().includes('check-in');
                });
            }
        }

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        const htmlContent = compileEmailHTML(activities);
        await transporter.sendMail({
            from: process.env.EMAIL_FROM || '"Neon CRM Dashboard" <noreply@yourdomain.com>',
            to: recipient,
            subject: `Neon CRM Activities Summary - ${new Date().toLocaleDateString()}`,
            html: htmlContent
        });

        res.json({ success: true, message: `Report successfully emailed to ${recipient}.` });
    } catch (err) {
        res.status(500).json({ success: false, message: `Email failed to send: ${err.message}` });
    }
});

// Initialize Background Scheduler
const initializeScheduler = () => {
    if (activeCronJob) {
        activeCronJob.stop();
        activeCronJob = null;
        console.log('Stopped existing background report cron job.');
    }

    const enabled = process.env.EMAIL_ENABLED === 'true';
    const schedule = process.env.EMAIL_SCHEDULE || '0 8 * * *';
    const recipient = process.env.EMAIL_RECIPIENT;

    if (enabled && recipient) {
        if (cron.validate(schedule)) {
            activeCronJob = cron.schedule(schedule, async () => {
                const reportType = process.env.EMAIL_REPORT_TYPE || 'all';
                console.log(`[Scheduler] Running scheduled email dispatch (${reportType}) to ${recipient}...`);
                try {
                    const isMock = !process.env.NEON_ORG_ID || !process.env.NEON_API_KEY;
                    let activities = [];
                    
                    if (isMock) {
                        activities = generateMockActivities();
                        if (reportType === 'staff-activity') {
                            activities = activities.filter(a => {
                                const subject = a['Activity Subject'] || '';
                                const type = a['Activity Type'] || '';
                                return !subject.toLowerCase().includes('check-in') && type.toLowerCase() !== 'check-in';
                            });
                        }
                    } else {
                        const auth = getNeonAuth();
                        const apiBase = getNeonApiUrl();
                        const searchFields = [];

                        if (reportType === 'staff-activity') {
                            searchFields.push({
                                field: 'Activity Solicitation Method',
                                operator: 'NOT_EQUAL',
                                value: 'Check-In'
                            });
                        } else {
                            searchFields.push({
                                field: 'Activity Start Date',
                                operator: 'GREATER_THAN',
                                value: '1970-01-01'
                            });
                        }

                        let currentPage = 0;
                        let totalPages = 1;
                        let rawResults = [];

                        while (currentPage < totalPages) {
                            const response = await fetch(`${apiBase}/activities/search`, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Basic ${auth}`,
                                    'NEON-API-VERSION': '2.11',
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    searchFields,
                                    outputFields: [
                                        'Activity ID',
                                        'Activity Subject',
                                        'Activity Start Date',
                                        'Activity Status',
                                        'Activity Priority',
                                        'Activity System User',
                                        'Activity Contact Account ID',
                                        'Account Name',
                                        'Activity Solicitation Method',
                                        'Activity Note'
                                    ],
                                    pagination: {
                                        currentPage,
                                        pageSize: 200,
                                        sortColumn: 'Activity Start Date',
                                        sortDirection: 'DESC'
                                    }
                                })
                            });

                            if (response.ok) {
                                const data = await response.json();
                                rawResults = rawResults.concat(data.searchResults || []);
                                totalPages = data.pagination ? data.pagination.totalPages : 1;
                                currentPage++;
                            } else {
                                break;
                            }
                            if (currentPage >= 15) break;
                        }

                        activities = rawResults.map(item => ({
                            'Activity ID': item['Activity ID'] || '',
                            'Activity Subject': item['Activity Subject'] || 'Untitled Activity',
                            'Activity Date': item['Activity Start Date'] || '',
                            'Status': item['Activity Status'] || 'Pending',
                            'Priority': item['Activity Priority'] || 'Normal',
                            'Activity Type': item['Activity Solicitation Method'] || 'Activity',
                            'Client ID': item['Activity Contact Account ID'] || '',
                            'Client Name': item['Account Name'] || '',
                            'Created By': item['Activity System User'] || '',
                            'Activity Note': item['Activity Note'] || ''
                        }));

                        if (reportType === 'staff-activity') {
                            activities = activities.filter(item => {
                                const subject = item['Activity Subject'] || '';
                                return !subject.toLowerCase().includes('check-in');
                            });
                        }
                    }

                    const transporter = nodemailer.createTransport({
                        host: process.env.SMTP_HOST,
                        port: parseInt(process.env.SMTP_PORT || '587'),
                        secure: process.env.SMTP_SECURE === 'true',
                        auth: {
                            user: process.env.SMTP_USER,
                            pass: process.env.SMTP_PASS
                        }
                    });

                    const htmlContent = compileEmailHTML(activities);
                    await transporter.sendMail({
                        from: process.env.EMAIL_FROM || '"Neon CRM Dashboard" <noreply@yourdomain.com>',
                        to: recipient,
                        subject: `Neon CRM Activities Summary (Scheduled) - ${new Date().toLocaleDateString()}`,
                        html: htmlContent
                    });
                    console.log(`[Scheduler] Successfully sent scheduled digest email to ${recipient}`);
                } catch (err) {
                    console.error('[Scheduler] Failed to dispatch scheduled email:', err.message);
                }
            });
            console.log(`[Scheduler] Active and scheduled with cron expression: "${schedule}" to recipient: "${recipient}"`);
        } else {
            console.error(`[Scheduler] Invalid cron expression: "${schedule}". Scheduler disabled.`);
        }
    } else {
        console.log('[Scheduler] Background email scheduler is disabled (or recipient not configured).');
    }
};

// ============================================================================
// Full API Proxy for direct account lookups, check-in activities, and custom fields
// ============================================================================
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

app.listen(port, () => {
    console.log(`Kiosk Proxy & Neon Dashboard API active on port ${port}`);
    initializeScheduler();
});
