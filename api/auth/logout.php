<?php
declare(strict_types=1);
require __DIR__ . '/../_bootstrap.php';

$_SESSION = [];
session_destroy();

echo json_encode(['ok' => true]);
