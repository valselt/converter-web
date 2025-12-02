<?php
// src/backend/check_progress.php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$id = isset($_GET['id']) ? preg_replace('/[^a-zA-Z0-9]/', '', $_GET['id']) : '';

if (!$id) {
    echo json_encode(['percent' => 0, 'message' => 'Menunggu...']);
    exit;
}

$file = __DIR__ . '/temp/progress_' . $id . '.json';

if (file_exists($file)) {
    // Baca isi file progress
    echo file_get_contents($file);
} else {
    echo json_encode(['percent' => 0, 'message' => 'Memulai...']);
}
?>