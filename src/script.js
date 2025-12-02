let currentFiles = [];
let selectedFormat = null;

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const actionPanel = document.getElementById('actionPanel');
const optionsGrid = document.getElementById('optionsGrid');
const convertBtn = document.getElementById('convertBtn');
const statusMsg = document.getElementById('statusMsg');
const resetBtn = document.getElementById('resetBtn'); // Ambil tombol reset

// --- EVENT LISTENERS ---
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => { dropzone.classList.remove('dragover'); });
dropzone.addEventListener('drop', (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', (e) => { handleFiles(e.target.files); });

// Listener Tombol Reset (Ganti File)
resetBtn.addEventListener('click', resetUI);

function resetUI() {
    currentFiles = [];
    selectedFormat = null;
    fileInput.value = ''; // Reset input file agar bisa pilih file yang sama
    
    // Tampilkan Dropzone, Sembunyikan Panel
    dropzone.classList.remove('hidden');
    actionPanel.classList.add('hidden');
    document.getElementById('resultArea').classList.add('hidden');
}

// --- LOGIKA UI ---
function handleFiles(files) {
    if (files.length === 0) return;
    currentFiles = files;
    
    // UI SWAP: Sembunyikan Dropzone, Tampilkan Panel
    dropzone.classList.add('hidden'); 
    actionPanel.classList.remove('hidden');
    
    document.getElementById('resultArea').classList.add('hidden');
    statusMsg.textContent = "";
    convertBtn.disabled = true;
    selectedFormat = null;
    
    // Reset style grid options
    optionsGrid.innerHTML = '';
    
    const mainFile = files[0];
    document.getElementById('fileName').textContent = files.length > 1 ? `${mainFile.name} (+${files.length-1})` : mainFile.name;
    document.getElementById('fileSize').textContent = formatBytes(mainFile.size);

    generateOptions(mainFile.type, files.length);
}

// ... (Fungsi generateOptions dan createOptionCard TETAP SAMA, tidak perlu diubah) ...
function generateOptions(mimeType, count) {
    optionsGrid.innerHTML = ''; 
    if (mimeType.startsWith('image/')) {
        if (count > 1) {
            createOptionCard('pdf-merge', 'PDF', 'Gabungkan Gambar', 'picture_as_pdf');
        } else {
            createOptionCard('image/png', 'PNG', 'Transparan', 'image');
            createOptionCard('image/jpeg', 'JPG', 'Ringan', 'photo_size_select_large');
            createOptionCard('image/webp', 'WEBP', 'Web Modern', 'public');
            createOptionCard('pdf-single', 'PDF', 'Dokumen', 'picture_as_pdf');
        }
    } else if (mimeType === 'text/csv' || mimeType.includes('csv')) {
        createOptionCard('json', 'JSON', 'Object Data', 'data_object');
    } else {
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

// --- LOGIKA KONVERSI ---
convertBtn.addEventListener('click', () => {
    if (!selectedFormat) return;
    statusMsg.style.color = "black";
    statusMsg.textContent = "Memproses...";

    if (selectedFormat === 'json') processCSVtoJSON();
    else if (selectedFormat.includes('pdf')) processImageToPDF();
    else processImageToImage(selectedFormat);
});


// 1. IMAGE TO PDF (REVISI TOTAL: NO MARGIN, EXACT SIZE)
async function processImageToPDF() {
    const { jsPDF } = window.jspdf;
    let doc = null; 

    for (let i = 0; i < currentFiles.length; i++) {
        const file = currentFiles[i];
        
        const imgData = await readFileAsync(file);
        const props = await getImageProperties(imgData);

        // LOGIKA BARU: 
        // Jangan paksa ke A4. Buat ukuran PDF SAMA PERSIS dengan ukuran Gambar (pixel).
        // Gunakan unit 'px' agar akurat 1:1 tanpa margin putih.
        
        const orientation = props.w > props.h ? 'l' : 'p';
        const format = [props.w, props.h]; // Ukuran kertas = Ukuran gambar

        if (i === 0) {
            doc = new jsPDF({ 
                orientation: orientation, 
                unit: 'px', 
                format: format,
                hotfixes: ['px_scaling'] // Fix untuk versi jsPDF baru agar pixel akurat
            });
        } else {
            doc.addPage(format, orientation);
        }

        // Add Image di koordinat 0,0 dengan lebar & tinggi penuh
        doc.addImage(imgData, 'JPEG', 0, 0, props.w, props.h);
    }

    doc.save("converted-document.pdf");
    statusMsg.textContent = "Berhasil! PDF telah didownload.";
}

// ... (Fungsi processCSVtoJSON, processImageToImage, formatBytes, downloadFile, readFileAsync, getImageProperties TETAP SAMA) ...
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
            downloadFile(canvas.toDataURL(format, 0.9), `result.${format.split('/')[1]}`);
            statusMsg.textContent = "Selesai.";
        }
    }
    reader.readAsDataURL(file);
}

function formatBytes(bytes) { if(bytes===0)return '0 B'; const i=Math.floor(Math.log(bytes)/Math.log(1024)); return parseFloat((bytes/Math.pow(1024,i)).toFixed(2))+' '+['B','KB','MB'][i]; }
function downloadFile(url, name) { const a = document.createElement('a'); a.href=url; a.download=name; a.click(); }
function readFileAsync(file) { return new Promise(r => { const reader=new FileReader(); reader.onload=e=>r(e.target.result); reader.readAsDataURL(file); }); }
function getImageProperties(src) { return new Promise(r => { const img=new Image(); img.onload=()=>r({w:img.width, h:img.height}); img.src=src; }); }