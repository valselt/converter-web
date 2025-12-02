let currentFiles = [];
let selectedFormat = null;

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const actionPanel = document.getElementById('actionPanel');
const optionsGrid = document.getElementById('optionsGrid');
const convertBtn = document.getElementById('convertBtn');
const statusMsg = document.getElementById('statusMsg');
const resetBtn = document.getElementById('resetBtn');

const previewImage = document.getElementById('previewImage'); // Element baru
const defaultIcon = document.getElementById('defaultIcon');   // Element baru

// --- EVENT LISTENERS ---
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => { dropzone.classList.remove('dragover'); });
dropzone.addEventListener('drop', (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', (e) => { handleFiles(e.target.files); });
resetBtn.addEventListener('click', resetUI);

function resetUI() {
    const icon = resetBtn.querySelector('.material-symbols-rounded');
    icon.classList.add('spin-icon');
    actionPanel.classList.add('slide-out');

    setTimeout(() => {
        currentFiles = [];
        selectedFormat = null;
        fileInput.value = ''; 
        
        // Reset Visual Preview
        previewImage.src = '';
        previewImage.classList.add('hidden');
        defaultIcon.classList.remove('hidden');
        
        dropzone.classList.remove('hidden');
        actionPanel.classList.add('hidden');
        document.getElementById('resultArea').classList.add('hidden');
        icon.classList.remove('spin-icon');
        actionPanel.classList.remove('slide-out');
    }, 300);
}

// --- LOGIKA UI ---
function handleFiles(files) {
    if (files.length === 0) return;
    
    // 1. Ambil Element Loading
    const dropzoneContent = document.getElementById('dropzoneContent');
    const uploadLoader = document.getElementById('uploadLoader');
    const progressFill = document.getElementById('progressFill');
    const loadingIcon = uploadLoader.querySelector('.material-symbols-rounded');

    // 2. Tampilkan Mode Loading
    dropzoneContent.classList.add('hidden'); // Sembunyikan teks drag & drop
    uploadLoader.classList.remove('hidden'); // Tampilkan loading bar
    loadingIcon.classList.add('spin-loading'); // Putar ikon sync
    progressFill.style.width = '0%';

    // 3. Simulasi Upload (Animasi Progress Bar)
    let width = 0;
    const interval = setInterval(() => {
        width += Math.floor(Math.random() * 10) + 5; // Nambah acak biar natural
        
        if (width > 100) width = 100;
        progressFill.style.width = width + '%';

        // 4. Jika Selesai (100%)
        if (width === 100) {
            clearInterval(interval);
            
            // Tunggu sebentar (300ms) lalu masuk ke Action Panel
            setTimeout(() => {
                finishUploadUI(files);
            }, 500);
        }
    }, 100); // Kecepatan update bar
}

// Fungsi ini adalah logika lama Anda yang dipisah
function finishUploadUI(files) {
    currentFiles = files;
    const mainFile = files[0];
    
    // Reset Tampilan Dropzone untuk pemakaian berikutnya
    document.getElementById('dropzoneContent').classList.remove('hidden');
    document.getElementById('uploadLoader').classList.add('hidden');
    document.getElementById('uploadLoader').querySelector('.material-symbols-rounded').classList.remove('spin-loading');

    // Pindah ke Action Panel (Logika Lama)
    dropzone.classList.add('hidden'); 
    actionPanel.classList.remove('hidden');
    document.getElementById('resultArea').classList.add('hidden');
    statusMsg.textContent = "";
    convertBtn.disabled = true;
    selectedFormat = null;
    optionsGrid.innerHTML = '';
    
    // Info File
    document.getElementById('fileName').textContent = files.length > 1 ? `${mainFile.name} (+${files.length-1})` : mainFile.name;
    document.getElementById('fileSize').textContent = formatBytes(mainFile.size);

    // Preview Logic (Sama seperti sebelumnya)
    if (mainFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImage.src = e.target.result;
            previewImage.classList.remove('hidden');
            defaultIcon.classList.add('hidden');
        }
        reader.readAsDataURL(mainFile);
    } else {
        previewImage.classList.add('hidden');
        defaultIcon.classList.remove('hidden');
        if(mainFile.type === 'application/pdf') {
            defaultIcon.textContent = 'picture_as_pdf';
        } else if (mainFile.type.includes('csv')) {
            defaultIcon.textContent = 'table_chart';
        } else {
            defaultIcon.textContent = 'description';
        }
    }

    generateOptions(mainFile.type, files.length);
}

// --- LOGIKA GENERATE OPTIONS YANG LEBIH CERDAS ---
function generateOptions(mimeType, count) {
    optionsGrid.innerHTML = ''; 

    // CASE 1: INPUT ADALAH PDF -> OUTPUT: GAMBAR
    if (mimeType === 'application/pdf') {
        createOptionCard('image/jpeg', 'JPG', 'Gambar', 'photo_size_select_large');
        createOptionCard('image/png', 'PNG', 'Transparan', 'image');
        createOptionCard('image/webp', 'WEBP', 'Web Modern', 'public');
    }
    // CASE 2: INPUT ADALAH GAMBAR
    else if (mimeType.startsWith('image/')) {
        // Tampilkan opsi format yang BUKAN format aslinya
        if (!mimeType.includes('jpeg')) createOptionCard('image/jpeg', 'JPG', 'Ringan', 'photo_size_select_large');
        if (!mimeType.includes('png')) createOptionCard('image/png', 'PNG', 'Jernih', 'image');
        if (!mimeType.includes('webp')) createOptionCard('image/webp', 'WEBP', 'Web', 'public');
        
        // Selalu tawarkan PDF
        const pdfLabel = count > 1 ? 'PDF (Merge)' : 'PDF';
        createOptionCard(count > 1 ? 'pdf-merge' : 'pdf-single', pdfLabel, 'Dokumen', 'picture_as_pdf');
    } 
    // CASE 3: INPUT ADALAH CSV
    else if (mimeType === 'text/csv' || mimeType.includes('csv')) {
        createOptionCard('json', 'JSON', 'Object Data', 'data_object');
    } 
    else {
        statusMsg.textContent = "Format file tidak didukung.";
        statusMsg.style.color = "red";
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

// --- ROUTER KONVERSI ---
convertBtn.addEventListener('click', () => {
    if (!selectedFormat) return;
    statusMsg.style.color = "black";
    statusMsg.textContent = "Memproses...";

    const inputType = currentFiles[0].type;

    // Jika Input PDF, jalankan fungsi PDF Reader
    if (inputType === 'application/pdf') {
        processPDFToImages(selectedFormat);
    }
    // Jika Input CSV
    else if (selectedFormat === 'json') {
        processCSVtoJSON();
    } 
    // Jika Input Gambar
    else if (selectedFormat.includes('pdf')) {
        processImageToPDF();
    } else {
        processImageToImage(selectedFormat);
    }
});

// Helper Nama File
function getBaseName(filename) {
    return filename.substring(0, filename.lastIndexOf('.')) || filename;
}

// ---------------------------------------------------------
// FITUR BARU: PDF KE GAMBAR (JPG/PNG/WEBP)
// ---------------------------------------------------------
async function processPDFToImages(targetFormat) {
    const file = currentFiles[0];
    const arrayBuffer = await file.arrayBuffer();
    
    // Load PDF
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    const totalPages = pdf.numPages;
    const baseName = getBaseName(file.name);
    const ext = targetFormat.split('/')[1];

    statusMsg.textContent = `Mengkonversi ${totalPages} halaman...`;

    for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i);
        
        // Scale 2.0 agar hasil gambar tajam (HD)
        const viewport = page.getViewport({ scale: 2.0 });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Render halaman PDF ke Canvas
        await page.render({ canvasContext: context, viewport: viewport }).promise;

        // Handle Background Putih untuk JPG (karena canvas transparan by default)
        if (targetFormat === 'image/jpeg') {
            // Teknik composite agar background jadi putih, bukan hitam
            const newCanvas = document.createElement('canvas');
            newCanvas.width = canvas.width;
            newCanvas.height = canvas.height;
            const ctx = newCanvas.getContext('2d');
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);
            ctx.drawImage(canvas, 0, 0);
            
            // Download
            const finalName = `${baseName}_page${i}_convertedbyvalselt.${ext}`;
            downloadFile(newCanvas.toDataURL(targetFormat, 0.9), finalName);
        } else {
            // PNG / WEBP langsung download
            const finalName = `${baseName}_page${i}_convertedbyvalselt.${ext}`;
            downloadFile(canvas.toDataURL(targetFormat), finalName);
        }
    }
    statusMsg.textContent = `Selesai! ${totalPages} gambar terdownload.`;
}


