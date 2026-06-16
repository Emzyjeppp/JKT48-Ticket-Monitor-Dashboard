let semuaMasterData = [];
let filterJenisAktif = 'SEMUA';
let filterEventAktif = 'SEMUA';
let urutanAktif = 'TERSEDIA';
let fetchTimeout = null;

// Ganti dengan URL Cloudflare Worker Anda setelah dideploy
const API_URL = 'https://jkt48-monitor-api.jefryoconner49.workers.dev';

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

// Mengambil data dari berkas data.json lokal hasil generate server GitHub Actions atau Cloudflare Worker
async function bacaDataLokal() {
    // Reset bar visual & jadwal reload otomatis (15 detik)
    resetProgressBar();
    if (fetchTimeout) clearTimeout(fetchTimeout);
    fetchTimeout = setTimeout(bacaDataLokal, 15000);

    const statusDiv = document.getElementById('statusFetch');
    try {
        const fetchUrl = API_URL.startsWith('http') ? API_URL : API_URL + '?_cb=' + new Date().getTime();
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
        statusDiv.innerText = "⚠️ Menunggu Server Generate";
        statusDiv.className = "text-xs font-bold text-amber-400";
        document.getElementById('tableBody').innerHTML = `
            <tr>
                <td colspan="7" class="p-8 text-center text-amber-300">
                    ${error.message}<br>
                    <span class="text-xs text-slate-400 block mt-1">Silakan picu manual di tab GitHub Actions atau tunggu bot melakukan cron job terjadwal.</span>
                </td>
            </tr>`;
    }
}

// Handler perubahan filter tombol Kategori
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

// Handler perubahan filter tombol Lokasi
function setEventFilter(evt) {
    filterEventAktif = evt;
    renderEventFilterButtons(semuaMasterData);
    filterData();
}

// Fungsi menggambar tombol saringan event secara dinamis
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

// Handler perubahan urutan tampilan (Sort)
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

// Fungsi penyaringan gabungan (Multi-filter)
function filterData() {
    const keyword = document.getElementById('searchFilter').value.toLowerCase();
    
    let hasilFilter = semuaMasterData.filter(item => {
        const cocokKeyword = item.nama.toLowerCase().includes(keyword) || item.sesi.toLowerCase().includes(keyword) || item.jalur.toLowerCase().includes(keyword);
        const cocokJenis = (filterJenisAktif === 'SEMUA') || (item.jenis === filterJenisAktif);
        const cocokEvent = (filterEventAktif === 'SEMUA') || (item.event === filterEventAktif);
        
        return cocokKeyword && cocokJenis && cocokEvent;
    });
    
    if (urutanAktif === 'TERSEDIA') {
        hasilFilter.sort((a, b) => {
            if (a.sisa === 0 && b.sisa !== 0) return 1;
            if (a.sisa !== 0 && b.sisa === 0) return -1;
            return a.sisa - b.sisa;
        });
    } else if (urutanAktif === 'SOLDOUT') {
        hasilFilter.sort((a, b) => {
            if (a.sisa === 0 && b.sisa !== 0) return -1;
            if (a.sisa !== 0 && b.sisa === 0) return 1;
            return a.sisa - b.sisa;
        });
    }
    
    renderTabel(hasilFilter);
}

// Fungsi menyuntikkan manipulasi baris ke dalam HTML DOM Tabel
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

        tbody.innerHTML += `
            <tr class="${rowBg}">
                <td class="p-4 font-bold text-xs text-sky-400 uppercase tracking-wider">${item.event}</td>
                <td class="p-4">${jenisBadge}</td>
                <td class="p-4 font-medium text-slate-300 text-xs">${item.sesi}</td>
                <td class="p-4 font-bold text-slate-100">${item.nama} <span class="block text-slate-400 font-normal text-xs mt-0.5">${item.jalur}</span></td>
                <td class="p-4 text-center font-mono font-semibold text-slate-400">${item.terjual}</td>
                <td class="p-4 text-center font-mono font-bold text-emerald-400 text-base">${item.sisa}</td>
                <td class="p-4 text-center">${statusBadge}</td>
            </tr>
        `;
    });
}

// Fungsi merender riwayat aktivitas sold out terkini
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

// Eksekusi pemanggilan otomatis saat halaman pertama kali dibuka
window.onload = function() {
    bacaDataLokal();
};

