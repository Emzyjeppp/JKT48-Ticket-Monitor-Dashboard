// C:\Users\jefry\.gemini\antigravity\scratch\jkt48-monitor\cloudflare-worker.js
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, event))
})

async function handleRequest(request, event) {
  const cacheUrl = new URL(request.url)
  const cacheKey = new Request(cacheUrl.toString(), request)
  const cache = caches.default

  // 1. Coba ambil data dari cache Cloudflare terlebih dahulu
  let response = await cache.match(cacheKey)
  if (response) {
    // Tambahkan/pastikan header CORS ada di respon cache
    const newHeaders = new Headers(response.headers)
    newHeaders.set('Access-Control-Allow-Origin', '*')
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    })
  }

  try {
    // 2. Jika tidak ada di cache, ambil data langsung dari API JKT48 secara paralel
    const [pcSbyRes, pcYogyaRes, shotSbyRes, shotYogyaRes] = await Promise.all([
      fetch("https://jkt48.com/api/v1/exclusives/EX9A4A/bonus?lang=id"),
      fetch("https://jkt48.com/api/v1/exclusives/EXCB75/bonus?lang=id"),
      fetch("https://jkt48.com/api/v1/exclusives/EX3773/bonus?lang=id"),
      fetch("https://jkt48.com/api/v1/exclusives/EXCD2C/bonus?lang=id")
    ])

    const pcSby = await pcSbyRes.json()
    const pcYogya = await pcYogyaRes.json()
    const shotSby = await shotSbyRes.json()
    const shotYogya = await shotYogyaRes.json()

    let output = []

    // Fungsi parsing data terstruktur
    function parseData(jsonData, jenisBenefit, namaEvent) {
      if (jsonData && jsonData.data && Array.isArray(jsonData.data)) {
        jsonData.data.forEach(sesi => {
          const labelSesi = sesi.label || 'Sesi'
          const sesiSingkat = labelSesi.split('·')[0].trim()
          
          if (sesi.session_members) {
            sesi.session_members.forEach(m => {
              output.push({
                sesi: sesiSingkat,
                event: namaEvent,
                jenis: jenisBenefit,
                jalur: m.label || '-',
                nama: m.member_name,
                terjual: m.tickets_sold,
                sisa: m.quota
              })
            })
          }
        })
      }
    }

    parseData(pcSby, 'Photocard', 'LOVE & DREAM (SBY)')
    parseData(pcYogya, 'Photocard', 'PASSION (YOGYA)')
    parseData(shotSby, '2-Shot', 'LOVE & DREAM (SBY)')
    parseData(shotYogya, '2-Shot', 'PASSION (YOGYA)')

    // Urutkan kuota tiket paling menipis ke paling atas
    output.sort((a, b) => a.sisa - b.sisa)

    // Format Waktu WIB
    const formatter = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      dateStyle: 'short',
      timeStyle: 'medium'
    })
    const waktuWIB = formatter.format(new Date()) + ' WIB'

    const finalData = {
      last_updated: waktuWIB,
      data: output
    }

    // Buat response dengan CORS enabled & Cache-Control (60 detik)
    response = new Response(JSON.stringify(finalData), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60' // Disimpan di cache browser & CDN selama 60 detik
      }
    })

    // Simpan ke cache Cloudflare
    event.waitUntil(cache.put(cacheKey, response.clone()))

    return response
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}