// ---------------------------------------------------------
// FITUR LAMA
// ---------------------------------------------------------

// 1. IMAGE TO PDF
async function processImageToPDF() {
    const { jsPDF } = window.jspdf;
    let doc = null; 

    for (let i = 0; i < currentFiles.length; i++) {
        const file = currentFiles[i];
        const imgData = await readFileAsync(file);
        const props = await getImageProperties(imgData);
        
        const orientation = props.w > props.h ? 'l' : 'p';
        const format = [props.w, props.h]; 

        if (i === 0) {
            doc = new jsPDF({ orientation, unit: 'px', format, hotfixes: ['px_scaling'] });
        } else {
            doc.addPage(format, orientation);
        }
        doc.addImage(imgData, 'JPEG', 0, 0, props.w, props.h);
    }
    const baseName = getBaseName(currentFiles[0].name);
    doc.save(`${baseName}_convertedbyvalselt.pdf`);
    statusMsg.textContent = "Berhasil! PDF telah didownload.";
}

// 2. CSV TO JSON
function processCSVtoJSON() {
    const file = currentFiles[0];
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const lines = e.target.result.split('\n');
            const headers = lines[0].split(',').map(h => h.trim());
            const result = [];
            for(let i=1; i<lines.length; i++) {
                if(!lines[i].trim()) continue;
                const row = lines[i].split(',');
                const obj = {};
                headers.forEach((h, j) => obj[h] = row[j]?.trim());
                result.push(obj);
            }
            document.getElementById('resultArea').classList.remove('hidden');
            document.getElementById('textOutput').value = JSON.stringify(result, null, 4);
            statusMsg.textContent = "Selesai.";
        } catch (err) { statusMsg.textContent = "Gagal baca CSV."; }
    }
    reader.readAsText(file);
}

