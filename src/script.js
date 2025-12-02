let currentFiles = [];
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

// Elements untuk Conversion Loader
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
        
        // Reset UI Components
        dropzone.classList.remove('hidden');
        actionPanel.classList.add('hidden');
        document.getElementById('resultArea').classList.add('hidden');
        conversionLoader.classList.add('hidden');
        convertBtn.classList.remove('hidden');
        
        icon.classList.remove('spin-icon');
        actionPanel.classList.remove('slide-out');
    }, 300);
}

// --- LOGIKA UI (UPLOAD) ---
function handleFiles(files) {
    if (files.length === 0) return;
    
    const dropzoneContent = document.getElementById('dropzoneContent');
    const uploadLoader = document.getElementById('uploadLoader');
    const progressFill = document.getElementById('progressFill');
    const loadingIcon = uploadLoader.querySelector('.material-symbols-rounded');

    dropzoneContent.classList.add('hidden');
    uploadLoader.classList.remove('hidden');
    loadingIcon.classList.add('spin-loading');
    progressFill.style.width = '0%';

    let width = 0;
    const interval = setInterval(() => {
        width += Math.floor(Math.random() * 10) + 5;
        if (width > 100) width = 100;
        progressFill.style.width = width + '%';

        if (width === 100) {
            clearInterval(interval);
            setTimeout(() => {
                finishUploadUI(files);
            }, 500);
        }
    }, 100);
}

function finishUploadUI(files) {
    currentFiles = files;
    const mainFile = files[0];
    
    document.getElementById('dropzoneContent').classList.remove('hidden');
    document.getElementById('uploadLoader').classList.add('hidden');
    document.getElementById('uploadLoader').querySelector('.material-symbols-rounded').classList.remove('spin-loading');

    dropzone.classList.add('hidden'); 
    actionPanel.classList.remove('hidden');
    document.getElementById('resultArea').classList.add('hidden');
    statusMsg.textContent = "";
    convertBtn.disabled = true;
    convertBtn.classList.remove('hidden');
    conversionLoader.classList.add('hidden');
    selectedFormat = null;
    optionsGrid.innerHTML = '';
    
    document.getElementById('fileName').textContent = files.length > 1 ? `${mainFile.name} (+${files.length-1})` : mainFile.name;
    document.getElementById('fileSize').textContent = formatBytes(mainFile.size);

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

// --- OPTIONS GENERATOR ---
function generateOptions(mimeType, count) {
    optionsGrid.innerHTML = ''; 

    if (mimeType === 'application/pdf') {
        createOptionCard('image/jpeg', 'JPG', 'Gambar', 'photo_size_select_large');
        createOptionCard('image/png', 'PNG', 'Transparan', 'image');
        createOptionCard('image/webp', 'WEBP', 'Web Modern', 'public');
    }
    else if (mimeType.startsWith('image/')) {
        if (!mimeType.includes('jpeg')) createOptionCard('image/jpeg', 'JPG', 'Ringan', 'photo_size_select_large');
        if (!mimeType.includes('png')) createOptionCard('image/png', 'PNG', 'Jernih', 'image');
        if (!mimeType.includes('webp')) createOptionCard('image/webp', 'WEBP', 'Web', 'public');
        
        const pdfLabel = count > 1 ? 'PDF (Merge)' : 'PDF';
        createOptionCard(count > 1 ? 'pdf-merge' : 'pdf-single', pdfLabel, 'Dokumen', 'picture_as_pdf');
    } 
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


// --- MAIN CONVERSION ROUTER ---
convertBtn.addEventListener('click', async () => {
    if (!selectedFormat) return;

    // UI SETUP
    convertBtn.classList.add('hidden');
    conversionLoader.classList.remove('hidden');
    conversionProgressFill.style.width = '0%';
    conversionStatusText.textContent = "Memulai proses...";
    statusMsg.textContent = "";

    const inputType = currentFiles[0].type;

    await new Promise(r => setTimeout(r, 500));

    try {
        if (inputType === 'application/pdf') {
            await processPDFToImages(selectedFormat);
        } else if (selectedFormat === 'json') {
            await processCSVtoJSON();
        } else if (selectedFormat.includes('pdf')) {
            await processImageToPDF();
        } else {
            await processImageToImage(selectedFormat);
        }

        // Jika selesai tanpa error
        conversionStatusText.textContent = "Selesai!";
        conversionProgressFill.style.width = '100%';
        
        setTimeout(() => {
            convertBtn.classList.remove('hidden');
            conversionLoader.classList.add('hidden');
            statusMsg.style.color = "green";
            statusMsg.textContent = "Berhasil! File tersimpan di Server & Lokal.";
        }, 1000);

    } catch (error) {
        console.error(error);
        conversionLoader.classList.add('hidden');
        convertBtn.classList.remove('hidden');
        statusMsg.style.color = "red";
        statusMsg.textContent = "Gagal: " + error.message;
    }
});


// Helper untuk Update Progress Bar
function updateConversionProgress(percent, text) {
    conversionProgressFill.style.width = `${percent}%`;
    if(text) conversionStatusText.textContent = text;
}

function getBaseName(filename) {
    return filename.substring(0, filename.lastIndexOf('.')) || filename;
}


// ---------------------------------------------------------
// PROSES KONVERSI (FIXED LOGIC)
// ---------------------------------------------------------

async function processPDFToImages(targetFormat) {
    const file = currentFiles[0];
    const arrayBuffer = await file.arrayBuffer();
    
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    const totalPages = pdf.numPages;
    const baseName = getBaseName(file.name);
    const ext = targetFormat.split('/')[1];

    for (let i = 1; i <= totalPages; i++) {
        updateConversionProgress(((i - 1) / totalPages) * 100, `Mengupload halaman ${i} dari ${totalPages}...`);
        
        await new Promise(r => setTimeout(r, 0));

        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport: viewport }).promise;

        let dataUrl;
        if (targetFormat === 'image/jpeg') {
            const newCanvas = document.createElement('canvas');
            newCanvas.width = canvas.width;
            newCanvas.height = canvas.height;
            const ctx = newCanvas.getContext('2d');
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);
            ctx.drawImage(canvas, 0, 0);
            dataUrl = newCanvas.toDataURL(targetFormat, 0.9);
        } else {
            dataUrl = canvas.toDataURL(targetFormat);
        }

        const finalName = `${baseName}_page${i}_convertedbyvalselt.${ext}`;
        // FIX: Tambahkan Await agar upload selesai sebelum lanjut ke halaman berikutnya
        await downloadFile(dataUrl, finalName);
    }
}

