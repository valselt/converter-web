let currentFiles = [];
let selectedFormat = null;

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const actionPanel = document.getElementById('actionPanel');
const optionsGrid = document.getElementById('optionsGrid');
const convertBtn = document.getElementById('convertBtn');
const statusMsg = document.getElementById('statusMsg');
const resetBtn = document.getElementById('resetBtn');

// --- EVENT LISTENERS ---
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => { dropzone.classList.remove('dragover'); });
dropzone.addEventListener('drop', (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', (e) => { handleFiles(e.target.files); });
resetBtn.addEventListener('click', resetUI);

resetBtn.addEventListener('click', resetUI);

function resetUI() {
    // 1. Ambil elemen icon di dalam tombol
    const icon = resetBtn.querySelector('.material-symbols-rounded');
    
    // 2. Tambahkan class animasi ke Icon dan Panel
    icon.classList.add('spin-icon');
    actionPanel.classList.add('slide-out');

    // 3. Tunggu 300ms (sesuai durasi animasi CSS) baru reset data
    setTimeout(() => {
        currentFiles = [];
        selectedFormat = null;
        fileInput.value = ''; 
        
        // Reset Tampilan
        dropzone.classList.remove('hidden');
        actionPanel.classList.add('hidden');
        document.getElementById('resultArea').classList.add('hidden');
        
        // Bersihkan class animasi agar bisa dipakai lagi nanti
        icon.classList.remove('spin-icon');
        actionPanel.classList.remove('slide-out');
        
    }, 300); // Waktu tunggu
}

// --- LOGIKA UI ---
function handleFiles(files) {
    if (files.length === 0) return;
    currentFiles = files;
    
    dropzone.classList.add('hidden'); 
    actionPanel.classList.remove('hidden');
    
    document.getElementById('resultArea').classList.add('hidden');
    statusMsg.textContent = "";
    convertBtn.disabled = true;
    selectedFormat = null;
    optionsGrid.innerHTML = '';
    
    const mainFile = files[0];
    document.getElementById('fileName').textContent = files.length > 1 ? `${mainFile.name} (+${files.length-1})` : mainFile.name;
    document.getElementById('fileSize').textContent = formatBytes(mainFile.size);

    generateOptions(mainFile.type, files.length);
}

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

// Helper untuk membersihkan nama file (hapus ekstensi lama)
function getBaseName(filename) {
    return filename.substring(0, filename.lastIndexOf('.')) || filename;
}

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
            doc = new jsPDF({ 
                orientation: orientation, 
                unit: 'px', 
                format: format,
                hotfixes: ['px_scaling'] 
            });
        } else {
            doc.addPage(format, orientation);
        }

        doc.addImage(imgData, 'JPEG', 0, 0, props.w, props.h);
    }

    // UPDATE PENAMAAN FILE PDF
    const originalName = currentFiles[0].name;
    const baseName = getBaseName(originalName);
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
            
            // UPDATE PENAMAAN FILE GAMBAR
            const ext = format.split('/')[1]; // png, jpeg, webp
            const originalName = file.name;
            const baseName = getBaseName(originalName);
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