// Global Variables
let semuaMasterData = [];
let filterJenisAktif = 'SEMUA';
let filterEventAktif = 'SEMUA';
let urutanAktif = 'TERSEDIA';
let oshiBookmarks = JSON.parse(localStorage.getItem('oshiBookmarks')) || [];
let fetchTimeout = null;

// Tipe data & data hasil parsing untuk Halaman 3 (JSON Reader)
let jsonDataType = 'EXCLUSIVES';
let semuaJsonMasterData = [];

// URL Cloudflare Worker API
const API_URL = 'https://jkt48-monitor-api.jefryoconner49.workers.dev';

// ==========================================
// SPA NAVIGATION
// ==========================================
function navigateTo(view) {
    // Sembunyikan semua view
    document.getElementById('portalView').classList.add('hidden');
    document.getElementById('exclusivesView').classList.add('hidden');
    document.getElementById('theaterView').classList.add('hidden');
    document.getElementById('jsonReaderView').classList.add('hidden');

    // Matikan timer jika keluar dari halaman exclusives
    if (view !== 'exclusives' && fetchTimeout) {
        clearTimeout(fetchTimeout);
        fetchTimeout = null;
    }

    // Tampilkan view yang dituju
    if (view === 'portal') {
        document.getElementById('portalView').classList.remove('hidden');
        document.title = "JKT48 Advanced Ticket & Theater Monitor";
    } else if (view === 'exclusives') {
        document.getElementById('exclusivesView').classList.remove('hidden');
        document.title = "JKT48 Exclusives Ticket Monitor";
        bacaDataLokal(); // Trigger pemuatan otomatis
    } else if (view === 'theater') {
        document.getElementById('theaterView').classList.remove('hidden');
        document.title = "JKT48 Theater Ticket Monitor";
    } else if (view === 'jsonReader') {
        document.getElementById('jsonReaderView').classList.remove('hidden');
        document.title = "JKT48 Dump JSON Parser";
    }
}


// ==========================================
// UTILITIES (DATE FORMATTER)
// ==========================================
function formatWIB(isoString) {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '-';
    
    const tanggal = d.getDate();
    const bulan = d.toLocaleDateString('id-ID', { month: 'short' });
    const tahun = d.getFullYear();
    const jam = String(d.getHours()).padStart(2, '0');
    const menit = String(d.getMinutes()).padStart(2, '0');
    
    return `${tanggal} ${bulan} ${tahun}, ${jam}:${menit} WIB`;
}


// ==========================================
// HALAMAN 1: TIKET EVENT EXCLUSIVES (MNG, 2S, VC)
// ==========================================

// Fungsi mereset animasi bar waktu hitung mundur auto-refresh
function resetProgressBar() {
    const progressBar = document.getElementById('refreshProgress');
    if (!progressBar) return;
    
    progressBar.style.transition = 'none';
    progressBar.style.width = '0%';
    
    // Trigger reflow untuk mereset transition state browser
    progressBar.offsetHeight;
    
    progressBar.style.transition = 'width 15000ms linear';
    progressBar.style.width = '100%';
}

// Fungsi bookmark/pin oshi ke posisi teratas
function toggleOshi(memberName) {
    const idx = oshiBookmarks.indexOf(memberName);
    if (idx > -1) {
        oshiBookmarks.splice(idx, 1);
    } else {
        oshiBookmarks.push(memberName);
    }
    localStorage.setItem('oshiBookmarks', JSON.stringify(oshiBookmarks));
    filterData();
}

