import fs from 'node:fs'
import zlib from 'node:zlib'
import path from 'node:path'
import crypto from 'node:crypto'

function crc32(buf) {
  let table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([typeBuf, data])
  const crcVal = crc32(body)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crcVal, 0)
  return Buffer.concat([lenBuf, body, crcBuf])
}

const inputPath = path.resolve('src/assets/black-and-white-initial-monogram-logo-50df2.png')
console.log('Reading file:', inputPath)
const buf = fs.readFileSync(inputPath)

let offset = 8
let width = 0
let height = 0
let bitDepth = 0
let colorType = 0
const idatChunks = []

while (offset < buf.length) {
  const len = buf.readUInt32BE(offset)
  const type = buf.toString('ascii', offset + 4, offset + 8)
  const data = buf.subarray(offset + 8, offset + 8 + len)
  offset += 12 + len

  if (type === 'IHDR') {
    width = data.readUInt32BE(0)
    height = data.readUInt32BE(4)
    bitDepth = data.readUInt8(8)
    colorType = data.readUInt8(9)
  } else if (type === 'IDAT') {
    idatChunks.push(data)
  } else if (type === 'IEND') {
    break
  }
}

console.log(`Input PNG: ${width}x${height}, bpc: ${bitDepth}, colorType: ${colorType}`)
const decompressed = zlib.inflateSync(Buffer.concat(idatChunks))

let bpp = 4
if (colorType === 2) bpp = 3
if (colorType === 0) bpp = 1
if (colorType === 4) bpp = 2

