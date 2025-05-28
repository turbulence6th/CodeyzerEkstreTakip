import { readFileSync, writeFileSync } from 'fs';

// 1. EML dosyasını oku
const eml = readFileSync('garanti.eml', 'utf8');

// 2. Dosyanın en sonundaki base64 bloğunu bul
// Son iki boş satırdan sonrasını al (genellikle base64 gövde en sonda olur)
const parts = eml.trim().split(/\r?\n\r?\n/);
const base64Body = parts[parts.length - 1].replace(/\r?\n/g, '');

console.log(base64Body);

// 3. Base64 decode et
const html = Buffer.from(base64Body, 'base64').toString('utf8');

// 4. HTML dosyasına yaz
writeFileSync('akbank-ekstre-sample.html', html, 'utf8');
console.log('HTML başarıyla çıkarıldı: akbank-ekstre-sample.html'); 