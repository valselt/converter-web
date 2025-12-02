<?php
// src/backend/process.php

// 1. Setup Error Handling
ini_set('display_errors', 0);
ini_set('log_errors', 1); 
error_reporting(E_ALL);

ini_set('memory_limit', '512M'); 
ini_set('max_execution_time', 300); 

// Buffer output
ob_start();

require 'vendor/autoload.php';

use Aws\S3\S3Client;
use Setasign\Fpdf\Fpdf; 

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');

// --- FUNGSI UPDATE PROGRESS ---
function updateProgress($percent, $message) {
    global $processId;
    if ($processId) {
        $file = __DIR__ . '/temp/progress_' . $processId . '.json';
        $data = json_encode(['percent' => $percent, 'message' => $message]);
        @file_put_contents($file, $data);
    }
}

// --- KONFIGURASI ---
$minioConfig = [
    'version' => 'latest',
    'region'  => 'us-east-1',
    'endpoint' => 'http://100.115.160.110:9010', 
    'use_path_style_endpoint' => true,
    'signature_version' => 'v4', // Explicitly set v4
    'credentials' => [
        'key'    => 'admin',
        'secret' => 'aldorino04',
    ],
    'http' => [
        'expect' => false 
    ],
    // Disable automatic checksums
    'request_checksum_calculation' => 'when_required',
    'response_checksum_validation' => 'when_required',
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
    updateProgress(40, "Membaca gambar...");
    $info = getimagesize($source);
    if ($info['mime'] == 'image/jpeg') $image = imagecreatefromjpeg($source);
    elseif ($info['mime'] == 'image/png') $image = imagecreatefrompng($source);
    elseif ($info['mime'] == 'image/webp') $image = imagecreatefromwebp($source);
    else return false;

    updateProgress(60, "Mengubah format...");
    if ($targetFormat == 'jpg' || $targetFormat == 'jpeg') {
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
    updateProgress(50, "Membuat halaman PDF...");
    $size = getimagesize($source);
    $widthPx = $size[0];
    $heightPx = $size[1];
    $pxToMm = 0.264583; 
    $widthMm = $widthPx * $pxToMm;
    $heightMm = $heightPx * $pxToMm;
    $orientation = ($widthPx > $heightPx) ? 'L' : 'P';

    $pdf = new \FPDF($orientation, 'mm', array($widthMm, $heightMm));
    $pdf->SetMargins(0, 0, 0);
    $pdf->SetAutoPageBreak(false);
    $pdf->AddPage();
    $pdf->Image($source, 0, 0, $widthMm, $heightMm);
    $pdf->Output('F', $dest);
    return true;
}

function convertPDFToImage($source, $dest, $targetFormat) {
    if (!extension_loaded('imagick')) {
        throw new Exception("Server Error: Extension Imagick belum terinstall.");
    }
    try {
        updateProgress(40, "Menyiapkan engine PDF...");
        $imagick = new Imagick();
        $imagick->setResolution(150, 150); 
        updateProgress(50, "Membaca halaman PDF...");
        $imagick->readImage($source . '[0]'); 
        updateProgress(70, "Merender gambar...");
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
        throw new Exception("Gagal konversi PDF: " . $e->getMessage());
    }
}

// --- LOGIKA UTAMA ---

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
    exit;
}

$processId = isset($_POST['process_id']) ? preg_replace('/[^a-zA-Z0-9]/', '', $_POST['process_id']) : null;

