<?php
// src/backend/test_connection.php
header('Content-Type: text/plain');

$targetIP = '100.115.160.110'; // IP CasaOS Anda
$mysqlPort = 3306;
$minioPort = 9010;

echo "--- DIAGNOSA KONEKSI ---\n\n";

// 1. CEK LIBRARY AWS
echo "1. Cek Library AWS SDK: ";
if (file_exists(__DIR__ . '/vendor/autoload.php')) {
    echo "ADA (OK)\n";
} else {
    echo "TIDAK ADA (GAGAL) -> Jalankan perintah composer!\n";
}

// 2. CEK KONEKSI JARINGAN KE MYSQL
echo "2. Ping Port MySQL ($targetIP:$mysqlPort): ";
$conn = @fsockopen($targetIP, $mysqlPort, $errno, $errstr, 2);
if ($conn) {
    echo "BERHASIL TERHUBUNG\n";
    fclose($conn);
} else {
    echo "GAGAL ($errstr)\n";
}

// 3. CEK KONEKSI JARINGAN KE MINIO
echo "3. Ping Port MinIO ($targetIP:$minioPort): ";
$conn2 = @fsockopen($targetIP, $minioPort, $errno, $errstr, 2);
if ($conn2) {
    echo "BERHASIL TERHUBUNG\n";
    fclose($conn2);
} else {
    echo "GAGAL ($errstr)\n";
}

// 4. CEK LOGIN MYSQL (TEST USER/PASS)
echo "4. Cek Login MySQL: ";
try {
    $pdo = new PDO("mysql:host=$targetIP;port=$mysqlPort;dbname=db_converterbyvalselt", 'root', 'aldorino04');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "LOGIN SUKSES\n";
} catch (PDOException $e) {
    echo "LOGIN GAGAL: " . $e->getMessage() . "\n";
}
?>