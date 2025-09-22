import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';

// Define the Hono app with types for environment variables
const app = new Hono<{ Bindings: Env }>();

// --- Authentication Middleware ---
// Use Hono's built-in middleware for Basic Authentication.
// This will protect all routes defined after this line.
app.use('/*', async (c, next) => {
    const auth = basicAuth({
        username: c.env.DASHBOARD_USER,
        password: c.env.DASHBOARD_PASS,
    });
    return auth(c, next);
});


// --- API Routes ---

// GET /api/emails - Fetch all emails
app.get('/api/emails', async (c) => {
    const { results } = await c.env.DB.prepare(
        "SELECT id, sender, recipient, subject, received_at FROM emails ORDER BY received_at DESC"
    ).all();
    return c.json(results);
});

// GET /api/emails/:id - Fetch a single email by its ID
app.get('/api/emails/:id', async (c) => {
    const { id } = c.req.param();
    if (!id) return c.text('Invalid ID', 400);

    const email = await c.env.DB.prepare("SELECT * FROM emails WHERE id = ?").bind(id).first();
    if (!email) return c.text('Email not found', 404);
    
    return c.json(email);
});

// DELETE /api/emails/:id - Delete an email by its ID
app.delete('/api/emails/:id', async (c) => {
    const { id } = c.req.param();
    if (!id) return c.text('Invalid ID', 400);

    await c.env.DB.prepare("DELETE FROM emails WHERE id = ?").bind(id).run();
    return c.json({ success: true }, 200);
});


// --- Dashboard Route ---

// GET / - Serve the main dashboard HTML
app.get('/', (c) => {
    return c.html(getDashboardHtml());
});

// Hono handles 404s automatically, so no need for a catch-all route.

// --- HTML Dashboard (No changes) ---
function getDashboardHtml(): string {
     return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { font-family: 'Inter', sans-serif; } .modal { display: none; } .modal.active { display: flex; }
        .tab-content { display: none; } .tab-content.active { display: block; }
        .tab.active { border-color: #3b82f6; color: #3b82f6; }
    </style>
</head>
<body class="bg-gray-100 text-gray-800">
    <div class="container mx-auto p-4 md:p-8"><h1 class="text-3xl font-bold mb-6 text-gray-900">Email Inbox</h1>
        <div class="bg-white rounded-lg shadow-md overflow-x-auto">
            <table class="w-full text-left">
                <thead class="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th class="p-4 font-semibold">ID</th><th class="p-4 font-semibold">From</th>
                        <th class="p-4 font-semibold">To</th><th class="p-4 font-semibold">Subject</th>
                        <th class="p-4 font-semibold">Received</th><th class="p-4 font-semibold">Actions</th>
                    </tr>
                </thead>
                <tbody id="emails-table-body"><tr><td colspan="6" class="text-center p-8">Loading emails...</td></tr></tbody>
            </table>
        </div>
    </div>
    <div id="view-modal" class="modal fixed inset-0 bg-black bg-opacity-50 items-center justify-center p-4">
        <div class="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div class="flex justify-between items-center p-4 border-b">
                <h2 class="text-xl font-bold" id="modal-subject"></h2>
                <button onclick="closeModal()" class="text-gray-500 hover:text-gray-800">&times;</button>
            </div>
            <div class="p-4 flex-grow overflow-y-auto">
                <div class="text-sm text-gray-600 mb-4">
                    <p><strong>From:</strong> <span id="modal-from"></span></p><p><strong>To:</strong> <span id="modal-to"></span></p>
                </div>
                <div class="border-b border-gray-200 mb-4">
                    <nav class="flex space-x-4" id="modal-tabs">
                        <button data-tab="text" class="tab py-2 px-1 border-b-2 font-medium text-sm">Text</button>
                        <button data-tab="html" class="tab py-2 px-1 border-b-2 font-medium text-sm">HTML</button>
                        <button data-tab="raw" class="tab py-2 px-1 border-b-2 font-medium text-sm">Raw</button>
                    </nav>
                </div>
                <div id="modal-content">
                    <div id="tab-text" class="tab-content prose max-w-none"><pre class="whitespace-pre-wrap"></pre></div>
                    <div id="tab-html" class="tab-content"><iframe class="w-full h-96 border rounded"></iframe></div>
                    <div id="tab-raw" class="tab-content"><pre class="text-xs bg-gray-100 p-2 rounded whitespace-pre-wrap overflow-x-auto"></pre></div>
                </div>
            </div>
        </div>
    </div>
<script>
    document.addEventListener('DOMContentLoaded', fetchEmails);
    const modal=document.getElementById('view-modal'),modalTabs=document.getElementById('modal-tabs');
    async function fetchEmails(){const t=document.getElementById('emails-table-body');try{const e=await fetch('/api/emails');if(!e.ok)throw new Error('Failed to fetch emails.');const o=await e.json();t.innerHTML=0===o.length?'<tr><td colspan="6" class="text-center p-8">No emails found.</td></tr>':o.map(t=>\`<tr class="border-b hover:bg-gray-50"><td class="p-4">\${t.id}</td><td class="p-4">\${escapeHtml(t.sender)}</td><td class="p-4">\${escapeHtml(t.recipient)}</td><td class="p-4">\${escapeHtml(t.subject)}</td><td class="p-4">\${new Date(t.received_at).toLocaleString()}</td><td class="p-4 space-x-2"><button onclick="viewEmail(\${t.id})" class="text-blue-600 hover:underline text-sm">View</button><button onclick="deleteEmail(\${t.id})" class="text-red-600 hover:underline text-sm">Delete</button></td></tr>\`).join('')}catch(e){console.error(e),t.innerHTML='<tr><td colspan="6" class="text-center p-8 text-red-500">Error loading emails.</td></tr>'}}
    async function viewEmail(t){try{const e=await fetch(\`/api/emails/\${t}\`);if(!e.ok)throw new Error('Failed to fetch email details.');const o=await e.json();document.getElementById('modal-subject').textContent=o.subject||'(No Subject)',document.getElementById('modal-from').textContent=o.sender,document.getElementById('modal-to').textContent=o.recipient,document.querySelector('#tab-text pre').textContent=o.body_text||'No text content available.',document.querySelector('#tab-html iframe').srcdoc=o.body_html||'<p>No HTML content available.</p>',document.querySelector('#tab-raw pre').textContent=o.raw_email||'No raw content available.',openModal(),switchTab('text')}catch(e){console.error(e),alert('Could not load email details.')}}
    async function deleteEmail(t){if(confirm(\`Are you sure you want to delete email #\${t}?\`))try{const e=await fetch(\`/api/emails/\${t}\`,{method:'DELETE'});if(!e.ok)throw new Error('Failed to delete email.');fetchEmails()}catch(e){console.error(e),alert('Could not delete email.')}}
    function openModal(){modal.classList.add('active')}function closeModal(){modal.classList.remove('active')}
    modalTabs.addEventListener('click',t=>{'BUTTON'===t.target.tagName&&switchTab(t.target.dataset.tab)});
    function switchTab(t){document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active')),document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active')),document.querySelector(\`.tab[data-tab="\${t}"]\`).classList.add('active'),document.getElementById(\`tab-\${t}\`).classList.add('active')}
    function escapeHtml(t){return t?t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"):""}
</script>
</body></html>`;
}

export default app;