try {
    updateProgress(5, "Menerima file...");

    if (!isset($_FILES['file']) || !isset($_POST['target_format'])) {
        throw new Exception("Data tidak lengkap.");
    }

    $file = $_FILES['file'];
    $targetFormat = strtolower($_POST['target_format']); 
    $extOriginal = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    
    $tempDir = __DIR__ . '/temp/';
    if (!is_dir($tempDir)) mkdir($tempDir, 0777, true);
    
    $tempOriginal = $tempDir . time() . '_orig_' . basename($file['name']);
    $filenameResult = time() . '_conv_' . pathinfo($file['name'], PATHINFO_FILENAME) . '.' . $targetFormat;
    $tempResult = $tempDir . $filenameResult;

    if (!move_uploaded_file($file['tmp_name'], $tempOriginal)) {
        throw new Exception("Gagal menyimpan file sementara.");
    }

    // --- UPLOAD ORIGINAL ---
    updateProgress(20, "Backup file asli ke Cloud...");
    $s3 = new S3Client($minioConfig);
    $keyOriginal = 'original/' . basename($tempOriginal);
    
    $s3->putObject([
        'Bucket' => $bucketName,
        'Key'    => $keyOriginal,
        'SourceFile' => $tempOriginal,
    ]);

    // --- KONVERSI ---
    updateProgress(30, "Memulai konversi...");
    $success = false;

    if (in_array($extOriginal, ['jpg','jpeg','png','webp']) && in_array($targetFormat, ['jpg','jpeg','png','webp'])) {
        $success = convertImageToImage($tempOriginal, $tempResult, $targetFormat);
    }
    elseif (in_array($extOriginal, ['jpg','jpeg','png','webp']) && $targetFormat == 'pdf') {
        $success = convertImageToPDF($tempOriginal, $tempResult);
    }
    elseif ($extOriginal == 'pdf' && in_array($targetFormat, ['jpg','jpeg','png','webp'])) {
        $success = convertPDFToImage($tempOriginal, $tempResult, $targetFormat);
    }
    else {
        throw new Exception("Kombinasi konversi tidak didukung server.");
    }

    if (!$success) throw new Exception("Gagal melakukan konversi di server.");

    // --- UPLOAD HASIL ---
    updateProgress(80, "Mengupload hasil ke Cloud...");
    $keyConverted = 'converted/' . $filenameResult;
    
    $s3->putObject([
        'Bucket' => $bucketName,
        'Key'    => $keyConverted,
        'SourceFile' => $tempResult,
    ]);

    // --- DATABASE ---
    updateProgress(95, "Mencatat history...");
    $urlOriginal = $cdnDomain . "/" . $keyOriginal;
    $urlConvertedPermanent = $cdnDomain . "/" . $keyConverted;

    $pdo = new PDO("mysql:host={$dbConfig['host']};port={$dbConfig['port']};dbname={$dbConfig['name']}", $dbConfig['user'], $dbConfig['pass']);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $publicId = bin2hex(random_bytes(8));

    $stmt = $pdo->prepare("INSERT INTO conversion_logs (public_id, filename_original, filename_converted, path_original, path_converted, file_type, file_size_original) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $publicId,
        $file['name'],
        $filenameResult,
        $urlOriginal,
        $urlConvertedPermanent,
        'image/' . $targetFormat, 
        round($file['size'] / 1024, 2) . ' KB'
    ]);

    // --- GENERATE PRESIGNED URL ---
    $cmd = $s3->getCommand('GetObject', [
        'Bucket' => $bucketName,
        'Key'    => $keyConverted,
        'ResponseContentDisposition' => 'attachment; filename="' . $filenameResult . '"'
    ]);

    $request = $s3->createPresignedRequest($cmd, '+1 hour');
    $presignedUrl = (string)$request->getUri();

    // CLEANUP
    @unlink($tempOriginal);
    @unlink($tempResult);
    if($processId) @unlink(__DIR__ . '/temp/progress_' . $processId . '.json');

    updateProgress(100, "Selesai!");

    echo json_encode([
        'status' => 'success',
        'message' => 'Konversi Berhasil',
        'download_url' => $presignedUrl,
        'share_url' => 'http://' . $_SERVER['HTTP_HOST'] . '/' . $publicId
    ]);

} catch (Throwable $e) {
    http_response_code(500);
    if (ob_get_length()) ob_clean(); 
    
    if(isset($processId)) @unlink(__DIR__ . '/temp/progress_' . $processId . '.json');

    echo json_encode([
        'status' => 'error', 
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
}
ob_end_flush();
?>