export const getDashboardHtml = () => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 min-h-screen font-sans text-gray-800">
    <nav class="bg-white border-b shadow-sm sticky top-0 z-10">
        <div class="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
            <h1 class="text-xl font-extrabold text-blue-600 flex items-center gap-2">
                📬 <span class="hidden sm:inline">Email Handler</span>
            </h1>
            <!-- Default nav actions -->
            <div id="nav-actions" class="flex gap-2">
                <input type="text" id="searchInput" placeholder="Search emails..."
                    class="px-4 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 w-48 sm:w-64 transition-all">
                <button onclick="loadEmails(1)" class="bg-blue-50 text-blue-600 px-4 py-2 rounded-md hover:bg-blue-100 text-sm font-medium transition">
                    Refresh
                </button>
            </div>
            <!-- Selection toolbar (shown when ≥1 email selected) -->
            <div id="select-toolbar" class="hidden items-center gap-3">
                <span id="select-count" class="text-sm font-medium text-gray-600">0 selected</span>
                <button onclick="selectAll()" class="text-sm text-blue-600 hover:underline font-medium">Select all</button>
                <button onclick="clearSelection()" class="text-sm text-gray-500 hover:underline">Deselect all</button>
                <button onclick="deleteSelected()" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium transition">
                    🗑 Delete selected
                </button>
            </div>
        </div>
    </nav>

    <main class="max-w-6xl mx-auto p-4 mt-4">
        <div id="view-list" class="space-y-3 block">
            <div id="email-list" class="grid gap-3">
                <div class="text-center py-10 text-gray-400">Loading emails...</div>
            </div>
            <div id="pagination" class="mt-6 flex justify-center items-center gap-4 hidden">
                <button id="btn-prev" onclick="changePage(-1)" class="px-4 py-2 bg-white border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm">
                    &laquo; Prev
                </button>
                <span id="page-info" class="text-sm text-gray-600 font-medium">Page 1 / 1</span>
                <button id="btn-next" onclick="changePage(1)" class="px-4 py-2 bg-white border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm">
                    Next &raquo;
                </button>
            </div>
        </div>

        <div id="view-detail" class="hidden bg-white rounded-xl shadow-sm border overflow-hidden">
            <div class="bg-gray-50 border-b p-4 flex justify-between items-center sticky top-0">
                <button onclick="closeDetail()" class="flex items-center gap-2 text-gray-600 hover:text-blue-600 font-medium transition">
                    &larr; Back
                </button>
                <button id="btn-delete-detail" class="text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-md text-sm font-medium transition">
                    Delete
                </button>
            </div>
            <div class="p-6 border-b">
                <h2 id="detail-subject" class="text-2xl font-bold text-gray-900 mb-4">Loading...</h2>
                <div class="flex justify-between items-center text-sm">
                    <div>
                        <p class="text-gray-900 font-semibold" id="detail-sender">-</p>
                        <p class="text-gray-500 mt-0.5">To: <span id="detail-recipient">-</span></p>
                    </div>
                    <div class="text-right text-gray-500" id="detail-date">-</div>
                </div>
            </div>
            <div class="bg-white">
                <iframe id="detail-frame" class="w-full min-h-[600px] border-none" sandbox="allow-popups allow-popups-to-escape-sandbox"></iframe>
            </div>
        </div>
    </main>

    <script>
        let currentPage = 1;
        let totalPages = 1;
        let currentEmails = [];       // emails on the current page
        const selectedIds = new Set(); // IDs checked by the user

        const viewList    = document.getElementById('view-list');
        const viewDetail  = document.getElementById('view-detail');
        const navActions  = document.getElementById('nav-actions');
        const selectToolbar = document.getElementById('select-toolbar');
        const selectCount   = document.getElementById('select-count');
        const searchInput   = document.getElementById('searchInput');

        const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        }[c]));

        // -----------------------------------------------------------------------
        // Selection helpers
        // -----------------------------------------------------------------------

        function updateToolbar() {
            const count = selectedIds.size;
            if (count > 0) {
                navActions.classList.add('hidden');
                selectToolbar.classList.remove('hidden');
                selectToolbar.classList.add('flex');
                selectCount.textContent = \`\${count} selected\`;
            } else {
                selectToolbar.classList.add('hidden');
                selectToolbar.classList.remove('flex');
                navActions.classList.remove('hidden');
            }
            // Sync checkboxes in the list
            document.querySelectorAll('.email-checkbox').forEach((cb) => {
                cb.checked = selectedIds.has(Number(cb.dataset.id));
            });
        }

        function toggleSelect(id, checked) {
            if (checked) selectedIds.add(id);
            else selectedIds.delete(id);
            updateToolbar();
        }

        function selectAll() {
            currentEmails.forEach((e) => selectedIds.add(e.id));
            updateToolbar();
        }

        function clearSelection() {
            selectedIds.clear();
            updateToolbar();
        }

        // -----------------------------------------------------------------------
        // Load & render
        // -----------------------------------------------------------------------

        async function loadEmails(page = currentPage) {
            currentPage = page;
            clearSelection();
            const container = document.getElementById('email-list');
            container.innerHTML = '<div class="text-center py-10 text-gray-400">Loading...</div>';
            const search = encodeURIComponent(searchInput.value.trim());

            try {
                const res = await fetch(\`/api/emails?page=\${page}&limit=15&search=\${search}\`);
                if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
                const json = await res.json();
                totalPages = json.meta.totalPages;
                currentEmails = json.data;
                renderEmails(currentEmails);
                renderPagination();
            } catch (err) {
                container.innerHTML = \`<p class="text-red-500 text-center py-10">Failed to load emails: \${escapeHtml(err.message)}</p>\`;
            }
        }

        function renderEmails(emails) {
            const container = document.getElementById('email-list');
            if (!emails?.length) {
                container.innerHTML = '<div class="text-center py-10 text-gray-400">No emails found.</div>';
                document.getElementById('pagination').classList.add('hidden');
                return;
            }
            container.innerHTML = emails.map((e) => {
                const id = Number(e.id);
                if (!Number.isSafeInteger(id) || id < 1) return '';
                const sender  = e.sender || 'Unknown';
                const subject = e.subject || '(No Subject)';
                const date    = new Date(e.received_at).toLocaleDateString('en-US', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                });
                const isChecked = selectedIds.has(id) ? 'checked' : '';
                return \`
                <div class="email-row bg-white rounded-lg shadow-sm border border-gray-100 hover:border-blue-300 hover:shadow-md transition flex gap-4 items-center px-4 py-3 cursor-pointer"
                     data-id="\${id}" onclick="handleRowClick(event, \${id})">
                    <input type="checkbox" class="email-checkbox flex-none w-4 h-4 accent-blue-500 cursor-pointer"
                           data-id="\${id}" \${isChecked}
                           onclick="event.stopPropagation(); toggleSelect(\${id}, this.checked)">
                    <div class="flex-none w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold uppercase select-none">
                        \${escapeHtml(sender.charAt(0))}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-baseline mb-1">
                            <h3 class="font-bold text-gray-800 truncate pr-4">\${escapeHtml(sender)}</h3>
                            <span class="text-xs text-gray-400 whitespace-nowrap">\${escapeHtml(date)}</span>
                        </div>
                        <p class="text-sm text-gray-600 font-medium truncate">\${escapeHtml(subject)}</p>
                    </div>
                </div>\`;
            }).join('');
        }

        // Click on row body → open detail; click on checkbox → toggle selection
        function handleRowClick(event, id) {
            // Checkbox clicks are handled by their own onclick (stopPropagation)
            openDetail(id);
        }

        function renderPagination() {
            const pagination = document.getElementById('pagination');
            if (totalPages <= 1) { pagination.classList.add('hidden'); return; }
            pagination.classList.remove('hidden');
            document.getElementById('page-info').textContent = \`Page \${currentPage} / \${totalPages}\`;
            document.getElementById('btn-prev').disabled = currentPage === 1;
            document.getElementById('btn-next').disabled = currentPage === totalPages;
        }

        function changePage(direction) {
            const next = currentPage + direction;
            if (next >= 1 && next <= totalPages) loadEmails(next);
        }

        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => loadEmails(1), 500);
        });

        // -----------------------------------------------------------------------
        // Bulk delete
        // -----------------------------------------------------------------------

        async function deleteSelected() {
            if (selectedIds.size === 0) return;
            if (!confirm(\`Delete \${selectedIds.size} email\${selectedIds.size > 1 ? 's' : ''}?\`)) return;
            try {
                const res = await fetch('/api/emails', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify([...selectedIds]),
                });
                if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
                clearSelection();
                loadEmails(currentPage);
            } catch (err) {
                alert(\`Failed to delete: \${err.message}\`);
            }
        }

        // -----------------------------------------------------------------------
        // Detail view
        // -----------------------------------------------------------------------

        async function openDetail(id) {
            viewList.classList.add('hidden');
            navActions.classList.add('hidden');
            selectToolbar.classList.add('hidden');
            selectToolbar.classList.remove('flex');
            viewDetail.classList.remove('hidden');
            document.getElementById('detail-subject').textContent   = 'Loading...';
            document.getElementById('detail-sender').textContent    = '-';
            document.getElementById('detail-recipient').textContent = '-';
            document.getElementById('detail-date').textContent      = '-';
            document.getElementById('detail-frame').srcdoc          = '';

            try {
                const res = await fetch(\`/api/emails/\${id}\`);
                if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
                const email = await res.json();
                document.getElementById('detail-subject').textContent   = email.subject || '(No Subject)';
                document.getElementById('detail-sender').textContent    = email.sender || '-';
                document.getElementById('detail-recipient').textContent = email.recipient || '-';
                document.getElementById('detail-date').textContent      = new Date(email.received_at).toLocaleString('en-US');
                document.getElementById('btn-delete-detail').onclick    = () => deleteOne(id, true);
                document.getElementById('detail-frame').srcdoc          = email.body_html
                    || \`<pre style="padding:20px;white-space:pre-wrap">\${escapeHtml(email.body_text)}</pre>\`;
            } catch (err) {
                document.getElementById('detail-subject').textContent = 'Failed to load email.';
                document.getElementById('detail-frame').srcdoc = \`<p style="padding:20px;color:red">\${escapeHtml(err.message)}</p>\`;
            }
        }

        function closeDetail() {
            viewDetail.classList.add('hidden');
            viewList.classList.remove('hidden');
            document.getElementById('detail-frame').srcdoc = '';
            // Restore correct nav bar
            if (selectedIds.size > 0) {
                selectToolbar.classList.remove('hidden');
                selectToolbar.classList.add('flex');
            } else {
                navActions.classList.remove('hidden');
            }
        }

        async function deleteOne(id, closeView = false) {
            if (!confirm('Delete this email?')) return;
            try {
                const res = await fetch(\`/api/emails/\${id}\`, { method: 'DELETE' });
                if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
                selectedIds.delete(id);
                if (closeView) closeDetail();
                loadEmails(currentPage);
            } catch (err) {
                alert(\`Failed to delete: \${err.message}\`);
            }
        }

        // -----------------------------------------------------------------------
        // Boot
        // -----------------------------------------------------------------------

        async function init() {
            const params  = new URLSearchParams(window.location.search);
            const emailId = params.get('id');
            await loadEmails(1);
            if (emailId) {
                window.history.replaceState({}, '', window.location.pathname);
                openDetail(Number(emailId));
            }
        }

        init();
    </script>
</body>
</html>
`;
