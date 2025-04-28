// src/utils/typeGuards.ts

// Gerekli tipleri import et (doğru yolları kontrol et)
import type { ParsedStatement, ParsedLoan } from '../services/sms-parsing/types';
import type { ManualEntry } from '../types/manual-entry.types';

// DisplayItem tipini burada da tanımla veya ortak bir tipler dosyasından import et.
// Şimdilik burada tanımlayalım:
type DisplayItem = ParsedStatement | ParsedLoan | ManualEntry;

/**
 * Verilen öğenin bir ParsedStatement olup olmadığını kontrol eder.
 */
export function isStatement(item: DisplayItem): item is ParsedStatement {
    // Kredi olmadığından ve manuel olmadığından emin ol, sonra dueDate var mı bak.
    // Bu, ParsedLoan'da da dueDate olabileceği ihtimaline karşı daha güvenli olabilir.
    return item.source !== 'manual' && 
           !(item as ParsedLoan).firstPaymentDate && 
           (item as ParsedStatement).dueDate !== undefined;
}

/**
 * Verilen öğenin bir ManualEntry olup olmadığını kontrol eder.
 */
export function isManualEntry(item: DisplayItem): item is ManualEntry {
    return item.source === 'manual';
}

/**
 * Verilen öğenin bir ParsedLoan olup olmadığını kontrol eder.
 */
export function isLoan(item: DisplayItem): item is ParsedLoan {
    // Eğer manuel değilse ve ekstre değilse, ParsedLoan olmalı.
    // Daha kesin kontrol için loanAmount gibi bir özelliğin varlığını da kontrol edebiliriz,
    // ancak isStatement kontrolü zaten firstPaymentDate'in varlığını dışladığı için
    // bu genellikle yeterli olacaktır.
    return !isManualEntry(item) && !isStatement(item);
} 