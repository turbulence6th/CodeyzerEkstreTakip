import { readFileSync, writeFileSync } from 'fs';

// 1. EML dosyasını oku
const eml = readFileSync('garanti.eml', 'utf8');

// 2. Boundary'yi bul
const boundaryMatch = eml.match(/boundary="([^"]+)"/);
if (!boundaryMatch) {
  console.error('Boundary not found in EML file.');
  process.exit(1);
}
const boundary = `--${boundaryMatch[1]}`;

// 3. E-posta içeriğini parçalara ayır
const parts = eml.split(boundary);

// 4. HTML içeriğini bul
let html = '';
for (const part of parts) {
  if (part.includes('Content-Type: text/html')) {
    // Header ve içeriği ayır
    const contentParts = part.split(/\r?\n\r?\n/);
    if (contentParts.length > 1) {
      html = contentParts.slice(1).join('\r\n\r\n').trim();
      // İçerik base64 ise decode et
      if (part.includes('Content-Transfer-Encoding: base64')) {
        html = Buffer.from(html.replace(/\r?\n/g, ''), 'base64').toString('utf8');
      }
      break;
    }
  }
}

if (html) {
  // 5. HTML dosyasına yaz
  writeFileSync('garanti-ekstre-sample.html', html, 'utf8');
  console.log('HTML başarıyla çıkarıldı: garanti-ekstre-sample.html');
} else {
  console.log('HTML content not found.');
}