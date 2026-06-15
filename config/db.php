<?php
declare(strict_types=1);

$configFile = __DIR__ . '/db.local.php';
if (!file_exists($configFile)) {
    http_response_code(500);
    echo json_encode(['error' => 'Veritabanı yapılandırması eksik: config/db.local.php']);
    exit;
}

$config = require $configFile;

try {
    $pdo = new PDO(
        "mysql:host={$config['host']};dbname={$config['dbname']};charset={$config['charset']}",
        $config['username'],
        $config['password'],
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]
    );
} catch (PDOException $e) {
    error_log('DB connection error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Veritabanı bağlantı hatası']);
    exit;
}
