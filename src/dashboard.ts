export const getDashboardHtml = () => `
<!DOCTYPE html>
<html lang="id">
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
            <div id="nav-actions" class="flex gap-2">
                <input type="text" id="searchInput" placeholder="Cari email..."
                    class="px-4 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 w-48 sm:w-64 transition-all">
                <button onclick="loadEmails()" class="bg-blue-50 text-blue-600 px-4 py-2 rounded-md hover:bg-blue-100 text-sm font-medium transition">
                    Refresh
                </button>
            </div>
        </div>
    </nav>

    <main class="max-w-6xl mx-auto p-4 mt-4">
        <div id="view-list" class="space-y-3 block">
            <div id="email-list" class="grid gap-3">
                <div class="text-center py-10 text-gray-400">Memuat email...</div>
            </div>
        </div>

        <div id="view-detail" class="hidden bg-white rounded-xl shadow-sm border overflow-hidden">
            <div class="bg-gray-50 border-b p-4 flex justify-between items-center sticky top-0">
                <button onclick="closeDetail()" class="flex items-center gap-2 text-gray-600 hover:text-blue-600 font-medium transition">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    Kembali
                </button>
                <button id="btn-delete-detail" class="text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-1">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    Hapus
                </button>
            </div>

            <div class="p-6 border-b">
                <h2 id="detail-subject" class="text-2xl font-bold text-gray-900 mb-4">Memuat...</h2>
                <div class="flex justify-between items-center text-sm">
                    <div>
                        <p class="text-gray-900 font-semibold" id="detail-sender">-</p>
                        <p class="text-gray-500 mt-0.5">Kepada: <span id="detail-recipient">-</span></p>
                    </div>
                    <div class="text-right text-gray-500" id="detail-date">-</div>
                </div>
            </div>

            <div class="bg-white">
                <iframe id="detail-frame" class="w-full min-h-[600px] border-none"
                    sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin">
                </iframe>
            </div>
        </div>
    </main>

    <script>
        let allEmails = [];
        const viewList = document.getElementById('view-list');
        const viewDetail = document.getElementById('view-detail');
        const navActions = document.getElementById('nav-actions');

        async function loadEmails() {
            const container = document.getElementById('email-list');
            try {
                const res = await fetch('/api/emails');
                allEmails = await res.json();
                renderEmails(allEmails);
            } catch (err) {
                container.innerHTML = '<p class="text-red-500 text-center py-10">Gagal memuat data email.</p>';
            }
        }

        function renderEmails(emails) {
            const container = document.getElementById('email-list');
            if (emails.length === 0) {
                container.innerHTML = '<div class="bg-white p-10 text-center rounded-xl shadow-sm text-gray-500">Inbox kosong.</div>';
                return;
            }
            container.innerHTML = emails.map(e => \`
                <div onclick="openDetail(\${e.id})" class="bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:border-blue-300 hover:shadow-md transition cursor-pointer flex gap-4 items-center group">
                    <div class="flex-none w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold uppercase">
                        \${e.sender.charAt(0)}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-baseline mb-1">
                            <h3 class="font-bold text-gray-800 truncate pr-4">\${e.sender}</h3>
                            <span class="text-xs text-gray-400 whitespace-nowrap">\${new Date(e.received_at).toLocaleDateString('id-ID', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}</span>
                        </div>
                        <p class="text-sm text-gray-600 font-medium truncate">\${e.subject || '(Tanpa Subjek)'}</p>
                    </div>
                </div>
            \`).join('');
        }

        // Fitur Pencarian List
        document.getElementById('searchInput').addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = allEmails.filter(mail =>
                (mail.subject && mail.subject.toLowerCase().includes(term)) ||
                (mail.sender && mail.sender.toLowerCase().includes(term))
            );
            renderEmails(filtered);
        });

        // BUKA DETAIL EMAIL
        async function openDetail(id) {
            viewList.classList.add('hidden');
            navActions.classList.add('hidden');
            viewDetail.classList.remove('hidden');

            document.getElementById('detail-subject').textContent = 'Memuat isi email...';
            document.getElementById('detail-frame').srcdoc = '<div style="font-family:sans-serif; padding:20px; color:#666;">Memuat konten...</div>';

            try {
                const res = await fetch(\`/api/emails/\${id}\`);
                const email = await res.json();

                document.getElementById('detail-subject').textContent = email.subject || '(Tanpa Subjek)';
                document.getElementById('detail-sender').textContent = email.sender;
                document.getElementById('detail-recipient').textContent = email.recipient;
                document.getElementById('detail-date').textContent = new Date(email.received_at).toLocaleString('id-ID');

                // Set action tombol hapus di dalam detail view
                const btnDelete = document.getElementById('btn-delete-detail');
                btnDelete.onclick = () => { deleteEmail(id, true); };

                // Prioritaskan HTML, jika tidak ada gunakan raw text dengan format PRE
                let content = email.body_html;
                if (!content) {
                    content = \`<pre style="font-family: sans-serif; white-space: pre-wrap; word-wrap: break-word; padding: 20px;">\${email.body_text}</pre>\`;
                }
                document.getElementById('detail-frame').srcdoc = content;

            } catch (err) {
                document.getElementById('detail-subject').textContent = 'Error memuat email';
            }
        }

        // TUTUP DETAIL EMAIL
        function closeDetail() {
            viewDetail.classList.add('hidden');
            viewList.classList.remove('hidden');
            navActions.classList.remove('hidden');
            // Bersihkan iframe agar video/audio di dalam email (jika ada) berhenti memutar
            document.getElementById('detail-frame').srcdoc = '';
        }

        // FUNGSI HAPUS
        async function deleteEmail(id, closeView = false) {
            if (!confirm('Hapus email ini secara permanen?')) return;

            await fetch(\`/api/emails/\${id}\`, { method: 'DELETE' });

            if (closeView) closeDetail();
            loadEmails();
        }

        async function init() {
            await loadEmails(); // Tunggu sampai list email dimuat

            const urlParams = new URLSearchParams(window.location.search);
            const emailId = urlParams.get('id');

            if (emailId) {
                window.history.replaceState({}, document.title, window.location.pathname);
                openDetail(emailId);
            }
        }

        init();

        setInterval(() => {
            if (!viewList.classList.contains('hidden')) {
                loadEmails();
            }
        }, 30000);
    </script>
</body>
</html>
`;