// Mengambil data dari Cloudflare Worker API
async function bacaDataLokal() {
    // Reset bar visual & jadwal reload otomatis (15 detik)
    resetProgressBar();
    if (fetchTimeout) clearTimeout(fetchTimeout);
    fetchTimeout = setTimeout(bacaDataLokal, 15000);

    const statusDiv = document.getElementById('statusFetch');
    try {
        const fetchUrl = API_URL + '?_cb=' + new Date().getTime();
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error("Gagal mengambil data kuota JKT48.");
        
        const dataJson = await response.json();
        semuaMasterData = dataJson.data || [];
        
        // Render saringan event secara dinamis
        renderEventFilterButtons(semuaMasterData);
        
        // Perbarui log riwayat transaksi
        renderHistory(dataJson.history || []);
        
        document.getElementById('lastUpdate').innerText = `Terakhir Sync JKT48: ${dataJson.last_updated || '-'}`;
        statusDiv.innerText = "🟢 Data Sinkron";
        statusDiv.className = "text-xs font-bold text-emerald-400";
        
        filterData();
    } catch (error) {
        statusDiv.innerText = "⚠️ Gangguan Koneksi";
        statusDiv.className = "text-xs font-bold text-rose-400";
        document.getElementById('tableBody').innerHTML = `
            <tr>
                <td colspan="7" class="p-8 text-center text-rose-300">
                    ${error.message}<br>
                    <span class="text-xs text-slate-400 block mt-1">Pastikan API Cloudflare Worker Anda aktif dan parameter CORS telah disetel dengan benar.</span>
                </td>
            </tr>`;
    }
}

function setJenisFilter(jenis) {
    filterJenisAktif = jenis;
    ['SEMUA', 'Photocard', '2-Shot', 'Video Call'].forEach(j => {
        const btn = document.getElementById(`btn-jns-${j}`);
        if(btn) {
            if(j === jenis) {
                btn.className = "px-4 py-2 rounded-lg text-sm font-bold bg-rose-600 text-white cursor-pointer transition";
            } else {
                btn.className = "px-4 py-2 rounded-lg text-sm font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 cursor-pointer transition";
            }
        }
    });
    filterData();
}

function setEventFilter(evt) {
    filterEventAktif = evt;
    renderEventFilterButtons(semuaMasterData);
    filterData();
}

function renderEventFilterButtons(data) {
    const container = document.getElementById('eventFilterContainer');
    if (!container) return;
    
    const daftarEvent = [...new Set(data.map(item => item.event))];
    
    let html = `
        <button onclick="setEventFilter('SEMUA')" class="px-4 py-1.5 rounded-md text-xs transition cursor-pointer ${
            filterEventAktif === 'SEMUA' 
            ? 'bg-sky-600 text-white font-bold' 
            : 'bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold'
        }">
            Semua Event
        </button>
    `;
    
    daftarEvent.forEach(e => {
        html += `
            <button onclick="setEventFilter('${e}')" class="px-4 py-1.5 rounded-md text-xs transition cursor-pointer ${
                filterEventAktif === e 
                ? 'bg-sky-600 text-white font-bold' 
                : 'bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold'
            }">
                ${e}
            </button>
        `;
    });
    
    container.innerHTML = html;
}

function setUrutanFilter(urutan) {
    urutanAktif = urutan;
    ['TERSEDIA', 'SOLDOUT'].forEach(u => {
        const btn = document.getElementById(`btn-sort-${u}`);
        if (btn) {
            if (u === urutan) {
                btn.className = "px-4 py-1.5 rounded-md text-xs font-bold bg-emerald-600 text-white cursor-pointer transition";
            } else {
                btn.className = "px-4 py-1.5 rounded-md text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-300 cursor-pointer transition";
            }
        }
    });
    filterData();
}

