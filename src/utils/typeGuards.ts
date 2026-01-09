// src/utils/typeGuards.ts

// Gerekli tipleri import et (doğru yolları kontrol et)
import type { ParsedStatement } from '../services/statement-parsing/types';
import type { ManualEntry } from '../types/manual-entry.types';

// DisplayItem tipini burada da tanımla veya ortak bir tipler dosyasından import et.
// Şimdilik burada tanımlayalım:
type DisplayItem = ParsedStatement | ManualEntry;

/**
 * Verilen öğenin bir ParsedStatement olup olmadığını kontrol eder.
 */
export function isStatement(item: DisplayItem): item is ParsedStatement {
    return item.source === 'email' || item.source === 'screenshot';
}

/**
 * Verilen öğenin bir ManualEntry olup olmadığını kontrol eder.
 */
export function isManualEntry(item: DisplayItem): item is ManualEntry {
    return item.source === 'manual';
}

// isLoan fonksiyonu kaldırıldı. 