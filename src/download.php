<?php
require 'backend/vendor/autoload.php';
use Aws\S3\S3Client;

$minioConfig = [
    'version' => 'latest', 'region'  => 'us-east-1',
    'endpoint' => 'http://100.115.160.110:9010', 'use_path_style_endpoint' => true,
    'credentials' => ['key' => 'admin', 'secret' => 'aldorino04'],
];
$dbConfig = ['host' => '100.115.160.110', 'port' => '3306', 'user' => 'root', 'pass' => 'aldorino04', 'name' => 'db_converterbyvalselt'];
$bucketName = "converter";

$token = $_GET['token'] ?? '';
$fileData = null;
$errorMsg = "";
$downloadLink = "";
$expireTimestamp = 0; 

if (strlen($token) === 16) {
    try {
        $pdo = new PDO("mysql:host={$dbConfig['host']};port={$dbConfig['port']};dbname={$dbConfig['name']}", $dbConfig['user'], $dbConfig['pass']);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        // Fetch Data + Unix Timestamp
        $stmt = $pdo->prepare("SELECT *, UNIX_TIMESTAMP(created_at) as unix_created FROM conversion_logs WHERE public_id = ? AND created_at > (NOW() - INTERVAL 24 HOUR) LIMIT 1");
        $stmt->execute([$token]);
        $fileData = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($fileData) {
            $key = str_replace("http://cdn.ivanaldorino.web.id/converter/", "", $fileData['path_converted']);
            $s3 = new S3Client($minioConfig);
            $cmd = $s3->getCommand('GetObject', [
                'Bucket' => $bucketName,
                'Key'    => $key,
                'ResponseContentDisposition' => 'attachment; filename="' . $fileData['filename_converted'] . '"'
            ]);
            $request = $s3->createPresignedRequest($cmd, '+1 hour');
            $downloadLink = (string)$request->getUri();
            
            // Hitung waktu kadaluarsa (Created + 24 jam)
            $expireTimestamp = ($fileData['unix_created'] + (24 * 60 * 60)) * 1000;
        } else {
            $errorMsg = "Link kadaluarsa atau file tidak ditemukan.";
        }
    } catch (Exception $e) {
        $errorMsg = "Terjadi kesalahan server.";
    }
} else {
    $errorMsg = "Kode tidak valid.";
}
?>

<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Download File - CNVRT</title>
    <link rel="icon" href="https://cdn.ivanaldorino.web.id/converter/cnvrtfavico.png" type="image/png" />
    <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,300,0,200" />
    <link rel="stylesheet" href="style.css"> 
</head>
<body>
    <div class="page-background">
        <div class="blob blob-1"></div>
        <div class="blob blob-2"></div>
        <div class="blob blob-3"></div>
    </div>
    <main class="converter-card" style="min-height: auto;">
        <header>
            <img src="https://cdn.ivanaldorino.web.id/converter/cnvrtmiddle.png" alt="Logo" class="app-logo">
            <h1>File Recovery</h1>
        </header>

        <div style="text-align: center; padding: 20px;">
            <?php if ($fileData): ?>
                
                <div class="file-info" style="justify-content: space-around; margin-bottom: 20px;">
                    <span class="material-symbols-rounded" style="font-size: 32px; color: var(--primary);">inventory_2</span>
                    <div style="text-align: left; margin-left: 10px;">
                        <span style="display:block; font-size: 0.8rem; color: #6B7280;">Nama File:</span>
                        <strong style="font-size: 1rem; word-break: break-all;"><?= htmlspecialchars($fileData['filename_converted']) ?></strong>
                    </div>
                </div>

                <p style="margin-bottom: 10px; font-size: 0.9rem; color: #6B7280;">Link ini akan hangus dalam:</p>

                <div id="countdownWrapper" class="countdown-container">
                    <div class="time-box">
                        <span id="cd-hours" class="time-val">00</span>
                        <span class="time-label">Jam</span>
                    </div>
                    <div class="time-box">
                        <span id="cd-minutes" class="time-val">00</span>
                        <span class="time-label">Menit</span>
                    </div>
                    <div class="time-box">
                        <span id="cd-seconds" class="time-val">00</span>
                        <span class="time-label">Detik</span>
                    </div>
                </div>

                <div id="expiredMessage" class="hidden expired-state">
                    <span class="material-symbols-rounded">link_off</span> Link Telah Kadaluarsa
                </div>

                <a id="downloadBtn" href="<?= $downloadLink ?>" class="convert-btn" style="text-decoration: none; display: inline-block; width: 100%; margin-top: 10px;">
                    Download File Sekarang
                </a>
                
                <script>
                    const expireTime = <?= $expireTimestamp ?>;
                    const wrapper = document.getElementById('countdownWrapper');
                    const expiredMsg = document.getElementById('expiredMessage');
                    const btn = document.getElementById('downloadBtn');
                    
                    const elHours = document.getElementById('cd-hours');
                    const elMinutes = document.getElementById('cd-minutes');
                    const elSeconds = document.getElementById('cd-seconds');

                    function updateCountdown() {
                        const now = new Date().getTime();
                        const distance = expireTime - now;

                        if (distance < 0) {
                            // Jika Waktu Habis
                            wrapper.classList.add('hidden'); // Sembunyikan timer
                            btn.classList.add('hidden');     // Sembunyikan tombol download
                            expiredMsg.classList.remove('hidden'); // Munculkan pesan error
                            return;
                        }

                        // Hitung Waktu
                        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

                        // Update Angka (dengan padStart agar selalu 2 digit, misal '05')
                        elHours.innerText = hours.toString().padStart(2, '0');
                        elMinutes.innerText = minutes.toString().padStart(2, '0');
                        elSeconds.innerText = seconds.toString().padStart(2, '0');
                    }

                    setInterval(updateCountdown, 1000);
                    updateCountdown(); // Jalankan langsung biar gak nunggu 1 detik
                </script>
            
            <?php else: ?>
                <div class="error-state">
                    <div class="error-icon-box">
                        <span class="material-symbols-rounded">broken_image</span>
                    </div>
                    <h3>Link Tidak Valid</h3>
                    <p><?= $errorMsg ?></p>
                </div>
                <br>
                <a href="/" class="browse-btn" style="text-decoration: none;">Konversi File Baru</a>
            <?php endif; ?>
        </div>
    </main>
</body>
</html>