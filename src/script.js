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

// --- EVENT LISTENERS ---
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => { dropzone.classList.remove('dragover'); });
dropzone.addEventListener('drop', (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', (e) => { handleFiles(e.target.files); });
resetBtn.addEventListener('click', resetUI);

function resetUI() {
    location.reload(); // Cara paling bersih untuk reset
}

function handleFiles(files) {
    if (files.length === 0) return;
    currentFile = files[0]; // Kita fokus 1 file dulu biar stabil

    // UI Updates
    dropzone.classList.add('hidden');
    actionPanel.classList.remove('hidden');
    
    document.getElementById('fileName').textContent = currentFile.name;
    document.getElementById('fileSize').textContent = (currentFile.size / 1024).toFixed(2) + ' KB';

    // Preview Simple
    if (currentFile.type.startsWith('image/')) {
        previewImage.src = URL.createObjectURL(currentFile);
        previewImage.classList.remove('hidden');
        defaultIcon.classList.add('hidden');
    } else {
        previewImage.classList.add('hidden');
        defaultIcon.classList.remove('hidden');
    }

    generateOptions(currentFile.type);
}

function generateOptions(mimeType) {
    optionsGrid.innerHTML = ''; 
    // Format tujuan yang dikirim ke server: 'jpg', 'png', 'webp', 'pdf'
    
    if (mimeType === 'application/pdf') {
        createOptionCard('jpg', 'JPG', 'Gambar', 'photo_size_select_large');
        createOptionCard('png', 'PNG', 'Transparan', 'image');
    }
    else if (mimeType.startsWith('image/')) {
        createOptionCard('jpg', 'JPG', 'Ringan', 'photo_size_select_large');
        createOptionCard('png', 'PNG', 'Jernih', 'image');
        createOptionCard('webp', 'WEBP', 'Web', 'public');
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

    // UI Loading
    convertBtn.classList.add('hidden');
    conversionLoader.classList.remove('hidden');
    conversionProgressFill.style.width = '30%';
    conversionStatusText.textContent = "Mengupload ke Server...";

    const formData = new FormData();
    formData.append('file', currentFile);
    formData.append('target_format', selectedFormat);

    try {
        // Kirim ke Backend PHP
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
            
            // Auto Download
            const a = document.createElement('a');
            a.href = result.download_url;
            a.download = ''; // Biarkan nama dari server/browser
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