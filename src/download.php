<?php
require 'backend/vendor/autoload.php';
use Aws\S3\S3Client;

// Konfigurasi Database & MinIO (Sama seperti process.php)
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

if (strlen($token) === 16) {
    try {
        $pdo = new PDO("mysql:host={$dbConfig['host']};port={$dbConfig['port']};dbname={$dbConfig['name']}", $dbConfig['user'], $dbConfig['pass']);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        // Ambil data berdasarkan token & Cek Umur (24 Jam)
        $stmt = $pdo->prepare("SELECT * FROM conversion_logs WHERE public_id = ? AND created_at > (NOW() - INTERVAL 24 HOUR) LIMIT 1");
        $stmt->execute([$token]);
        $fileData = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($fileData) {
            // Generate Link Download Baru (Valid 1 Jam dari sekarang)
            // Kita harus ambil Key dari path_converted yang tersimpan di DB
            // Contoh path DB: http://cdn.../converter/converted/namafile.jpg
            // Kita butuh: converted/namafile.jpg
            $key = str_replace("http://cdn.ivanaldorino.web.id/converter/", "", $fileData['path_converted']);

            $s3 = new S3Client($minioConfig);
            $cmd = $s3->getCommand('GetObject', [
                'Bucket' => $bucketName,
                'Key'    => $key,
                'ResponseContentDisposition' => 'attachment; filename="' . $fileData['filename_converted'] . '"'
            ]);
            $request = $s3->createPresignedRequest($cmd, '+1 hour');
            $downloadLink = (string)$request->getUri();
        } else {
            $errorMsg = "Link kadaluarsa (lebih dari 24 jam) atau file tidak ditemukan.";
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
    <title>CNVTR 24 Hours</title>
    <link rel="icon" href="https://cdn.ivanaldorino.web.id/converter/cnvrtfavico.png" type="image/png" />
    <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="style.css"> </head>
<body>
    <main class="converter-card" style="min-height: auto;">
        <header>
            <img src="https://cdn.ivanaldorino.web.id/converter/cnvrtmiddle.png" alt="Logo" class="app-logo">
            <h1>File Recovery</h1>
        </header>

        <div style="text-align: center; padding: 20px;">
            <?php if ($fileData): ?>
                <div class="file-info" style="justify-content: center; margin-bottom: 30px;">
                    <div style="text-align: left;">
                        <span style="display:block; font-size: 0.8rem; color: #6B7280;">Nama File:</span>
                        <strong style="font-size: 1.1rem;"><?= htmlspecialchars($fileData['filename_converted']) ?></strong>
                        <span style="display:block; font-size: 0.8rem; color: #6B7280; margin-top:5px;">Dibuat: <?= $fileData['created_at'] ?></span>
                    </div>
                </div>

                <a href="<?= $downloadLink ?>" class="convert-btn" style="text-decoration: none; display: inline-block; width: 100%;">
                    Download File Sekarang
                </a>
                <p style="margin-top: 15px; font-size: 0.8rem; color: #ef4444;">Link ini akan hangus dalam 24 jam sejak pembuatan.</p>
            
            <?php else: ?>
                <div class="error-state">
                    <h3>Oops!</h3>
                    <p><?= $errorMsg ?></p>
                </div>
                <br>
                <a href="/" class="browse-btn" style="text-decoration: none;">Kembali ke Home</a>
            <?php endif; ?>
        </div>
    </main>
</body>
</html>