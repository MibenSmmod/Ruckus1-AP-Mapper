// PDF page sizes in points (1/72 in).
const PAPER_SIZES = {
  letter: { width: 612, height: 792 },
  a4: { width: 595.28, height: 841.89 }
};

// Countries that use US Letter by default; everywhere else gets A4.
const LETTER_COUNTRIES = new Set([
  'US', 'CA', 'MX', 'PR', 'PH', 'CL', 'CO', 'VE', 'GT', 'CR', 'PA', 'DO', 'SV', 'NI', 'BZ'
]);

function paperForCountry(countryCode) {
  return LETTER_COUNTRIES.has(String(countryCode || '').toUpperCase()) ? 'letter' : 'a4';
}

/**
 * Fit an image of imageWidth x imageHeight (pixels) onto a standard paper
 * page. Orientation follows the image (wider than tall -> landscape), and the
 * image is scaled to fit inside the margin and centered.
 */
function pdfPageLayout(imageWidth, imageHeight, { paper = 'letter', margin = 36 } = {}) {
  const size = PAPER_SIZES[paper] || PAPER_SIZES.letter;
  const landscape = imageWidth > imageHeight;
  const pageWidth = landscape ? size.height : size.width;
  const pageHeight = landscape ? size.width : size.height;
  const scale = Math.min(
    (pageWidth - margin * 2) / imageWidth,
    (pageHeight - margin * 2) / imageHeight
  );
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  return {
    pageWidth,
    pageHeight,
    landscape,
    drawWidth,
    drawHeight,
    x: (pageWidth - drawWidth) / 2,
    y: (pageHeight - drawHeight) / 2
  };
}

// Round to 2 decimals for PDF operators without trailing noise.
function pt(n) {
  return String(Math.round(n * 100) / 100);
}

/**
 * Build a one-page PDF that embeds a JPEG image (no external deps).
 * The page is a standard paper size (Letter or A4), oriented to match the
 * image, with the image scaled to fit and centered.
 */
function createPdfFromJpeg(jpegBuffer, width, height, options = {}) {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const jpeg = Buffer.isBuffer(jpegBuffer) ? jpegBuffer : Buffer.from(jpegBuffer);
  const layout = pdfPageLayout(w, h, options);
  const contentStream =
    `q ${pt(layout.drawWidth)} 0 0 ${pt(layout.drawHeight)} ${pt(layout.x)} ${pt(layout.y)} cm /Im0 Do Q`;

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
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pt(layout.pageWidth)} ${pt(layout.pageHeight)}] ` +
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

module.exports = { createPdfFromJpeg, pdfPageLayout, paperForCountry, PAPER_SIZES };
