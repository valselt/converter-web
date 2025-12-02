let currentFile = null;
let selectedFormat = null;

// Elements
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

// Elements Validasi & Controls Wrapper
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
        if(validControls) validControls.classList.add('hidden');
        if(errorView) errorView.classList.remove('hidden');
        
        previewImage.classList.add('hidden');
        defaultIcon.classList.remove('hidden');
        defaultIcon.textContent = 'warning'; 
    }
}

function generateOptions(mimeType) {
    optionsGrid.innerHTML = ''; 
    
    if (mimeType === 'application/pdf') {
        createOptionCard('jpg', 'JPG', 'Gambar', 'photo_size_select_large');
        createOptionCard('png', 'PNG', 'Transparan', 'image');
        createOptionCard('webp', 'WEBP', 'Web Modern', 'public');
    }
    else if (mimeType.startsWith('image/')) {
        if (!mimeType.includes('jpeg') && !mimeType.includes('jpg')) {
            createOptionCard('jpg', 'JPG', 'Ringan', 'photo_size_select_large');
        }
        if (!mimeType.includes('png')) {
            createOptionCard('png', 'PNG', 'Jernih', 'image');
        }
        if (!mimeType.includes('webp')) {
            createOptionCard('webp', 'WEBP', 'Web', 'public');
        }
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

    // 1. UI Loading Awal
    convertBtn.classList.add('hidden');
    // Sembunyikan Grid Pilihan saat proses berjalan
    optionsGrid.parentElement.classList.add('hidden'); 
    
    conversionLoader.classList.remove('hidden');
    conversionProgressFill.style.width = '0%';
    conversionStatusText.textContent = "Menghubungi Server...";

    const processId = generateProcessId();
    const formData = new FormData();
    formData.append('file', currentFile);
    formData.append('target_format', selectedFormat);
    formData.append('process_id', processId);

    let progressInterval = setInterval(async () => {
        try {
            const res = await fetch(`backend/check_progress.php?id=${processId}`);
            const data = await res.json();
            if (data && data.percent) {
                conversionProgressFill.style.width = data.percent + '%';
                conversionStatusText.textContent = data.message;
            }
        } catch (e) {}
    }, 500);

    try {
        const response = await fetch('backend/process.php', {
            method: 'POST',
            body: formData
        });

        clearInterval(progressInterval);
        const result = await response.json();

        if (result.status === 'success') {
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

            // --- RECOVERY BUTTON WITH COUNTDOWN ---
            const recoveryBtn = document.createElement('a');
            recoveryBtn.href = result.share_url;
            recoveryBtn.target = "_blank"; 
            recoveryBtn.className = "browse-btn"; 
            recoveryBtn.style.marginTop = "15px";
            recoveryBtn.style.display = "block";
            recoveryBtn.style.textAlign = "center";
            recoveryBtn.style.textDecoration = "none";
            
            // Calculate expiration (24 hours from creation)
            // PHP returns seconds, JS needs milliseconds
            const expireTime = (result.created_at * 1000) + (24 * 60 * 60 * 1000); 

            // Countdown Function
            const updateBtnCountdown = () => {
                const now = new Date().getTime();
                const distance = expireTime - now;

                if (distance < 0) {
                    recoveryBtn.innerHTML = `<span class="material-symbols-rounded" style="vertical-align:middle; margin-right:5px;">link_off</span> Link Kadaluarsa`;
                    recoveryBtn.style.pointerEvents = "none";
                    recoveryBtn.style.opacity = "0.6";
                    return; // Stop updating
                }

                const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((distance % (1000 * 60)) / 1000);

                recoveryBtn.innerHTML = `<span class="material-symbols-rounded" style="font-size:18px; vertical-align:middle; margin-right:5px;">link</span> Halaman Download (${hours}j ${minutes}m ${seconds}d)`;
            };

            // Start Countdown
            updateBtnCountdown();
            setInterval(updateBtnCountdown, 1000);
            
            // Add buttons to UI
            statusMsg.parentNode.appendChild(recoveryBtn);
            
            // ... (Convert Again button logic remains exactly the same as before) ...
            const convertAgainBtn = document.createElement('button');
            convertAgainBtn.className = "convert-btn"; 
            convertAgainBtn.style.marginTop = "10px";
            convertAgainBtn.innerHTML = `<span class="material-symbols-rounded" style="font-size:18px; vertical-align:middle; margin-right:5px;">refresh</span> Konversi Lagi`;
            
            convertAgainBtn.onclick = function() {
                recoveryBtn.remove();
                convertAgainBtn.remove();
                statusMsg.textContent = "";
                optionsGrid.parentElement.classList.remove('hidden');
                convertBtn.classList.remove('hidden');
                convertBtn.disabled = true; 
                selectedFormat = null;
                document.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
            };
            statusMsg.parentNode.appendChild(convertAgainBtn);

        } else {
            throw new Error(result.message);
        }

    } catch (error) {
        clearInterval(progressInterval);
        console.error(error);
        statusMsg.style.color = "red";
        statusMsg.textContent = "Gagal: " + error.message;
        
        // Jika gagal, kembalikan UI seperti semula
        convertBtn.classList.remove('hidden');
        optionsGrid.parentElement.classList.remove('hidden');
        conversionLoader.classList.add('hidden');
    }
});