function filterData() {
    const keyword = document.getElementById('searchFilter').value.toLowerCase();
    
    let hasilFilter = semuaMasterData.filter(item => {
        const cocokKeyword = item.nama.toLowerCase().includes(keyword) || item.sesi.toLowerCase().includes(keyword) || item.jalur.toLowerCase().includes(keyword);
        const cocokJenis = (filterJenisAktif === 'SEMUA') || (item.jenis === filterJenisAktif);
        const cocokEvent = (filterEventAktif === 'SEMUA') || (item.event === filterEventAktif);
        
        return cocokKeyword && cocokJenis && cocokEvent;
    });
    
    hasilFilter.sort((a, b) => {
        const aIsOshi = oshiBookmarks.includes(a.nama);
        const bIsOshi = oshiBookmarks.includes(b.nama);

        // Oshi yang dipin selalu berada paling atas
        if (aIsOshi && !bIsOshi) return -1;
        if (!aIsOshi && bIsOshi) return 1;

        if (urutanAktif === 'TERSEDIA') {
            if (a.sisa === 0 && b.sisa !== 0) return 1;
            if (a.sisa !== 0 && b.sisa === 0) return -1;
            return a.sisa - b.sisa;
        } else if (urutanAktif === 'SOLDOUT') {
            if (a.sisa === 0 && b.sisa !== 0) return -1;
            if (a.sisa !== 0 && b.sisa === 0) return 1;
            return a.sisa - b.sisa;
        }
        return 0;
    });
    
    renderTabel(hasilFilter);
}

function renderTabel(data) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    if(data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-500">Tidak ada tiket oshi atau benefit yang sesuai filter saat ini.</td></tr>`;
        return;
    }

    data.forEach(item => {
        let statusBadge = `<span class="px-2 py-1 text-xs font-bold rounded bg-green-500/20 text-green-400 whitespace-nowrap">Tersedia</span>`;
        let rowBg = "hover:bg-slate-700/30 transition";

        if (item.sisa === 0) {
            statusBadge = `<span class="px-2 py-1 text-xs font-bold rounded bg-rose-500/20 text-rose-400 whitespace-nowrap">SOLD OUT</span>`;
            rowBg = "bg-rose-950/10 text-slate-500 hover:bg-rose-950/20";
        } else if (item.sisa <= 5) {
            statusBadge = `<span class="px-2 py-1 text-xs font-bold rounded bg-amber-500/20 text-amber-400 animate-pulse whitespace-nowrap">Menipis</span>`;
            rowBg = "bg-amber-950/10 hover:bg-amber-950/20 text-amber-100";
        }

        const jenisBadge = item.jenis === 'Photocard' 
            ? `<span class="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 whitespace-nowrap">🤝 Photocard</span>`
            : (item.jenis === '2-Shot'
               ? `<span class="px-2 py-0.5 rounded text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30 whitespace-nowrap">📸 2-Shot</span>`
               : `<span class="px-2 py-0.5 rounded text-xs font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/30 whitespace-nowrap">📞 Video Call</span>`);

        const isOshi = oshiBookmarks.includes(item.nama);
        const starButton = isOshi 
            ? `<button onclick="toggleOshi('${item.nama}')" class="text-amber-400 hover:text-amber-300 mr-2 focus:outline-none transition cursor-pointer text-base select-none">⭐</button>`
            : `<button onclick="toggleOshi('${item.nama}')" class="text-slate-600 hover:text-amber-400 mr-2 focus:outline-none transition cursor-pointer text-base select-none">☆</button>`;

        tbody.innerHTML += `
            <tr class="${rowBg}">
                <td class="p-4 font-bold text-xs text-sky-400 uppercase tracking-wider">${item.event}</td>
                <td class="p-4">${jenisBadge}</td>
                <td class="p-4 font-medium text-slate-300 text-xs">${item.sesi}</td>
                <td class="p-4 font-bold text-slate-100 flex items-center">${starButton}<div>${item.nama} <span class="block text-slate-400 font-normal text-xs mt-0.5">${item.jalur}</span></div></td>
                <td class="p-4 text-center font-mono font-semibold text-slate-400">${item.terjual}</td>
                <td class="p-4 text-center font-mono font-bold text-emerald-400 text-base">${item.sisa}</td>
                <td class="p-4 text-center">${statusBadge}</td>
            </tr>
        `;
    });
}

