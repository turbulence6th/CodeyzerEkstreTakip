import { readFileSync, writeFileSync } from 'fs';

// CLI: node eml2html.js <input.eml> [output.html]
const inputPath = process.argv[2] || 'qnb.eml';
const outputPath = process.argv[3] || inputPath.replace(/\.eml$/i, '') + '.html';

// 1. EML dosyasını byte kaybı olmadan oku (latin1: 1 byte = 1 karakter).
//    Gerçek decode işlemi, part'ın charset'ine göre daha sonra yapılır.
const eml = readFileSync(inputPath, 'latin1');

// --- Yardımcılar -----------------------------------------------------------

// Header bloğu ile gövdeyi ayırır (ilk boş satır sınırdır)
function splitPart(part) {
  const sep = /\r?\n\r?\n/.exec(part);
  if (!sep) return { headers: part, body: '' };
  return {
    headers: part.slice(0, sep.index),
    body: part.slice(sep.index + sep[0].length),
  };
}

// Katlanmış (folded) header satırlarını birleştirip istenen header'ı döner
function getHeader(headers, name) {
  const unfolded = headers.replace(/\r?\n[ \t]+/g, ' ');
  const match = unfolded.match(new RegExp(`^${name}:[ \\t]*(.*)$`, 'im'));
  return match ? match[1].trim() : '';
}

// Content-Type gibi header'lardan parametre okur: boundary="x", charset=utf-8
function getParam(headerValue, name) {
  const match = headerValue.match(new RegExp(`${name}\\s*=\\s*("([^"]+)"|[^;\\s]+)`, 'i'));
  return match ? (match[2] ?? match[1]).trim() : '';
}

// Quoted-Printable -> byte dizisi
function decodeQuotedPrintable(body) {
  const text = body.replace(/=\r?\n/g, ''); // soft line break
  const bytes = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '=' && /^[0-9A-F]{2}$/i.test(text.substr(i + 1, 2))) {
      bytes.push(parseInt(text.substr(i + 1, 2), 16));
      i += 2;
    } else {
      bytes.push(text.charCodeAt(i) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

// Transfer encoding'e göre gövdeyi byte'lara çevirir
function decodeBody(body, encoding) {
  switch (encoding.toLowerCase()) {
    case 'base64':
      return Buffer.from(body.replace(/\s+/g, ''), 'base64');
    case 'quoted-printable':
      return decodeQuotedPrintable(body);
    default: // 7bit, 8bit, binary, boş
      return Buffer.from(body, 'latin1');
  }
}

// Byte'ları charset'e göre metne çevirir (ISO-8859-9 gibi Türkçe charset'ler dahil)
function toText(buffer, charset) {
  const normalized = (charset || 'utf-8').toLowerCase().replace(/^cp/, 'windows-');
  try {
    return new TextDecoder(normalized).decode(buffer);
  } catch {
    console.warn(`Charset ${normalized} desteklenmiyor, utf-8'e düşülüyor.`);
    return new TextDecoder('utf-8').decode(buffer);
  }
}

// 2. MIME ağacında text/html part'ını özyinelemeli olarak ara.
//    Dönüş: { html, charset, attachment } | null
function findHtml(part, isAttachment = false) {
  const { headers, body } = splitPart(part);
  const contentType = getHeader(headers, 'Content-Type') || 'text/plain';
  const mimeType = contentType.split(';')[0].trim().toLowerCase();
  const disposition = getHeader(headers, 'Content-Disposition');
  const attached = isAttachment || /^attachment/i.test(disposition);

  // 2a. İç içe multipart: boundary ile parçalayıp her parçaya in
  if (mimeType.startsWith('multipart/')) {
    const boundary = getParam(contentType, 'boundary');
    if (!boundary) return null;

    let fallback = null;
    // chunks[0] preamble'dır, atlanır
    for (const chunk of body.split(`--${boundary}`).slice(1)) {
      if (chunk.startsWith('--')) break; // kapanış sınırı
      const found = findHtml(chunk.replace(/^\r?\n/, ''), attached);
      if (!found) continue;
      if (!found.attachment) return found; // inline HTML her zaman öncelikli
      fallback ??= found; // ek olarak gelen HTML sadece yedek
    }
    return fallback;
  }

  // 2b. İçine gömülü e-posta (message/rfc822)
  if (mimeType === 'message/rfc822') {
    return findHtml(body, attached);
  }

  // 2c. Aranan part
  if (mimeType === 'text/html') {
    const buffer = decodeBody(body, getHeader(headers, 'Content-Transfer-Encoding'));
    let charset = getParam(contentType, 'charset');
    if (!charset) {
      // Fallback: HTML'in kendi meta charset'ine bak
      charset = getParam(buffer.toString('latin1').slice(0, 2048), 'charset') || 'utf-8';
    }
    return { html: toText(buffer, charset), charset, attachment: attached };
  }

  return null;
}

const result = findHtml(eml);

if (!result) {
  console.log('HTML content not found.');
  process.exit(1);
}

console.log(`Detected charset: ${result.charset}${result.attachment ? ' (ek olarak geldi)' : ''}`);

// 3. Çıktı utf-8 yazıldığı için meta charset bildirimlerini de utf-8 yap
const html = result.html.replace(/<meta\b[^>]*>/gi, (tag) =>
  /charset/i.test(tag) ? tag.replace(/charset\s*=\s*(["']?)[\w-]+\1/gi, 'charset=$1utf-8$1') : tag
);

// 4. HTML dosyasına yaz
writeFileSync(outputPath, html.trim(), 'utf8');
console.log(`HTML başarıyla çıkarıldı: ${outputPath}`);
