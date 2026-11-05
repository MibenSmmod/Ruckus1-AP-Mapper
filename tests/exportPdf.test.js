const test = require('node:test');
const assert = require('node:assert/strict');
const { createPdfFromJpeg, pdfPageLayout, paperForCountry } = require('../src/exportPdf');

test('paperForCountry: Letter for US/Canada, A4 elsewhere', () => {
  assert.equal(paperForCountry('US'), 'letter');
  assert.equal(paperForCountry('ca'), 'letter');
  assert.equal(paperForCountry('DE'), 'a4');
  assert.equal(paperForCountry('GB'), 'a4');
  assert.equal(paperForCountry(''), 'a4');
  assert.equal(paperForCountry(undefined), 'a4');
});

test('pdfPageLayout: wide map goes landscape Letter, fitted inside the margin and centered', () => {
  const l = pdfPageLayout(1877, 1598, { paper: 'letter', margin: 36 });
  assert.equal(l.landscape, true);
  assert.equal(l.pageWidth, 792);
  assert.equal(l.pageHeight, 612);
  // Height is the limiting side: 612 - 72 = 540pt tall.
  assert.ok(Math.abs(l.drawHeight - 540) < 0.01);
  assert.ok(l.drawWidth <= 792 - 72 + 0.01);
  assert.ok(Math.abs(l.x - (792 - l.drawWidth) / 2) < 0.01);
  assert.ok(Math.abs(l.y - 36) < 0.01);
  // Aspect ratio preserved.
  assert.ok(Math.abs(l.drawWidth / l.drawHeight - 1877 / 1598) < 1e-9);
});

test('pdfPageLayout: tall map goes portrait A4', () => {
  const l = pdfPageLayout(1000, 2000, { paper: 'a4', margin: 36 });
  assert.equal(l.landscape, false);
  assert.equal(l.pageWidth, 595.28);
  assert.equal(l.pageHeight, 841.89);
  assert.ok(l.drawWidth <= 595.28 - 72 + 0.01);
  assert.ok(l.drawHeight <= 841.89 - 72 + 0.01);
});

test('createPdfFromJpeg: MediaBox is the paper size, image keeps its pixel size', () => {
  const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  const pdf = createPdfFromJpeg(fakeJpeg, 1877, 1598, { paper: 'letter' }).toString('latin1');
  assert.match(pdf, /\/MediaBox \[0 0 792 612\]/);
  assert.match(pdf, /\/Width 1877 \/Height 1598/);
  assert.ok(pdf.startsWith('%PDF-1.4'));
  assert.ok(pdf.trimEnd().endsWith('%%EOF'));
  // xref offsets point at their objects.
  const startxref = Number(pdf.match(/startxref\n(\d+)/)[1]);
  assert.ok(pdf.slice(startxref).startsWith('xref'));
  const offsets = [...pdf.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
  offsets.forEach((off, i) => assert.ok(pdf.slice(off).startsWith(`${i + 1} 0 obj`)));
});
