<?php
declare(strict_types=1);
http_response_code(410);
echo json_encode(['error' => 'Bu kurulum aracı kaldırılmıştır.']);