function renderHistory(historyList) {
    const historyDiv = document.getElementById('historyLog');
    if (!historyList || historyList.length === 0) {
        historyDiv.innerHTML = `<div class="py-1 text-slate-500 italic">Belum ada riwayat tiket sold out yang tercatat. Data akan muncul otomatis saat tiket member mulai habis.</div>`;
        return;
    }

    historyDiv.innerHTML = historyList.map(item => {
        const badge = `<span class="px-2 py-0.5 text-[9px] font-bold rounded bg-rose-500/20 text-rose-400 animate-pulse border border-rose-500/30 whitespace-nowrap">🔥 SOLD OUT</span>`;
        const textClass = 'text-rose-300 font-bold';

        let jenisBadge = '';
        if (item.jenis === 'Photocard') {
            jenisBadge = `<span class="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 whitespace-nowrap">🤝 PC</span>`;
        } else if (item.jenis === '2-Shot') {
            jenisBadge = `<span class="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-purple-500/10 text-purple-400 border border-purple-500/30 whitespace-nowrap">📸 2S</span>`;
        } else {
            jenisBadge = `<span class="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-teal-500/10 text-teal-400 border border-teal-500/30 whitespace-nowrap">📞 VC</span>`;
        }

        const detailEvent = `[${item.event}]`;
        const detailSesi = `${item.sesi} - ${item.nama} (${item.jalur})`;
        const detailJumlah = `telah HABIS (SOLD OUT)!`;

        return `
            <div class="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-700/50 last:border-b-0">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-slate-500 font-semibold">[${item.waktu}]</span>
                    ${badge}
                    ${jenisBadge}
                    <span class="${textClass}">${detailSesi} ${detailJumlah}</span>
                </div>
                <div class="text-[10px] text-slate-500">${detailEvent}</div>
            </div>
        `;
    }).join('');
}


