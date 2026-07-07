export const getDashboardHtml = () => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Dashboard</title>
    <script>
        // Must be set BEFORE the Tailwind CDN script loads so dark: variants are generated
        window.tailwind = { config: { darkMode: 'class' } };
    </script>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        // Apply saved/system dark preference before first paint to prevent flash
        (function () {
            const saved = localStorage.getItem('theme');
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (saved === 'dark' || (!saved && prefersDark)) {
                document.documentElement.classList.add('dark');
            }
        })();
    </script>
</head>
<body class="bg-gray-100 dark:bg-gray-900 min-h-screen font-sans text-gray-800 dark:text-gray-100 transition-colors">
    <nav class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm sticky top-0 z-10">
        <div class="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
            <h1 class="text-xl font-extrabold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                📬 <span class="hidden sm:inline">Email Handler</span>
            </h1>

            <!-- Default nav actions -->
            <div id="nav-actions" class="flex items-center gap-2">
                <input type="text" id="searchInput" placeholder="Search emails..."
                    class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 w-48 sm:w-64 transition-all bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500">
                <button onclick="loadEmails(1)"
                    class="bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/60 text-sm font-medium transition">
                    Refresh
                </button>
                <button onclick="toggleTheme()" title="Toggle dark mode"
                    class="w-9 h-9 flex items-center justify-center rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition text-lg">
                    <span id="theme-icon"></span>
                </button>
            </div>

            <!-- Selection toolbar (shown when ≥1 email selected) -->
            <div id="select-toolbar" class="hidden items-center gap-3">
                <span id="select-count" class="text-sm font-medium text-gray-600 dark:text-gray-300">0 selected</span>
                <button onclick="selectAll()" class="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium">Select all</button>
                <button onclick="clearSelection()" class="text-sm text-gray-500 dark:text-gray-400 hover:underline">Deselect all</button>
                <button onclick="deleteSelected()"
                    class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium transition">
                    🗑 Delete selected
                </button>
                <button onclick="toggleTheme()" title="Toggle dark mode"
                    class="w-9 h-9 flex items-center justify-center rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition text-lg">
                    <span class="theme-icon-mirror"></span>
                </button>
            </div>
        </div>
    </nav>

    <main class="max-w-6xl mx-auto p-4 mt-4">
        <div id="view-list" class="space-y-3 block">
            <div id="email-list" class="grid gap-3">
                <div class="text-center py-10 text-gray-400 dark:text-gray-500">Loading emails...</div>
            </div>
            <div id="pagination" class="mt-6 flex justify-center items-center gap-4 hidden">
                <button id="btn-prev" onclick="changePage(-1)"
                    class="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm">
                    &laquo; Prev
                </button>
                <span id="page-info" class="text-sm text-gray-600 dark:text-gray-400 font-medium">Page 1 / 1</span>
                <button id="btn-next" onclick="changePage(1)"
                    class="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm">
                    Next &raquo;
                </button>
            </div>
        </div>

        <div id="view-detail" class="hidden bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div class="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center sticky top-0">
                <button onclick="closeDetail()"
                    class="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition">
                    &larr; Back
                </button>
                <button id="btn-delete-detail"
                    class="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 px-3 py-1.5 rounded-md text-sm font-medium transition">
                    Delete
                </button>
            </div>
            <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 id="detail-subject" class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Loading...</h2>
                <div class="flex justify-between items-center text-sm">
                    <div>
                        <p class="text-gray-900 dark:text-gray-100 font-semibold" id="detail-sender">-</p>
                        <p class="text-gray-500 dark:text-gray-400 mt-0.5">To: <span id="detail-recipient">-</span></p>
                    </div>
                    <div class="text-right text-gray-500 dark:text-gray-400" id="detail-date">-</div>
                </div>
            </div>
            <div class="bg-white dark:bg-gray-800">
                <iframe id="detail-frame" class="w-full min-h-[600px] border-none" sandbox="allow-popups allow-popups-to-escape-sandbox"></iframe>
            </div>
        </div>
    </main>

    <script>
        let currentPage = 1;
        let totalPages = 1;
        let currentEmails = [];
        const selectedIds = new Set();

        const viewList      = document.getElementById('view-list');
        const viewDetail    = document.getElementById('view-detail');
        const navActions    = document.getElementById('nav-actions');
        const selectToolbar = document.getElementById('select-toolbar');
        const selectCount   = document.getElementById('select-count');
        const searchInput   = document.getElementById('searchInput');

        const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        }[c]));

        // -----------------------------------------------------------------------
        // Dark mode
        // -----------------------------------------------------------------------

        function isDark() {
            return document.documentElement.classList.contains('dark');
        }

        function syncThemeIcons() {
            const icon = isDark() ? '☀️' : '🌙';
            document.getElementById('theme-icon').textContent = icon;
            document.querySelectorAll('.theme-icon-mirror').forEach((el) => el.textContent = icon);
        }

        function toggleTheme() {
            document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme', isDark() ? 'dark' : 'light');
            syncThemeIcons();
            syncIframeDarkMode();
        }

        // Inject/remove a minimal dark stylesheet inside the email iframe so the
        // email body is readable regardless of the email's own colors.
        function syncIframeDarkMode() {
            const frame = document.getElementById('detail-frame');
            try {
                const doc = frame.contentDocument;
                if (!doc) return;
                let style = doc.getElementById('__dark_override');
                if (isDark()) {
                    if (!style) {
                        style = doc.createElement('style');
                        style.id = '__dark_override';
                        doc.head.appendChild(style);
                    }
                    style.textContent = \`
                        html, body {
                            background-color: #1f2937 !important;
                            color: #f3f4f6 !important;
                        }
                        a { color: #93c5fd !important; }
                    \`;
                } else if (style) {
                    style.remove();
                }
            } catch {
                // Cross-origin iframe — nothing we can do
            }
        }

        syncThemeIcons();

        // Re-apply dark mode to iframe whenever it (re)loads
        document.getElementById('detail-frame').addEventListener('load', syncIframeDarkMode);

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
            container.innerHTML = '<div class="text-center py-10 text-gray-400 dark:text-gray-500">Loading...</div>';
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
                container.innerHTML = '<div class="text-center py-10 text-gray-400 dark:text-gray-500">No emails found.</div>';
                document.getElementById('pagination').classList.add('hidden');
                return;
            }
            container.innerHTML = emails.map((e) => {
                const id      = Number(e.id);
                if (!Number.isSafeInteger(id) || id < 1) return '';
                const sender  = e.sender || 'Unknown';
                const subject = e.subject || '(No Subject)';
                const date    = new Date(e.received_at).toLocaleDateString('en-US', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                });
                const isChecked = selectedIds.has(id) ? 'checked' : '';
                return \`
                <div class="email-row bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition flex gap-4 items-center px-4 py-3 cursor-pointer"
                     data-id="\${id}" onclick="handleRowClick(event, \${id})">
                    <input type="checkbox" class="email-checkbox flex-none w-4 h-4 accent-blue-500 cursor-pointer"
                           data-id="\${id}" \${isChecked}
                           onclick="event.stopPropagation(); toggleSelect(\${id}, this.checked)">
                    <div class="flex-none w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold uppercase select-none">
                        \${escapeHtml(sender.charAt(0))}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-baseline mb-1">
                            <h3 class="font-bold text-gray-800 dark:text-gray-100 truncate pr-4">\${escapeHtml(sender)}</h3>
                            <span class="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">\${escapeHtml(date)}</span>
                        </div>
                        <p class="text-sm text-gray-600 dark:text-gray-400 font-medium truncate">\${escapeHtml(subject)}</p>
                    </div>
                </div>\`;
            }).join('');
        }

        function handleRowClick(event, id) {
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
                    || \`<pre style="padding:20px;white-space:pre-wrap;font-family:monospace">\${escapeHtml(email.body_text)}</pre>\`;
                // syncIframeDarkMode is called automatically via the 'load' event listener
            } catch (err) {
                document.getElementById('detail-subject').textContent = 'Failed to load email.';
                document.getElementById('detail-frame').srcdoc = \`<p style="padding:20px;color:red">\${escapeHtml(err.message)}</p>\`;
            }
        }

        function closeDetail() {
            viewDetail.classList.add('hidden');
            viewList.classList.remove('hidden');
            document.getElementById('detail-frame').srcdoc = '';
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