// 3. IMAGE TO IMAGE
function processImageToImage(format) {
    const file = currentFiles[0];
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if(format === 'image/jpeg') { ctx.fillStyle="#FFF"; ctx.fillRect(0,0,canvas.width,canvas.height); }
            ctx.drawImage(img,0,0);
            
            const ext = format.split('/')[1];
            const baseName = getBaseName(file.name);
            const finalName = `${baseName}_convertedbyvalselt.${ext}`;
            downloadFile(canvas.toDataURL(format, 0.9), finalName);
            statusMsg.textContent = "Selesai.";
        }
    }
    reader.readAsDataURL(file);
}

// UTILS
function formatBytes(bytes) { if(bytes===0)return '0 B'; const i=Math.floor(Math.log(bytes)/Math.log(1024)); return parseFloat((bytes/Math.pow(1024,i)).toFixed(2))+' '+['B','KB','MB'][i]; }
function downloadFile(url, name) { const a = document.createElement('a'); a.href=url; a.download=name; a.click(); }
function readFileAsync(file) { return new Promise(r => { const reader=new FileReader(); reader.onload=e=>r(e.target.result); reader.readAsDataURL(file); }); }
function getImageProperties(src) { return new Promise(r => { const img=new Image(); img.onload=()=>r({w:img.width, h:img.height}); img.src=src; }); }