// ==========================================
// HALAMAN 2: LIVE MONITOR TICKET THEATER
// ==========================================
async function muatKuotaTheater() {
    const codeInput = document.getElementById('theaterCodeInput').value.trim().toUpperCase();
    const statusLabel = document.getElementById('theaterStatus');
    const tableBody = document.getElementById('theaterTableBody');
    const dashboardSection = document.getElementById('theaterDashboardSection');

    if (!codeInput) {
        alert("Harap masukkan Show Code terlebih dahulu! (Contoh: SHEB90)");
        return;
    }

    statusLabel.innerText = "⏳ Menghubungi API...";
    statusLabel.className = "text-xs font-bold text-sky-400";
    dashboardSection.classList.add('hidden');
    tableBody.innerHTML = '';

    try {
        const fetchUrl = `${API_URL}/api/theater?code=${codeInput}&_cb=${new Date().getTime()}`;
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error("Gagal mengambil data show. Periksa apakah kode show benar.");

        const resJson = await response.json();
        if (!resJson.status || !resJson.data) throw new Error(resJson.message || "Data show tidak ditemukan.");

        const show = resJson.data;
        const title = show.title || 'Theater Show';
        const dateFormatted = new Date(show.date).toLocaleDateString('id-ID', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        const time = show.start_time || '19:00';
        const showStatus = show.status; // status keaktifan show

        const sales = show.sales_period || [];
        if (sales.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-500">Tidak ada periode penjualan aktif untuk show ini.</td></tr>`;
            statusLabel.innerText = "🔴 Show Tidak Aktif";
            statusLabel.className = "text-xs font-bold text-rose-400";
            dashboardSection.classList.remove('hidden');
            return;
        }

        let parsedData = [];
        sales.forEach(period => {
            const periodLabel = period.label || 'Ticket';
            const method = period.sales_method || 'FCFS';
            const start = new Date(period.start_date);
            const end = new Date(period.end_date);
            const now = new Date();

            const salesPeriodText = `${formatWIB(period.start_date)} - ${formatWIB(period.end_date)}`;

            // Tentukan status ketersediaan tiket
            let statusText = 'Tersedia';
            if (!showStatus) {
                statusText = 'SOLD OUT';
            } else if (now < start) {
                statusText = 'Belum Dibuka';
            } else if (now > end) {
                statusText = 'SOLD OUT / TUTUP';
            }

            const pricingList = period.pricing || [];
            pricingList.forEach(price => {
                parsedData.push({
                    showTitle: title,
                    dateTime: `${dateFormatted} @ ${time}`,
                    category: `${periodLabel} - ${price.label}`,
                    salesPeriod: salesPeriodText,
                    quota: price.quota || 0,
                    method: method,
                    price: price.price || 0,
                    status: statusText
                });
            });
        });

        // Gambar ke tabel
        parsedData.forEach(item => {
            let statusBadge = `<span class="px-2 py-1 text-xs font-bold rounded bg-green-500/20 text-green-400 whitespace-nowrap">Tersedia</span>`;
            let rowBg = "hover:bg-slate-700/30 transition";

            if (item.status.includes('SOLD OUT') || item.status.includes('TUTUP')) {
                statusBadge = `<span class="px-2 py-1 text-xs font-bold rounded bg-rose-500/20 text-rose-400 whitespace-nowrap">${item.status}</span>`;
                rowBg = "bg-rose-950/10 text-slate-500 hover:bg-rose-950/20";
            } else if (item.status === 'Belum Dibuka') {
                statusBadge = `<span class="px-2 py-1 text-xs font-bold rounded bg-amber-500/20 text-amber-400 whitespace-nowrap">${item.status}</span>`;
                rowBg = "bg-amber-950/10 text-slate-400";
            }

            tableBody.innerHTML += `
                <tr class="${rowBg}">
                    <td class="p-4 font-bold text-slate-200">${item.showTitle}</td>
                    <td class="p-4 text-slate-300 text-xs font-medium">${item.dateTime}</td>
                    <td class="p-4 text-slate-400 text-xs">${item.category} (Rp ${item.price.toLocaleString('id-ID')})</td>
                    <td class="p-4 text-slate-300 text-xs font-mono text-center">${item.salesPeriod}</td>
                    <td class="p-4 text-center font-mono font-semibold">${item.quota}</td>
                    <td class="p-4 text-center font-mono text-xs font-semibold text-sky-400">${item.method}</td>
                    <td class="p-4 text-center">${statusBadge}</td>
                </tr>
            `;
        });

        statusLabel.innerText = "🟢 Data Sinkron";
        statusLabel.className = "text-xs font-bold text-emerald-400";
        dashboardSection.classList.remove('hidden');

    } catch (error) {
        statusLabel.innerText = "⚠️ Gangguan Koneksi";
        statusLabel.className = "text-xs font-bold text-rose-400";
        alert(error.message);
    }
}


// ==========================================
// HALAMAN 3: PEMBACA DUMP JSON (MANUAL PARSER)
// ==========================================
function prosesDump() {
    const rawText = document.getElementById('jsonInput').value.trim();
    if(!rawText) {
        alert('Teks JSON kosong! Salin dulu dari Network Tab.');
        return;
    }

    try {
        const parsed = JSON.parse(rawText);
        const showData = parsed.data || parsed;
        
        if (showData && (showData.theater_show_id || showData.sales_period || showData.set_list)) {
            jsonDataType = 'THEATER';
            prosesJsonTheater(showData);
        } else {
            jsonDataType = 'EXCLUSIVES';
            prosesJsonExclusives(showData);
        }

        // Tampilkan elemen dashboard & live search
        document.getElementById('jsonDashboardSection').classList.remove('hidden');
        document.getElementById('jsonSearchFilter').classList.remove('hidden');
        document.getElementById('jsonLastUpdate').innerText = `Terakhir Update: ${new Date().toLocaleTimeString('id-ID')} WIB`;

    } catch (error) {
        alert('Gagal membaca JSON. Pastikan seluruh teks tercopy dengan sempurna ya!\nError: ' + error.message);
    }
}

function prosesJsonExclusives(dataSesi) {
    const sessionsArray = Array.isArray(dataSesi) ? dataSesi : [dataSesi];
    semuaJsonMasterData = []; // Reset

    sessionsArray.forEach(sesi => {
        const labelSesi = sesi.label || 'Sesi';
        const sesiSingkat = labelSesi.split('·')[0].trim();

        if(sesi.session_members && Array.isArray(sesi.session_members)) {
            sesi.session_members.forEach(m => {
                semuaJsonMasterData.push({
                    sesi: sesiSingkat,
                    jalur: m.label || '-',
                    nama: m.member_name,
                    terjual: m.tickets_sold,
                    sisa: m.quota
                });
            });
        }
    });

    semuaJsonMasterData.sort((a, b) => a.sisa - b.sisa);

    updateJsonTableHeaders('EXCLUSIVES');
    renderJsonTabel(semuaJsonMasterData);
}

function prosesJsonTheater(show) {
    semuaJsonMasterData = []; // Reset

    const title = show.title || 'Theater Show';
    const dateFormatted = new Date(show.date).toLocaleDateString('id-ID', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const time = show.start_time || '19:00';
    const showStatus = show.status; // boolean

    const sales = show.sales_period || [];
    sales.forEach(period => {
        const periodLabel = period.label || 'Ticket';
        const method = period.sales_method || 'FCFS';
        const start = new Date(period.start_date);
        const end = new Date(period.end_date);
        const now = new Date();

        const salesPeriodText = `${formatWIB(period.start_date)} - ${formatWIB(period.end_date)}`;

        let statusText = 'Tersedia';
        if (!showStatus) {
            statusText = 'SOLD OUT';
        } else if (now < start) {
            statusText = 'Belum Dibuka';
        } else if (now > end) {
            statusText = 'SOLD OUT / TUTUP';
        }

        const pricingList = period.pricing || [];
        pricingList.forEach(price => {
            semuaJsonMasterData.push({
                showTitle: title,
                dateTime: `${dateFormatted} @ ${time}`,
                category: `${periodLabel} - ${price.label}`,
                salesPeriod: salesPeriodText,
                quota: price.quota || 0,
                method: method,
                price: price.price || 0,
                status: statusText
            });
        });
    });

    semuaJsonMasterData.sort((a, b) => {
        if (a.status === 'Tersedia' && b.status !== 'Tersedia') return -1;
        if (a.status !== 'Tersedia' && b.status === 'Tersedia') return 1;
        return 0;
    });

    updateJsonTableHeaders('THEATER');
    renderJsonTabel(semuaJsonMasterData);
}

function updateJsonTableHeaders(type) {
    const thead = document.getElementById('jsonTableHeader');
    if (type === 'THEATER') {
        thead.innerHTML = `
            <tr class="bg-slate-700/50 text-slate-300 text-xs font-bold uppercase tracking-wider border-b border-slate-700">
                <th class="p-4">Show / Setlist</th>
                <th class="p-4">Tanggal & Jam Show</th>
                <th class="p-4">Kategori Tiket</th>
                <th class="p-4 text-center">Periode Penjualan</th>
                <th class="p-4 text-center">Kuota Awal</th>
                <th class="p-4 text-center">Metode</th>
                <th class="p-4 text-center">Status</th>
            </tr>
        `;
    } else {
        thead.innerHTML = `
            <tr class="bg-slate-700/50 text-slate-300 text-xs font-bold uppercase tracking-wider border-b border-slate-700">
                <th class="p-4">Sesi / Event</th>
                <th class="p-4">Jalur</th>
                <th class="p-4 text-rose-300">Nama Member</th>
                <th class="p-4 text-center">Tiket Terjual</th>
                <th class="p-4 text-center">Sisa Stok</th>
                <th class="p-4 text-center">Status</th>
            </tr>
        `;
    }
}

function renderJsonTabel(data) {
    const tbody = document.getElementById('jsonTableBody');
    tbody.innerHTML = '';

    const colCount = jsonDataType === 'THEATER' ? 7 : 6;

    if(data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${colCount}" class="p-8 text-center text-slate-500">Tidak ada data yang cocok.</td></tr>`;
        return;
    }

    data.forEach(item => {
        let row = '';
        if (jsonDataType === 'THEATER') {
            let statusBadge = `<span class="px-2 py-1 text-xs font-bold rounded bg-green-500/20 text-green-400 whitespace-nowrap">Tersedia</span>`;
            let rowBg = "hover:bg-slate-700/30 transition";

            if (item.status.includes('SOLD OUT') || item.status.includes('TUTUP')) {
                statusBadge = `<span class="px-2 py-1 text-xs font-bold rounded bg-rose-500/20 text-rose-400 whitespace-nowrap">${item.status}</span>`;
                rowBg = "bg-rose-950/10 text-slate-500 hover:bg-rose-950/20";
            } else if (item.status === 'Belum Dibuka') {
                statusBadge = `<span class="px-2 py-1 text-xs font-bold rounded bg-amber-500/20 text-amber-400 whitespace-nowrap">${item.status}</span>`;
                rowBg = "bg-amber-950/10 text-slate-400";
            }

            row = `
                <tr class="${rowBg}">
                    <td class="p-4 font-bold text-slate-200">${item.showTitle}</td>
                    <td class="p-4 text-slate-300 text-xs font-medium">${item.dateTime}</td>
                    <td class="p-4 text-slate-400 text-xs">${item.category} (Rp ${item.price.toLocaleString('id-ID')})</td>
                    <td class="p-4 text-slate-300 text-xs font-mono text-center">${item.salesPeriod}</td>
                    <td class="p-4 text-center font-mono font-semibold">${item.quota}</td>
                    <td class="p-4 text-center font-mono text-xs font-semibold text-sky-400">${item.method}</td>
                    <td class="p-4 text-center">${statusBadge}</td>
                </tr>
            `;
        } else {
            let statusBadge = `<span class="px-2 py-1 text-xs font-bold rounded bg-green-500/20 text-green-400 whitespace-nowrap">Tersedia</span>`;
            let rowBg = "hover:bg-slate-700/30 transition";

            if (item.sisa === 0) {
                statusBadge = `<span class="px-2 py-1 text-xs font-bold rounded bg-rose-500/20 text-rose-400 whitespace-nowrap">SOLD OUT</span>`;
                rowBg = "bg-rose-950/10 text-slate-500 hover:bg-rose-950/20";
            } else if (item.sisa <= 5) {
                statusBadge = `<span class="px-2 py-1 text-xs font-bold rounded bg-amber-500/20 text-amber-400 animate-pulse whitespace-nowrap">Menipis</span>`;
                rowBg = "bg-amber-950/10 hover:bg-amber-950/20 text-amber-100";
            }

            row = `
                <tr class="${rowBg}">
                    <td class="p-4 font-medium text-slate-300">${item.sesi}</td>
                    <td class="p-4 text-slate-400 text-xs">${item.jalur}</td>
                    <td class="p-4 font-bold text-slate-200">${item.nama}</td>
                    <td class="p-4 text-center font-mono font-semibold">${item.terjual}</td>
                    <td class="p-4 text-center font-mono font-bold text-emerald-400">${item.sisa}</td>
                    <td class="p-4 text-center">${statusBadge}</td>
                </tr>
            `;
        }
        tbody.innerHTML += row;
    });
}

function filterJsonData() {
    const keyword = document.getElementById('jsonSearchFilter').value.toLowerCase();
    let hasilFilter = [];
    
    if (jsonDataType === 'THEATER') {
        hasilFilter = semuaJsonMasterData.filter(item => 
            item.showTitle.toLowerCase().includes(keyword) || 
            item.category.toLowerCase().includes(keyword) ||
            item.salesPeriod.toLowerCase().includes(keyword)
        );
    } else {
        hasilFilter = semuaJsonMasterData.filter(item => 
            item.nama.toLowerCase().includes(keyword) || 
            item.sesi.toLowerCase().includes(keyword)
        );
    }
    renderJsonTabel(hasilFilter);
}

// Navigasi ke portal default saat halaman selesai dimuat pertama kali
window.onload = function() {
    navigateTo('portal');
};
