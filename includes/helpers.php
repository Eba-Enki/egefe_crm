<?php
declare(strict_types=1);

function strOrNull($value): ?string {
    $value = trim((string)($value ?? ''));
    return $value === '' ? null : $value;
}

function enumOrDefault($value, array $allowed, string $default): string {
    return in_array($value, $allowed, true) ? $value : $default;
}
