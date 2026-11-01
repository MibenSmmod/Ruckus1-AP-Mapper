/**
 * Build a one-page PDF that embeds a JPEG image (no external deps).
 * Page size matches the image pixel dimensions (1 px ≈ 1 pt).
 */
function createPdfFromJpeg(jpegBuffer, width, height) {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const jpeg = Buffer.isBuffer(jpegBuffer) ? jpegBuffer : Buffer.from(jpegBuffer);
  const contentStream = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;

  const chunks = [];
  const offsets = [0];
  let position = 0;

  function write(buf) {
    const buffer = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, 'utf8');
    chunks.push(buffer);
    position += buffer.length;
  }

  write('%PDF-1.4\n');

  offsets[1] = position;
  write('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  offsets[2] = position;
  write('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  offsets[3] = position;
  write(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
      `/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  );

  offsets[4] = position;
  write(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ` +
      `/Length ${jpeg.length} >>\nstream\n`
  );
  write(jpeg);
  write('\nendstream\nendobj\n');

  offsets[5] = position;
  write(
    `5 0 obj\n<< /Length ${Buffer.byteLength(contentStream, 'utf8')} >>\nstream\n${contentStream}\nendstream\nendobj\n`
  );

  const xrefOffset = position;
  write('xref\n0 6\n');
  write('0000000000 65535 f \n');
  for (let i = 1; i <= 5; i++) {
    write(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  write(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return Buffer.concat(chunks);
}

module.exports = { createPdfFromJpeg };