const stride = width * bpp
const decodedScanlines = Buffer.alloc(height * stride)
function getRawByte(y, x, c) {
  return decodedScanlines[y * stride + x * bpp + c]
}
function setDecodedByte(y, x, c, val) {
  decodedScanlines[y * stride + x * bpp + c] = val
}
function paethPredictor(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

const rawRgba = Buffer.alloc(width * height * 4)
let srcPos = 0

for (let y = 0; y < height; y++) {
  const filterType = decompressed[srcPos++]
  const lineStart = y * width * 4

  for (let x = 0; x < width; x++) {
    const pxPos = lineStart + x * 4
    let r = 0,
      g = 0,
      b = 0,
      a = 255

    for (let c = 0; c < bpp; c++) {
      let val = decompressed[srcPos++]
      let left = x > 0 ? getRawByte(y, x - 1, c) : 0
      let up = y > 0 ? getRawByte(y - 1, x, c) : 0
      let upLeft = x > 0 && y > 0 ? getRawByte(y - 1, x - 1, c) : 0

      if (filterType === 1) val = (val + left) & 0xff
      else if (filterType === 2) val = (val + up) & 0xff
      else if (filterType === 3) val = (val + Math.floor((left + up) / 2)) & 0xff
      else if (filterType === 4) val = (val + paethPredictor(left, up, upLeft)) & 0xff

      setDecodedByte(y, x, c, val)

      if (colorType === 6) {
        if (c === 0) r = val
        if (c === 1) g = val
        if (c === 2) b = val
        if (c === 3) a = val
      } else if (colorType === 2) {
        if (c === 0) r = val
        if (c === 1) g = val
        if (c === 2) b = val
        a = 255
      } else if (colorType === 0) {
        r = g = b = val
        a = 255
      } else if (colorType === 4) {
        if (c === 0) r = g = b = val
        if (c === 1) a = val
      }
    }

    rawRgba[pxPos] = r
    rawRgba[pxPos + 1] = g
    rawRgba[pxPos + 2] = b
    rawRgba[pxPos + 3] = a
  }
}

// Encontrar bounding box do conteúdo escuro
let minX = width,
  maxX = 0,
  minY = height,
  maxY = 0
let darkPixelCount = 0

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const idx = (y * width + x) * 4
    const r = rawRgba[idx]
    const g = rawRgba[idx + 1]
    const b = rawRgba[idx + 2]
    const a = rawRgba[idx + 3]

    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    const isInk = a > 30 && lum < 220

    if (isInk) {
      darkPixelCount++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
}

console.log(`Found ink pixels: ${darkPixelCount}`)
console.log(
  `Ink Bounding Box: [${minX}, ${minY}] to [${maxX}, ${maxY}], width=${maxX - minX + 1}, height=${maxY - minY + 1}`,
)

// Folga justa (padding) de ~15px
const padding = 15
const cropX = Math.max(0, minX - padding)
const cropY = Math.max(0, minY - padding)
const cropW = Math.min(width - cropX, maxX - minX + 1 + padding * 2)
const cropH = Math.min(height - cropY, maxY - minY + 1 + padding * 2)

console.log(`Cropped dimensions: ${cropW}x${cropH}`)

const croppedRgba = Buffer.alloc(cropW * cropH * 4)

for (let y = 0; y < cropH; y++) {
  for (let x = 0; x < cropW; x++) {
    const srcIdx = ((cropY + y) * width + (cropX + x)) * 4
    const dstIdx = (y * cropW + x) * 4

    const r = rawRgba[srcIdx]
    const g = rawRgba[srcIdx + 1]
    const b = rawRgba[srcIdx + 2]
    const a = rawRgba[srcIdx + 3]

    const lum = 0.299 * r + 0.587 * g + 0.114 * b

    let outAlpha = 0
    if (lum <= 180) {
      outAlpha = a
    } else if (lum < 245) {
      const t = (245 - lum) / 65
      outAlpha = Math.round(a * t)
    } else {
      outAlpha = 0
    }

    croppedRgba[dstIdx] = 18 // traço preto elegante
    croppedRgba[dstIdx + 1] = 18
    croppedRgba[dstIdx + 2] = 22
    croppedRgba[dstIdx + 3] = outAlpha
  }
}

// Criar PNG RGBA recortado
const ihdrBuf = Buffer.alloc(13)
ihdrBuf.writeUInt32BE(cropW, 0)
ihdrBuf.writeUInt32BE(cropH, 4)
ihdrBuf.writeUInt8(8, 8)
ihdrBuf.writeUInt8(6, 9)
ihdrBuf.writeUInt8(0, 10)
ihdrBuf.writeUInt8(0, 11)
ihdrBuf.writeUInt8(0, 12)

const outStride = cropW * 4
const scanlinesBuf = Buffer.alloc(cropH * (outStride + 1))
let outPos = 0
for (let y = 0; y < cropH; y++) {
  scanlinesBuf[outPos++] = 0
  croppedRgba.copy(scanlinesBuf, outPos, y * outStride, (y + 1) * outStride)
  outPos += outStride
}

const deflated = zlib.deflateSync(scanlinesBuf, { level: 9 })
const pngPreamble = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const finalPng = Buffer.concat([
  pngPreamble,
  makeChunk('IHDR', ihdrBuf),
  makeChunk('IDAT', deflated),
  makeChunk('IEND', Buffer.alloc(0)),
])

const outputPath = path.resolve('src/assets/assinatura-medica-principal-transparente.png')
fs.writeFileSync(outputPath, finalPng)
const sha256 = crypto.createHash('sha256').update(finalPng).digest('hex')

console.log(`Saved transparent cropped PNG: ${outputPath} (${finalPng.length} bytes)`)
console.log(`SHA-256: ${sha256}`)

const dataUri = `data:image/png;base64,${finalPng.toString('base64')}`
const metadata = {
  fileName: 'assinatura-medica-principal-transparente.png',
  source: 'black-and-white-initial-monogram-logo-50df2.png',
  width: cropW,
  height: cropH,
  aspectRatio: cropW / cropH,
  fileSize: finalPng.length,
  sha256,
  dataUri,
}

fs.writeFileSync(
  path.resolve('src/assets/assinatura-metadata.json'),
  JSON.stringify(metadata, null, 2),
)

console.log('Processed metadata written.')
