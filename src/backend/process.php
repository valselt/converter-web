<?php
// src/backend/process.php

ini_set('display_errors', 0);
ini_set('log_errors', 1); 
error_reporting(E_ALL);

ini_set('memory_limit', '512M'); 
ini_set('max_execution_time', 300); 
ob_start();

require 'vendor/autoload.php';
use Aws\S3\S3Client;

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');

// --- KONFIGURASI ---
$minioConfig = [
    'version' => 'latest',
    'region'  => 'us-east-1',
    'endpoint' => 'http://100.115.160.110:9010', 
    'use_path_style_endpoint' => true,
    'credentials' => [
        'key'    => 'admin',
        'secret' => 'aldorino04',
    ],
];

$dbConfig = [
    'host' => '100.115.160.110',
    'port' => '3306',
    'user' => 'root',
    'pass' => 'aldorino04',
    'name' => 'db_converterbyvalselt'
];

$bucketName = "converter";
$cdnDomain = "http://cdn.ivanaldorino.web.id/converter"; 

// --- FUNGSI BANTUAN KONVERSI ---

function convertImageToImage($source, $dest, $targetFormat) {
    // Load gambar berdasarkan tipe aslinya
    $info = getimagesize($source);
    if ($info['mime'] == 'image/jpeg') $image = imagecreatefromjpeg($source);
    elseif ($info['mime'] == 'image/png') $image = imagecreatefrompng($source);
    elseif ($info['mime'] == 'image/webp') $image = imagecreatefromwebp($source);
    else return false;

    // Simpan ke format baru
    if ($targetFormat == 'jpg' || $targetFormat == 'jpeg') {
        // Jika JPG, tambahkan background putih (biar transparan gak jadi hitam)
        $bg = imagecreatetruecolor(imagesx($image), imagesy($image));
        imagefill($bg, 0, 0, imagecolorallocate($bg, 255, 255, 255));
        imagecopy($bg, $image, 0, 0, 0, 0, imagesx($image), imagesy($image));
        imagejpeg($bg, $dest, 90);
        imagedestroy($bg);
    } 
    elseif ($targetFormat == 'png') {
        imagepalettetotruecolor($image);
        imagealphablending($image, true);
        imagesavealpha($image, true);
        imagepng($image, $dest, 9);
    } 
    elseif ($targetFormat == 'webp') {
        imagewebp($image, $dest, 80);
    }
    
    imagedestroy($image);
    return true;
}

function convertImageToPDF($source, $dest) {
    // 1. Ambil dimensi asli gambar (Pixel)
    $size = getimagesize($source);
    $widthPx = $size[0];
    $heightPx = $size[1];

    // 2. Konversi Pixel ke Millimeter
    // (FPDF menggunakan satuan mm. Asumsi 1px ≈ 0.264583 mm untuk 96 DPI)
    // Rasio akan tetap terjaga selama faktor pengali W dan H sama.
    $pxToMm = 0.264583; 
    $widthMm = $widthPx * $pxToMm;
    $heightMm = $heightPx * $pxToMm;

    // 3. Tentukan Orientasi Otomatis (L = Landscape, P = Portrait)
    $orientation = ($widthPx > $heightPx) ? 'L' : 'P';

    // 4. Inisialisasi PDF dengan Ukuran CUSTOM (Sesuai Gambar)
    // Kita kirim array [$widthMm, $heightMm] sebagai ukuran kertas
    $pdf = new \FPDF($orientation, 'mm', array($widthMm, $heightMm));

    // 5. Hapus Margin & AutoPageBreak
    // Ini PENTING agar tidak ada gap putih atau halaman baru kosong
    $pdf->SetMargins(0, 0, 0);
    $pdf->SetAutoPageBreak(false);

    $pdf->AddPage();

    // 6. Tempel Gambar Full Layar (Koordinat 0,0 sampai mentok W,H)
    $pdf->Image($source, 0, 0, $widthMm, $heightMm);

    $pdf->Output('F', $dest);
    return true;
}

function convertPDFToImage($source, $dest, $targetFormat) {
    // Cek apakah ekstensi Imagick ada
    if (!extension_loaded('imagick')) {
        throw new Exception("Server Error: Extension Imagick belum terinstall.");
    }

    try {
        $imagick = new Imagick();
        // Set resolusi DULU sebelum baca file
        $imagick->setResolution(150, 150); 
        
        $imagick->readImage($source . '[0]'); // Halaman pertama
        
        if($targetFormat == 'jpg' || $targetFormat == 'jpeg') {
            $imagick->setImageFormat('jpeg');
            $imagick->setImageCompressionQuality(90);
            
            $bg = new Imagick();
            $bg->newImage($imagick->getImageWidth(), $imagick->getImageHeight(), 'white');
            $bg->compositeImage($imagick, Imagick::COMPOSITE_OVER, 0, 0);
            $bg->writeImage($dest);
            $bg->clear();
        } else {
            $imagick->setImageFormat($targetFormat);
            $imagick->writeImage($dest);
        }
        
        $imagick->clear();
        return true;
    } catch (Exception $e) {
        // Tangkap error spesifik Imagick dan lempar ke main catch
        throw new Exception("Gagal konversi PDF: " . $e->getMessage());
    }
}

