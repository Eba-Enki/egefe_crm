<?php
declare(strict_types=1);

session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => !empty($_SERVER['HTTPS']),
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();

header('Content-Type: application/json; charset=utf-8');

// Bazı hosting/güvenlik ortamları PUT ve DELETE HTTP metotlarını 405 ile
// engelliyor. Bu durumda istemci (js/api.js) gerçek metodu POST + ?_method=
// üzerinden gönderiyor; burada gerçek metoda çeviriyoruz ki endpoint'ler
// hiçbir değişiklik yapmadan normal şekilde çalışsın.
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['_method'])) {
    $methodOverride = strtoupper((string)$_GET['_method']);
    if (in_array($methodOverride, ['PUT', 'DELETE', 'PATCH'], true)) {
        $_SERVER['REQUEST_METHOD'] = $methodOverride;
    }
}

require __DIR__ . '/../config/db.php';
require __DIR__ . '/../includes/Auth.php';
require __DIR__ . '/../includes/helpers.php';

set_exception_handler(function (Throwable $e) {
    error_log('Unhandled exception: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Sunucu hatası']);
});
