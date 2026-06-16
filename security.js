// 1. Tantangan Keamanan Halaman (Gatekeeper Prompt)
if (!window.location.hostname.includes('localhost') && !window.location.protocol.includes('file')) {
    const jawaban = prompt("Pertanyaan Keamanan: Siapa oshi emzyjeppp?");
    if (!jawaban || jawaban.trim().toLowerCase() !== "lana") {
        alert("Jawaban salah atau dibatalkan! Akses ditolak. 😉");
        window.location.href = "https://youtu.be/dQw4w9WgXcQ?si=8EuZqnNVZrtZ1Q_h";
        throw new Error("Akses ditolak: Jawaban salah.");
    }
}

// Proteksi Anti-F12 / Inspect Element
if (!window.location.hostname.includes('localhost') && !window.location.protocol.includes('file')) {
    // 1. Blokir Klik Kanan + Peringatan + Rickroll
    document.addEventListener('contextmenu', event => {
        event.preventDefault();
        alert("Eits! Klik kanan dinonaktifkan untuk melindungi hak cipta halaman JKT48 Monitor ini! 😉");
        window.location.href = "https://youtu.be/dQw4w9WgXcQ?si=8EuZqnNVZrtZ1Q_h";
    });

    // 2. Blokir Tombol Pintasan + Peringatan + Rickroll
    document.addEventListener('keydown', event => {
        if (event.keyCode === 123) { // F12
            event.preventDefault();
            alert("Akses Developer Tools (F12) dinonaktifkan! 😉");
            window.location.href = "https://youtu.be/dQw4w9WgXcQ?si=8EuZqnNVZrtZ1Q_h";
            return false;
        }
        if (event.ctrlKey && event.shiftKey && (event.keyCode === 73 || event.keyCode === 74 || event.keyCode === 67)) { // Ctrl+Shift+I/J/C
            event.preventDefault();
            alert("Fitur Inspect Element dinonaktifkan! 😉");
            window.location.href = "https://youtu.be/dQw4w9WgXcQ?si=8EuZqnNVZrtZ1Q_h";
            return false;
        }
        if (event.ctrlKey && event.keyCode === 85) { // Ctrl+U (View Source)
            event.preventDefault();
            alert("Fitur View Source (Ctrl+U) dinonaktifkan! 😉");
            window.location.href = "https://youtu.be/dQw4w9WgXcQ?si=8EuZqnNVZrtZ1Q_h";
            return false;
        }
        if (event.ctrlKey && (event.keyCode === 67 || event.key === 'c' || event.key === 'C')) { // Ctrl+C
            event.preventDefault();
            alert("Fitur Copy (Ctrl+C) dinonaktifkan! 😉");
            window.location.href = "https://youtu.be/dQw4w9WgXcQ?si=8EuZqnNVZrtZ1Q_h";
            return false;
        }
    });

    // 3. Blokir Event Copy / Salin Teks + Rickroll
    document.addEventListener('copy', event => {
        event.preventDefault();
        alert("Fitur Menyalin Teks dinonaktifkan! 😉");
        window.location.href = "https://youtu.be/dQw4w9WgXcQ?si=8EuZqnNVZrtZ1Q_h";
    });

    // 4. Loop Debugger
    setInterval(function() {
        debugger;
    }, 100);
}