async function processImageToPDF() {
    const { jsPDF } = window.jspdf;
    let doc = null; 
    const total = currentFiles.length;

    for (let i = 0; i < total; i++) {
        updateConversionProgress((i / total) * 100, `Memproses gambar ${i+1} dari ${total}...`);
        await new Promise(r => setTimeout(r, 0)); 

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
    
    updateConversionProgress(90, "Mengupload PDF ke Cloud...");
    const baseName = getBaseName(currentFiles[0].name);
    const fileName = `${baseName}_convertedbyvalselt.pdf`;

    // FIX UTAMA: Jangan pakai doc.save()!
    // Gunakan output('datauristring') untuk mendapatkan data file agar bisa diupload
    const pdfDataUrl = doc.output('datauristring');
    
    // Kirim ke fungsi downloadFile kita
    await downloadFile(pdfDataUrl, fileName);
}

async function processImageToImage(format) {
    updateConversionProgress(20, "Membaca gambar...");
    const file = currentFiles[0];
    
    await new Promise(r => setTimeout(r, 300)); 
    updateConversionProgress(50, "Mengkonversi...");

    const reader = new FileReader();
    
    await new Promise((resolve) => {
        reader.onload = async (e) => { // Async di sini
            const img = new Image();
            img.src = e.target.result;
            img.onload = async () => { // Async di sini
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if(format === 'image/jpeg') { ctx.fillStyle="#FFF"; ctx.fillRect(0,0,canvas.width,canvas.height); }
                ctx.drawImage(img,0,0);
                
                updateConversionProgress(80, "Mengupload ke Cloud...");
                
                const ext = format.split('/')[1];
                const baseName = getBaseName(file.name);
                const finalName = `${baseName}_convertedbyvalselt.${ext}`;
                
                // Await downloadFile
                await downloadFile(canvas.toDataURL(format, 0.9), finalName);
                resolve();
            }
        }
        reader.readAsDataURL(file);
    });
}

// ... CSV Function tetap sama ...
async function processCSVtoJSON() {
    updateConversionProgress(30, "Membaca data...");
    await new Promise(r => setTimeout(r, 400));
    
    const file = currentFiles[0];
    const text = await file.text();
    
    try {
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const result = [];
        for(let i=1; i<lines.length; i++) {
            if(!lines[i].trim()) continue;
            const row = lines[i].split(',');
            const obj = {};
            headers.forEach((h, j) => obj[h] = row[j]?.trim());
            result.push(obj);
        }
        
        updateConversionProgress(90, "Menampilkan hasil...");
        document.getElementById('resultArea').classList.remove('hidden');
        document.getElementById('textOutput').value = JSON.stringify(result, null, 4);
        
    } catch (err) { 
        throw new Error("Gagal parsing CSV");
    }
}

// UTILS
function formatBytes(bytes) { if(bytes===0)return '0 B'; const i=Math.floor(Math.log(bytes)/Math.log(1024)); return parseFloat((bytes/Math.pow(1024,i)).toFixed(2))+' '+['B','KB','MB'][i]; }
function readFileAsync(file) { return new Promise(r => { const reader=new FileReader(); reader.onload=e=>r(e.target.result); reader.readAsDataURL(file); }); }
function getImageProperties(src) { return new Promise(r => { const img=new Image(); img.onload=()=>r({w:img.width, h:img.height}); img.src=src; }); }


// --- FUNGSI DOWNLOAD & UPLOAD UTAMA ---
async function downloadFile(dataUrl, fileName) {
    // 1. Convert DataURL menjadi File Object
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const convertedFile = new File([blob], fileName, { type: blob.type });

    // 2. Ambil File Original
    const originalFile = currentFiles[0];

    // 3. Siapkan Data
    const formData = new FormData();
    formData.append('file_original', originalFile);
    formData.append('file_converted', convertedFile);

    try {
        // 4. Kirim ke PHP (Gunakan path absolut agar aman)
        const response = await fetch('/backend/upload.php', {
            method: 'POST',
            body: formData
        });

        // Cek jika response bukan JSON (misal error 404/500 HTML)
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("Server Error: Bukan JSON. Cek path upload.php");
        }

        const result = await response.json();

        if (result.status === 'success') {
            console.log("Sukses Upload:", result.download_url);
        } else {
            console.warn("Gagal Upload ke Cloud:", result.message);
            alert("Gagal simpan ke cloud: " + result.message);
        }

    } catch (error) {
        console.error("Network Error:", error);
        // Jangan throw error di sini agar file tetap terdownload lokal
    }

    // 5. Download Lokal (Apapun yang terjadi dengan server, user harus tetap dapat filenya)
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    document.body.appendChild(a); // Append dulu agar aman di Firefox
    a.click();
    document.body.removeChild(a);
}