// --- LOGIKA UTAMA ---

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
    exit;
}

try {
    // 1. Validasi Input
    if (!isset($_FILES['file']) || !isset($_POST['target_format'])) {
        throw new Exception("Data tidak lengkap.");
    }

    $file = $_FILES['file'];
    $targetFormat = strtolower($_POST['target_format']); // jpg, png, pdf, webp
    $extOriginal = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    
    // Path Sementara di Server
    $tempDir = __DIR__ . '/temp/';
    if (!is_dir($tempDir)) mkdir($tempDir, 0777, true);
    
    $tempOriginal = $tempDir . time() . '_orig_' . basename($file['name']);
    $filenameResult = time() . '_conv_' . pathinfo($file['name'], PATHINFO_FILENAME) . '.' . $targetFormat;
    $tempResult = $tempDir . $filenameResult;

    // 2. Pindahkan File Upload ke Folder Temp
    if (!move_uploaded_file($file['tmp_name'], $tempOriginal)) {
        throw new Exception("Gagal menyimpan file sementara.");
    }

    // 3. Upload ORIGINAL ke MinIO
    $s3 = new S3Client($minioConfig);
    $keyOriginal = 'original/' . basename($tempOriginal);
    
    $s3->putObject([
        'Bucket' => $bucketName,
        'Key'    => $keyOriginal,
        'SourceFile' => $tempOriginal,
    ]);

    // 4. LAKUKAN KONVERSI (SERVER SIDE)
    $success = false;

    // A. GAMBAR KE GAMBAR
    if (in_array($extOriginal, ['jpg','jpeg','png','webp']) && in_array($targetFormat, ['jpg','jpeg','png','webp'])) {
        $success = convertImageToImage($tempOriginal, $tempResult, $targetFormat);
    }
    // B. GAMBAR KE PDF
    elseif (in_array($extOriginal, ['jpg','jpeg','png','webp']) && $targetFormat == 'pdf') {
        $success = convertImageToPDF($tempOriginal, $tempResult);
    }
    // C. PDF KE GAMBAR
    elseif ($extOriginal == 'pdf' && in_array($targetFormat, ['jpg','jpeg','png','webp'])) {
        $success = convertPDFToImage($tempOriginal, $tempResult, $targetFormat);
    }
    else {
        throw new Exception("Kombinasi konversi tidak didukung server.");
    }

    if (!$success) throw new Exception("Gagal melakukan konversi di server.");

    // 5. Upload HASIL KONVERSI ke MinIO
    $keyConverted = 'converted/' . $filenameResult;
    $s3->putObject([
        'Bucket' => $bucketName,
        'Key'    => $keyConverted,
        'SourceFile' => $tempResult,
    ]);

    // 6. Simpan Logs ke MySQL
    $pdo = new PDO("mysql:host={$dbConfig['host']};port={$dbConfig['port']};dbname={$dbConfig['name']}", $dbConfig['user'], $dbConfig['pass']);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $urlOriginal = $cdnDomain . "/" . $keyOriginal;
    $urlConverted = $cdnDomain . "/" . $keyConverted;

    $stmt = $pdo->prepare("INSERT INTO conversion_logs (filename_original, filename_converted, path_original, path_converted, file_type, file_size_original) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $file['name'],
        $filenameResult,
        $urlOriginal,
        $urlConverted,
        'image/' . $targetFormat, // Simplified mime type
        round($file['size'] / 1024, 2) . ' KB'
    ]);

    // 7. Bersihkan File Temp
    @unlink($tempOriginal);
    @unlink($tempResult);

    // 8. Berikan Response Link
    echo json_encode([
        'status' => 'success',
        'message' => 'Konversi Berhasil',
        'download_url' => $urlConverted
    ]);

// GANTI BAGIAN CATCH DI BAWAH INI:
} catch (Throwable $e) {
    http_response_code(500);
    // Bersihkan semua sampah text/html sebelum kirim JSON
    if (ob_get_length()) ob_clean(); 
    
    echo json_encode([
        'status' => 'error', 
        'message' => $e->getMessage()
    ]);
}
// Flush buffer terakhir
ob_end_flush();
?>