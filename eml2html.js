import { readFileSync, writeFileSync } from 'fs';

// 1. EML dosyasını oku
const eml = readFileSync('qnb.eml', 'utf8');

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
      
      if (part.includes('Content-Transfer-Encoding: base64')) {
        // Base64 decode
        const buffer = Buffer.from(html.replace(/\r?\n/g, ''), 'base64');
        const decoder = new TextDecoder('utf-8'); // Varsayılan utf-8, gerekirse charset parse edilebilir
        html = decoder.decode(buffer);
      } else if (part.includes('Content-Transfer-Encoding: quoted-printable')) {
        // Quoted-Printable decode
        // 1. Soft line breaks (=\r\n) kaldır
        let decoded = html.replace(/=\r?\n/g, '');
        // 2. Hex karakterleri (örn =3D) byte array'e çevir
        const bytes = [];
        for (let i = 0; i < decoded.length; i++) {
          if (decoded[i] === '=') {
            const hex = decoded.substr(i + 1, 2);
            if (/^[0-9A-F]{2}$/i.test(hex)) {
              bytes.push(parseInt(hex, 16));
              i += 2;
            } else {
              bytes.push(decoded.charCodeAt(i));
            }
          } else {
            bytes.push(decoded.charCodeAt(i));
          }
        }
        
        // 3. Charset'e göre decode et (ISO-8859-9 Türkçe için)
        let charset = 'utf-8';
        const charsetMatch = part.match(/charset=["']?([a-zA-Z0-9-]+)["']?/i);
        if (charsetMatch) {
          charset = charsetMatch[1].toLowerCase();
        } else {
            // Fallback: check within the HTML content itself if available
            const metaCharsetMatch = html.match(/charset=["']?([a-zA-Z0-9-]+)["']?/i);
            if (metaCharsetMatch) {
                 charset = metaCharsetMatch[1].toLowerCase();
            }
        }
        
        console.log(`Detected charset: ${charset}`);

        const buffer = new Uint8Array(bytes);
        try {
             const decoder = new TextDecoder(charset);
             html = decoder.decode(buffer);
        } catch (e) {
             console.warn(`Charset ${charset} not supported, falling back to utf-8`);
             const decoder = new TextDecoder('utf-8');
             html = decoder.decode(buffer);
        }
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