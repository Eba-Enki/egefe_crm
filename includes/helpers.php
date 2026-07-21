<?php
declare(strict_types=1);

function strOrNull($value): ?string {
    $value = trim((string)($value ?? ''));
    return $value === '' ? null : $value;
}

function enumOrDefault($value, array $allowed, string $default): string {
    return in_array($value, $allowed, true) ? $value : $default;
}

// ── Süreç Geçmişi (durum zaman çizelgesi) ──
function logStatusHistory(PDO $pdo, string $entityType, string $entityId, string $durum, ?string $kullaniciId): void {
    $stmt = $pdo->prepare('INSERT INTO status_history (entity_type, entity_id, durum, kullanici_id) VALUES (?, ?, ?, ?)');
    $stmt->execute([$entityType, $entityId, $durum, $kullaniciId]);
}

function fetchStatusHistory(PDO $pdo, string $entityType, string $entityId): array {
    $stmt = $pdo->prepare('SELECT durum, tarih, kullanici_id FROM status_history WHERE entity_type = ? AND entity_id = ? ORDER BY tarih ASC, id ASC');
    $stmt->execute([$entityType, $entityId]);
    return array_map(fn(array $r) => ['durum' => $r['durum'], 'tarih' => $r['tarih'], 'kullaniciId' => $r['kullanici_id']], $stmt->fetchAll());
}

// Bir portaldaki tüm kayıtların geçmişini tek sorguda çeker (N+1 sorgudan kaçınmak için)
function fetchStatusHistoryMap(PDO $pdo, string $entityType, array $entityIds): array {
    if (!$entityIds) return [];
    $placeholders = implode(',', array_fill(0, count($entityIds), '?'));
    $stmt = $pdo->prepare("SELECT entity_id, durum, tarih, kullanici_id FROM status_history WHERE entity_type = ? AND entity_id IN ($placeholders) ORDER BY tarih ASC, id ASC");
    $stmt->execute(array_merge([$entityType], $entityIds));
    $map = [];
    foreach ($stmt->fetchAll() as $r) {
        $map[$r['entity_id']][] = ['durum' => $r['durum'], 'tarih' => $r['tarih'], 'kullaniciId' => $r['kullanici_id']];
    }
    return $map;
}
