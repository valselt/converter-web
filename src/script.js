let currentFile = null;
let selectedFormat = null;

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const actionPanel = document.getElementById('actionPanel');
const optionsGrid = document.getElementById('optionsGrid');
const convertBtn = document.getElementById('convertBtn');
const statusMsg = document.getElementById('statusMsg');
const resetBtn = document.getElementById('resetBtn');
const previewImage = document.getElementById('previewImage');
const defaultIcon = document.getElementById('defaultIcon');

// Elements Loader
const conversionLoader = document.getElementById('conversionLoader');
const conversionProgressFill = document.getElementById('conversionProgressFill');
const conversionStatusText = document.getElementById('conversionStatusText');

// Elements Validasi
const validControls = document.getElementById('validFileControls');
const errorView = document.getElementById('unsupportedView');

// --- EVENT LISTENERS ---
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => { dropzone.classList.remove('dragover'); });
dropzone.addEventListener('drop', (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', (e) => { handleFiles(e.target.files); });
resetBtn.addEventListener('click', resetUI);

function resetUI() {
    location.reload(); 
}

// --- FUNGSI BANTUAN ID ACAK ---
function generateProcessId() {
    return 'proc_' + Math.random().toString(36).substr(2, 9) + Date.now();
}

// --- TOMBOL KLIK KONVERSI (FULL LOGIC BARU) ---
convertBtn.addEventListener('click', async () => {
    if (!currentFile || !selectedFormat) return;

    // 1. UI Loading Awal
    convertBtn.classList.add('hidden');
    conversionLoader.classList.remove('hidden');
    conversionProgressFill.style.width = '0%';
    conversionStatusText.textContent = "Menghubungi Server...";

    // 2. Buat Process ID Unik
    const processId = generateProcessId();

    const formData = new FormData();
    formData.append('file', currentFile);
    formData.append('target_format', selectedFormat);
    formData.append('process_id', processId); // Kirim ID ke Server

    // 3. Jalankan Polling (Pengecekan Rutin)
    let progressInterval = setInterval(async () => {
        try {
            const res = await fetch(`backend/check_progress.php?id=${processId}`);
            const data = await res.json();
            
            if (data && data.percent) {
                // Update UI Realtime dari Server
                conversionProgressFill.style.width = data.percent + '%';
                conversionStatusText.textContent = data.message;
            }
        } catch (e) {
            // Ignore error polling (biar gak spam console)
        }
    }, 500); // Cek setiap setengah detik

    try {
        // 4. Kirim Request Utama (Proses ini akan memakan waktu lama)
        const response = await fetch('backend/process.php', {
            method: 'POST',
            body: formData
        });

        // 5. Setelah Selesai, Hentikan Polling
        clearInterval(progressInterval);

        const result = await response.json();

        if (result.status === 'success') {
            // Paksa bar ke 100%
            conversionProgressFill.style.width = '100%';
            conversionStatusText.textContent = "Selesai!";
            
            statusMsg.style.color = "green";
            statusMsg.textContent = "Konversi Berhasil!";
            
            // Auto Download
            const a = document.createElement('a');
            a.href = result.download_url;
            a.download = ''; 
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

        } else {
            throw new Error(result.message);
        }

    } catch (error) {
        clearInterval(progressInterval); // Hentikan polling jika error
        console.error(error);
        statusMsg.style.color = "red";
        statusMsg.textContent = "Gagal: " + error.message;
        convertBtn.classList.remove('hidden');
        conversionLoader.classList.add('hidden');
    }
});

function handleFiles(files) {
    if (files.length === 0) return;
    const file = files[0];
    currentFile = file;

    // UI Updates Awal
    dropzone.classList.add('hidden');
    actionPanel.classList.remove('hidden');
    
    // Info File
    document.getElementById('fileName').textContent = currentFile.name;
    document.getElementById('fileSize').textContent = (currentFile.size / 1024).toFixed(2) + ' KB';

    // LOGIKA VALIDASI & PREVIEW
    const isValidType = file.type === 'application/pdf' || file.type.startsWith('image/');

    if (isValidType) {
        // Tampilkan Kontrol, Sembunyikan Error
        if(validControls) validControls.classList.remove('hidden');
        if(errorView) errorView.classList.add('hidden');

        // Preview Logic
        if (currentFile.type.startsWith('image/')) {
            previewImage.src = URL.createObjectURL(currentFile);
            previewImage.classList.remove('hidden');
            defaultIcon.classList.add('hidden');
        } else {
            previewImage.classList.add('hidden');
            defaultIcon.classList.remove('hidden');
            defaultIcon.textContent = file.type === 'application/pdf' ? 'picture_as_pdf' : 'description';
        }

        generateOptions(currentFile.type);

    } else {
        // Tampilkan Error, Sembunyikan Kontrol
        if(validControls) validControls.classList.add('hidden');
        if(errorView) errorView.classList.remove('hidden');
        
        // Ikon Error
        previewImage.classList.add('hidden');
        defaultIcon.classList.remove('hidden');
        defaultIcon.textContent = 'warning'; 
    }
}

// --- LOGIKA FILTER OPSI (YANG DIPERBAIKI) ---
function generateOptions(mimeType) {
    optionsGrid.innerHTML = ''; 
    
    // CASE 1: INPUT ADALAH PDF -> Output ke Gambar
    if (mimeType === 'application/pdf') {
        createOptionCard('jpg', 'JPG', 'Gambar', 'photo_size_select_large');
        createOptionCard('png', 'PNG', 'Transparan', 'image');
        createOptionCard('webp', 'WEBP', 'Web Modern', 'public');
    }
    // CASE 2: INPUT ADALAH GAMBAR -> Output ke Gambar Lain / PDF
    else if (mimeType.startsWith('image/')) {
        
        // Cek: Hanya tampilkan JPG jika input BUKAN jpg
        if (!mimeType.includes('jpeg') && !mimeType.includes('jpg')) {
            createOptionCard('jpg', 'JPG', 'Ringan', 'photo_size_select_large');
        }

        // Cek: Hanya tampilkan PNG jika input BUKAN png
        if (!mimeType.includes('png')) {
            createOptionCard('png', 'PNG', 'Jernih', 'image');
        }

        // Cek: Hanya tampilkan WEBP jika input BUKAN webp
        if (!mimeType.includes('webp')) {
            createOptionCard('webp', 'WEBP', 'Web', 'public');
        }

        // PDF Selalu muncul untuk gambar
        createOptionCard('pdf', 'PDF', 'Dokumen', 'picture_as_pdf');
    }
}

function createOptionCard(value, label, desc, iconName) {
    const div = document.createElement('div');
    div.className = 'option-card';
    div.innerHTML = `<span class="material-symbols-rounded">${iconName}</span><div><span class="type" style="display:block; font-weight:700;">${label}</span><span class="desc" style="font-size:0.75rem;">${desc}</span></div>`;
    div.addEventListener('click', () => {
        document.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
        div.classList.add('selected');
        selectedFormat = value;
        convertBtn.disabled = false;
    });
    optionsGrid.appendChild(div);
}

// --- TOMBOL KLIK KONVERSI ---
convertBtn.addEventListener('click', async () => {
    if (!currentFile || !selectedFormat) return;

    convertBtn.classList.add('hidden');
    conversionLoader.classList.remove('hidden');
    conversionProgressFill.style.width = '30%';
    conversionStatusText.textContent = "Mengupload ke Server...";

    const formData = new FormData();
    formData.append('file', currentFile);
    formData.append('target_format', selectedFormat);

    try {
        const response = await fetch('backend/process.php', {
            method: 'POST',
            body: formData
        });

        conversionProgressFill.style.width = '70%';
        conversionStatusText.textContent = "Server sedang mengkonversi...";

        const result = await response.json();

        if (result.status === 'success') {
            conversionProgressFill.style.width = '100%';
            conversionStatusText.textContent = "Selesai!";
            
            statusMsg.style.color = "green";
            statusMsg.textContent = "Konversi Berhasil!";
            
            // Auto Download via Presigned URL
            const a = document.createElement('a');
            a.href = result.download_url;
            a.download = ''; 
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

        } else {
            throw new Error(result.message);
        }

    } catch (error) {
        console.error(error);
        statusMsg.style.color = "red";
        statusMsg.textContent = "Gagal: " + error.message;
        convertBtn.classList.remove('hidden');
        conversionLoader.classList.add('hidden');
    }
});