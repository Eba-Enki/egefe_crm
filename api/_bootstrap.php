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

require __DIR__ . '/../config/db.php';
require __DIR__ . '/../includes/Auth.php';

set_exception_handler(function (Throwable $e) {
    error_log('Unhandled exception: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Sunucu hatası']);
});
