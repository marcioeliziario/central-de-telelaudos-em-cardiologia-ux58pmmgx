/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0027 (atendendo especificação da tarefa como seed de ECG HD de demonstração).
 * Gera um PNG sintético de ECG de demonstração em alta resolução:
 *  - Dimensões: 2400 x 1600 pixels
 *  - Grade milimétrica: 1 mm (leves traços salmão) e 5 mm (traços salmão mais evidentes)
 *  - 12 derivações clássicas (DI, DII, DIII, aVR, aVL, aVF, V1, V2, V3, V4, V5, V6) + DII longo
 *  - Ondas P, complexos QRS e ondas T plausíveis desenhadas proceduralmente
 *  - Carimbo em destaque: "ECG DE DEMONSTRAÇÃO — NÃO USAR PARA CONDUTA CLÍNICA"
 *  - Registro NOVO em exam_requests criado já com exam_file anexado
 */
migrate(
  (app) => {
    // 1. Verificar se o registro de demonstração já foi semeado (idempotência)
    try {
      const existing = app.findFirstRecordByFilter(
        'exam_requests',
        "clinical_indication ~ 'ECG DE DEMONSTRAÇÃO' || clinical_indication ~ 'TRAÇADO DE DEMONSTRAÇÃO'",
      )
      if (existing) {
        console.log('Registro de ECG de demonstração já existente id:', existing.id)
        return
      }
    } catch (_) {}

    const WIDTH = 2400
    const HEIGHT = 1600

    // Paleta indexada de 8 cores para geração rápida e compacta do PNG
    // 0: Fundo papel milimetrado (#FFFDF8)
    // 1: Grade fina 1mm (#FAD4C0)
    // 2: Grade grossa 5mm (#F09B7D)
    // 3: Traçado do ECG (#1A202C)
    // 4: Textos de derivação e calibração (#2D3748)
    // 5: Carimbo de alerta advertência fundo (#FFF3CD)
    // 6: Carimbo de alerta borda/texto (#991B1B)
    // 7: Grade secundária (#FDE8DC)
    const PALETTE = [
      [255, 253, 248], // 0: fundo papel
      [250, 212, 192], // 1: grade 1mm
      [240, 155, 125], // 2: grade 5mm
      [26, 32, 44], // 3: traçado ECG
      [45, 55, 72], // 4: rótulos / textos
      [255, 243, 205], // 5: tarja advertência
      [153, 27, 27], // 6: texto advertência vermelho
      [253, 232, 220], // 7: grade sutil
    ]

    // Criar buffer 2D indexado: HEIGHT linhas, cada uma com WIDTH bytes
    // Usamos Uint8Array de tamanho WIDTH * HEIGHT
    const pixels = new Uint8Array(WIDTH * HEIGHT)

    // Preencher com a cor de fundo (0)
    pixels.fill(0)

    // 2. Desenhar grade milimétrica em tons salmão
    // Em escala padrão 100dpi/virtual: 1mm = 8px, 5mm = 40px
    const MM1 = 8
    const MM5 = 40

    // Grade fina de 1mm
    for (let x = 0; x < WIDTH; x += MM1) {
      const is5 = x % MM5 === 0
      const color = is5 ? 2 : 1
      for (let y = 0; y < HEIGHT; y++) {
        pixels[y * WIDTH + x] = color
      }
    }
    for (let y = 0; y < HEIGHT; y += MM1) {
      const is5 = y % MM5 === 0
      const color = is5 ? 2 : 1
      const rowOffset = y * WIDTH
      for (let x = 0; x < WIDTH; x++) {
        // Se já era 2 (cruzamento 5mm), manter 2
        if (pixels[rowOffset + x] !== 2) {
          pixels[rowOffset + x] = color
        }
      }
    }

    // Helper para desenhar linhas retas ou segmentos
    function drawLine(x0, y0, x1, y1, color, thickness) {
      x0 = Math.round(x0)
      y0 = Math.round(y0)
      x1 = Math.round(x1)
      y1 = Math.round(y1)
      const dx = Math.abs(x1 - x0)
      const dy = Math.abs(y1 - y0)
      const sx = x0 < x1 ? 1 : -1
      const sy = y0 < y1 ? 1 : -1
      let err = dx - dy

      while (true) {
        for (let tx = -thickness; tx <= thickness; tx++) {
          for (let ty = -thickness; ty <= thickness; ty++) {
            const px = x0 + tx
            const py = y0 + ty
            if (px >= 0 && px < WIDTH && py >= 0 && py < HEIGHT) {
              pixels[py * WIDTH + px] = color
            }
          }
        }
        if (x0 === x1 && y0 === y1) break
        const e2 = 2 * err
        if (e2 > -dy) {
          err -= dy
          x0 += sx
        }
        if (e2 < dx) {
          err += dx
          y0 += sy
        }
      }
    }

    // Helper para desenhar retângulo preenchido
    function fillRect(rx, ry, rw, rh, color) {
      for (let y = Math.max(0, ry); y < Math.min(HEIGHT, ry + rh); y++) {
        const offset = y * WIDTH
        for (let x = Math.max(0, rx); x < Math.min(WIDTH, rx + rw); x++) {
          pixels[offset + x] = color
        }
      }
    }

    // Helper para desenhar moldura
    function strokeRect(rx, ry, rw, rh, color, thickness) {
      drawLine(rx, ry, rx + rw, ry, color, thickness)
      drawLine(rx + rw, ry, rx + rw, ry + rh, color, thickness)
      drawLine(rx + rw, ry + rh, rx, ry + rh, color, thickness)
      drawLine(rx, ry + rh, rx, ry, color, thickness)
    }

    // Fonte bitmap 5x7 simples para escrever rótulos médicos sem bibliotecas externas
    const FONT_5X7 = {
      ' ': [0, 0, 0, 0, 0],
      '-': [0, 8, 8, 8, 0],
      '.': [0, 64, 0, 0, 0],
      ':': [0, 36, 0, 0, 0],
      '/': [0x60, 0x18, 0x06, 0x01, 0],
      0: [0x3e, 0x51, 0x49, 0x45, 0x3e],
      1: [0x00, 0x42, 0x7f, 0x40, 0x00],
      2: [0x42, 0x61, 0x51, 0x49, 0x46],
      3: [0x21, 0x41, 0x45, 0x4b, 0x31],
      4: [0x18, 0x14, 0x12, 0x7f, 0x10],
      5: [0x27, 0x45, 0x45, 0x45, 0x39],
      6: [0x3c, 0x4a, 0x49, 0x49, 0x30],
      7: [0x01, 0x71, 0x09, 0x05, 0x03],
      8: [0x36, 0x49, 0x49, 0x49, 0x36],
      9: [0x06, 0x49, 0x49, 0x29, 0x1e],
      A: [0x7e, 0x11, 0x11, 0x11, 0x7e],
      B: [0x7f, 0x49, 0x49, 0x49, 0x36],
      C: [0x3e, 0x41, 0x41, 0x41, 0x22],
      D: [0x7f, 0x41, 0x41, 0x22, 0x1c],
      E: [0x7f, 0x49, 0x49, 0x49, 0x41],
      F: [0x7f, 0x09, 0x09, 0x09, 0x01],
      G: [0x3e, 0x41, 0x49, 0x49, 0x7a],
      H: [0x7f, 0x08, 0x08, 0x08, 0x7f],
      I: [0x00, 0x41, 0x7f, 0x41, 0x00],
      J: [0x20, 0x40, 0x41, 0x3f, 0x01],
      K: [0x7f, 0x08, 0x14, 0x22, 0x41],
      L: [0x7f, 0x40, 0x40, 0x40, 0x40],
      M: [0x7f, 0x02, 0x0c, 0x02, 0x7f],
      N: [0x7f, 0x04, 0x08, 0x10, 0x7f],
      O: [0x3e, 0x41, 0x41, 0x41, 0x3e],
      P: [0x7f, 0x09, 0x09, 0x09, 0x06],
      Q: [0x3e, 0x41, 0x51, 0x21, 0x5e],
      R: [0x7f, 0x09, 0x19, 0x29, 0x46],
      S: [0x46, 0x49, 0x49, 0x49, 0x31],
      T: [0x01, 0x01, 0x7f, 0x01, 0x01],
      U: [0x3f, 0x40, 0x40, 0x40, 0x3f],
      V: [0x1f, 0x20, 0x40, 0x20, 0x1f],
      W: [0x7f, 0x20, 0x18, 0x20, 0x7f],
      X: [0x63, 0x14, 0x08, 0x14, 0x63],
      Y: [0x07, 0x08, 0x70, 0x08, 0x07],
      Z: [0x61, 0x51, 0x49, 0x45, 0x43],
      Ã: [0x7e, 0x13, 0x15, 0x11, 0x7e],
      Õ: [0x3e, 0x43, 0x45, 0x41, 0x3e],
      Ç: [0x3e, 0x41, 0x41, 0xa1, 0x62],
      Í: [0x00, 0x43, 0x7d, 0x41, 0x00],
    }

    function drawChar(ch, startX, startY, color, scale) {
      const glyph = FONT_5X7[ch.toUpperCase()] || FONT_5X7[' ']
      for (let col = 0; col < 5; col++) {
        const bits = glyph[col] || 0
        for (let row = 0; row < 7; row++) {
          if ((bits & (1 << row)) !== 0) {
            fillRect(
              Math.round(startX + col * scale),
              Math.round(startY + row * scale),
              scale,
              scale,
              color,
            )
          }
        }
      }
    }

    function drawText(text, startX, startY, color, scale) {
      let curX = startX
      const clean = text
        .replace(/ã/gi, 'Ã')
        .replace(/õ/gi, 'Õ')
        .replace(/ç/gi, 'Ç')
        .replace(/í/gi, 'Í')
      for (let i = 0; i < clean.length; i++) {
        drawChar(clean[i], curX, startY, color, scale)
        curX += 6 * scale
      }
    }

    // 3. Desenhar Cabeçalho e Metadados do ECG
    drawText('CARDIOLAB TELEMEDICINA - CENTRAL DE TELELAUDOS EM CARDIOLOGIA', 40, 30, 4, 3)
    drawText(
      'ECG DE 12 DERIVACOES SIMULTANEAS COM DII LONGO - ALTA RESOLUCAO 2400x1600',
      40,
      65,
      4,
      2,
    )
    drawText('PACIENTE DEMONSTRACAO - ID: DEMO-ECG-2026 - RITMO SINUSAL 75 BPM', 40, 95, 4, 2)

    // 4. Desenhar Carimbo de Advertência Clínica
    const alertBoxX = 1100
    const alertBoxY = 24
    const alertBoxW = 1250
    const alertBoxH = 92
    fillRect(alertBoxX, alertBoxY, alertBoxW, alertBoxH, 5)
    strokeRect(alertBoxX, alertBoxY, alertBoxW, alertBoxH, 6, 2)
    drawText(
      'ATENCAO: ECG DE DEMONSTRACAO - NAO USAR PARA CONDUTA CLINICA',
      alertBoxX + 24,
      alertBoxY + 20,
      6,
      3,
    )
    drawText(
      'TRAÇADO SINTETICO DE ALTA FIDELIDADE PARA CALIBRACAO E TESTE DO VISUALIZADOR',
      alertBoxX + 26,
      alertBoxY + 56,
      6,
      2,
    )

    // 5. Configurar as 12 Derivações Clássicas em 4 colunas x 3 linhas + DII longo na base
    // Grade:
    // Linha 1 (y: 220): DI,   aVR, V1, V4
    // Linha 2 (y: 540): DII,  aVL, V2, V5
    // Linha 3 (y: 860): DIII, aVF, V3, V6
    // Linha 4 (y: 1220): DII Longo (extensão total)
    const columns = [
      { xStart: 40, width: 550 },
      { xStart: 620, width: 550 },
      { xStart: 1200, width: 550 },
      { xStart: 1780, width: 570 },
    ]

    const leads = [
      // Linha 1
      { name: 'DI', col: 0, baseY: 320, pAmp: 12, qrsAmp: 70, tAmp: 24, invQrs: false },
      { name: 'aVR', col: 1, baseY: 320, pAmp: -10, qrsAmp: -65, tAmp: -20, invQrs: true },
      { name: 'V1', col: 2, baseY: 320, pAmp: 8, qrsAmp: -50, tAmp: -15, invQrs: true, isV1: true },
      { name: 'V4', col: 3, baseY: 320, pAmp: 14, qrsAmp: 95, tAmp: 30, invQrs: false },

      // Linha 2
      { name: 'DII', col: 0, baseY: 640, pAmp: 16, qrsAmp: 85, tAmp: 28, invQrs: false },
      { name: 'aVL', col: 1, baseY: 640, pAmp: 8, qrsAmp: 45, tAmp: 16, invQrs: false },
      {
        name: 'V2',
        col: 2,
        baseY: 640,
        pAmp: 10,
        qrsAmp: -30,
        tAmp: 25,
        invQrs: false,
        isV2: true,
      },
      { name: 'V5', col: 3, baseY: 640, pAmp: 14, qrsAmp: 90, tAmp: 26, invQrs: false },

      // Linha 3
      { name: 'DIII', col: 0, baseY: 960, pAmp: 10, qrsAmp: 55, tAmp: 18, invQrs: false },
      { name: 'aVF', col: 1, baseY: 960, pAmp: 14, qrsAmp: 75, tAmp: 25, invQrs: false },
      { name: 'V3', col: 2, baseY: 960, pAmp: 12, qrsAmp: 60, tAmp: 28, invQrs: false },
      { name: 'V6', col: 3, baseY: 960, pAmp: 12, qrsAmp: 80, tAmp: 22, invQrs: false },
    ]

    // Função geradora de traçado ECG procedural plausível (P - Q - R - S - T)
    function generateEcgTrace(lead, xMin, xMax, baseY) {
      const cycleLength = 160 // ~75 bpm
      let lastX = xMin
      let lastY = baseY

      // Pulo de calibração retangular inicial (1 mV = 10 mm = 80 px)
      const calibStart = xMin + 15
      const calibW = 35
      const calibH = 80
      drawLine(xMin, baseY, calibStart, baseY, 3, 1)
      drawLine(calibStart, baseY, calibStart, baseY - calibH, 3, 1)
      drawLine(calibStart, baseY - calibH, calibStart + calibW, baseY - calibH, 3, 1)
      drawLine(calibStart + calibW, baseY - calibH, calibStart + calibW, baseY, 3, 1)
      drawLine(calibStart + calibW, baseY, calibStart + calibW + 15, baseY, 3, 1)
      lastX = calibStart + calibW + 15

      // Rótulo da derivação
      drawText(lead.name, xMin + 20, baseY - 90, 4, 3)

      for (let x = lastX; x < xMax; x++) {
        const t = (x - lastX) % cycleLength
        let y = baseY

        // Onda P (t: 20..45)
        if (t >= 20 && t <= 45) {
          const progress = (t - 20) / 25
          y -= Math.sin(progress * Math.PI) * lead.pAmp
        }
        // Segmento PR (t: 45..60) plano
        // Complexo QRS (t: 60..85)
        else if (t >= 60 && t < 65) {
          // Onda Q
          const qProgress = (t - 60) / 5
          y += lead.invQrs
            ? -Math.sin(qProgress * Math.PI) * 10
            : Math.sin(qProgress * Math.PI) * 12
        } else if (t >= 65 && t < 75) {
          // Onda R (pico alto)
          const rProgress = (t - 65) / 10
          y -= Math.sin(rProgress * Math.PI) * lead.qrsAmp
        } else if (t >= 75 && t < 85) {
          // Onda S
          const sProgress = (t - 75) / 10
          y += lead.invQrs
            ? -Math.sin(sProgress * Math.PI) * 25
            : Math.sin(sProgress * Math.PI) * 22
        }
        // Segmento ST (t: 85..105)
        // Onda T (t: 105..145)
        else if (t >= 105 && t <= 145) {
          const tProgress = (t - 105) / 40
          y -= Math.sin(tProgress * Math.PI) * lead.tAmp
        }

        drawLine(x - 1, lastY, x, y, 3, 1)
        lastY = y
      }
    }

    // Desenhar as 12 derivações
    for (const lead of leads) {
      const col = columns[lead.col]
      generateEcgTrace(lead, col.xStart, col.xStart + col.width, lead.baseY)
    }

    // Desenhar Linha de Ritmo Contínua: DII Longo na base (y: 1350)
    const rhythmY = 1380
    drawText('DII LONGO (RITMO CONTINUO)', 40, rhythmY - 90, 4, 3)
    const leadD2Longo = {
      name: 'DII_LONGO',
      baseY: rhythmY,
      pAmp: 16,
      qrsAmp: 85,
      tAmp: 28,
      invQrs: false,
    }
    generateEcgTrace(leadD2Longo, 40, WIDTH - 40, rhythmY)

    // Rodapé de Calibração Técnica SBC
    drawText(
      'VELOCIDADE: 25 mm/s    SENSIBILIDADE: 10 mm/mV    FILTROS: 0.05 - 150 Hz (60 Hz NOTCH)',
      40,
      1540,
      4,
      2,
    )
    drawText(
      'CARDIOLAB TELEMEDICINA - CENTRAL DE LAUDOS - ARQUIVO MASTER DEMONSTRACAO',
      1400,
      1540,
      4,
      2,
    )

    // 6. Codificar pixels como arquivo PNG válido (Color Type 3 = Indexed, 8-bit depth)
    // Tabela CRC32 pré-calculada para os chunks PNG
    const CRC_TABLE = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let j = 0; j < 8; j++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      }
      CRC_TABLE[i] = c
    }

    function crc32(buf, offset, length) {
      let c = 0xffffffff
      for (let i = offset; i < offset + length; i++) {
        c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
      }
      return (c ^ 0xffffffff) >>> 0
    }

    function adler32(buf, offset, length) {
      let s1 = 1
      let s2 = 0
      const MOD = 65521
      for (let i = offset; i < offset + length; i++) {
        s1 = (s1 + buf[i]) % MOD
        s2 = (s2 + s1) % MOD
      }
      return ((s2 << 16) | s1) >>> 0
    }

    // Gerar stream de scanlines uncompressed: cada linha começa com filter byte 0 (None)
    // Tamanho dos dados raw = HEIGHT * (WIDTH + 1) = 1600 * 2401 = 3.841.600 bytes
    const rawScanlineLen = HEIGHT * (WIDTH + 1)
    const rawData = new Uint8Array(rawScanlineLen)
    let rawIdx = 0
    for (let y = 0; y < HEIGHT; y++) {
      rawData[rawIdx++] = 0 // Filter type 0 (None)
      const rowOffset = y * WIDTH
      for (let x = 0; x < WIDTH; x++) {
        rawData[rawIdx++] = pixels[rowOffset + x]
      }
    }

    // Dividir em blocos DEFLATE não compactados (BTYPE=00)
    // Cada bloco tem no máximo 65535 bytes
    const BLOCK_SIZE = 65535
    const numBlocks = Math.ceil(rawScanlineLen / BLOCK_SIZE)
    // Tamanho do ZLIB stream: 2 bytes header + (numBlocks * 5) + rawScanlineLen + 4 bytes adler32
    const zlibStreamLen = 2 + numBlocks * 5 + rawScanlineLen + 4
    const zlibStream = new Uint8Array(zlibStreamLen)

    // ZLIB Header (Deflate, 32K window, check bits)
    zlibStream[0] = 0x78
    zlibStream[1] = 0x01 // 0x7801 % 31 == 0

    let zPos = 2
    for (let b = 0; b < numBlocks; b++) {
      const start = b * BLOCK_SIZE
      const end = Math.min(start + BLOCK_SIZE, rawScanlineLen)
      const bLen = end - start
      const isLast = b === numBlocks - 1 ? 1 : 0

      zlibStream[zPos++] = isLast ? 0x01 : 0x00
      zlibStream[zPos++] = bLen & 0xff
      zlibStream[zPos++] = (bLen >> 8) & 0xff
      const nlen = ~bLen & 0xffff
      zlibStream[zPos++] = nlen & 0xff
      zlibStream[zPos++] = (nlen >> 8) & 0xff

      zlibStream.set(rawData.subarray(start, end), zPos)
      zPos += bLen
    }

    // Adler32 do rawData
    const adler = adler32(rawData, 0, rawScanlineLen)
    zlibStream[zPos++] = (adler >> 24) & 0xff
    zlibStream[zPos++] = (adler >> 16) & 0xff
    zlibStream[zPos++] = (adler >> 8) & 0xff
    zlibStream[zPos++] = adler & 0xff

    // Montar arquivo PNG completo com chunks: IHDR, PLTE, IDAT, IEND
    function makeChunk(typeStr, data) {
      const len = data.length
      const chunk = new Uint8Array(4 + 4 + len + 4)
      chunk[0] = (len >> 24) & 0xff
      chunk[1] = (len >> 16) & 0xff
      chunk[2] = (len >> 8) & 0xff
      chunk[3] = len & 0xff
      for (let i = 0; i < 4; i++) {
        chunk[4 + i] = typeStr.charCodeAt(i)
      }
      chunk.set(data, 8)
      // CRC calculado sobre type + data
      const crcVal = crc32(chunk, 4, 4 + len)
      const crcOffset = 8 + len
      chunk[crcOffset] = (crcVal >> 24) & 0xff
      chunk[crcOffset + 1] = (crcVal >> 16) & 0xff
      chunk[crcOffset + 2] = (crcVal >> 8) & 0xff
      chunk[crcOffset + 3] = crcVal & 0xff
      return chunk
    }

    // 1. IHDR Chunk (13 bytes)
    const ihdrData = new Uint8Array(13)
    ihdrData[0] = (WIDTH >> 24) & 0xff
    ihdrData[1] = (WIDTH >> 16) & 0xff
    ihdrData[2] = (WIDTH >> 8) & 0xff
    ihdrData[3] = WIDTH & 0xff
    ihdrData[4] = (HEIGHT >> 24) & 0xff
    ihdrData[5] = (HEIGHT >> 16) & 0xff
    ihdrData[6] = (HEIGHT >> 8) & 0xff
    ihdrData[7] = HEIGHT & 0xff
    ihdrData[8] = 8 // bit depth = 8
    ihdrData[9] = 3 // color type = 3 (Indexed-color)
    ihdrData[10] = 0 // compression = deflate
    ihdrData[11] = 0 // filter = 0
    ihdrData[12] = 0 // interlace = none
    const ihdrChunk = makeChunk('IHDR', ihdrData)

    // 2. PLTE Chunk (8 cores * 3 = 24 bytes)
    const plteData = new Uint8Array(PALETTE.length * 3)
    for (let i = 0; i < PALETTE.length; i++) {
      plteData[i * 3] = PALETTE[i][0]
      plteData[i * 3 + 1] = PALETTE[i][1]
      plteData[i * 3 + 2] = PALETTE[i][2]
    }
    const plteChunk = makeChunk('PLTE', plteData)

    // 3. IDAT Chunk
    const idatChunk = makeChunk('IDAT', zlibStream)

    // 4. IEND Chunk
    const iendChunk = makeChunk('IEND', new Uint8Array(0))

    // PNG Signature: 8 bytes
    const pngSignature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

    const totalPngSize =
      pngSignature.length +
      ihdrChunk.length +
      plteChunk.length +
      idatChunk.length +
      iendChunk.length

    const pngFileBytes = new Uint8Array(totalPngSize)
    let pOffset = 0
    pngFileBytes.set(pngSignature, pOffset)
    pOffset += pngSignature.length
    pngFileBytes.set(ihdrChunk, pOffset)
    pOffset += ihdrChunk.length
    pngFileBytes.set(plteChunk, pOffset)
    pOffset += plteChunk.length
    pngFileBytes.set(idatChunk, pOffset)
    pOffset += idatChunk.length
    pngFileBytes.set(iendChunk, pOffset)

    console.log('PNG HD sintético gerado com sucesso. Tamanho:', pngFileBytes.length, 'bytes.')

    // 7. Criar o objeto de arquivo do PocketBase e novo registro em exam_requests
    const fileName = 'ecg_demonstracao_hd_2400x1600.png'
    let fileObj = null

    if (typeof $filesystem !== 'undefined' && typeof $filesystem.fileFromBytes === 'function') {
      fileObj = $filesystem.fileFromBytes(pngFileBytes, fileName)
    } else {
      console.log('Aviso: $filesystem.fileFromBytes indisponível no contexto global migration.')
    }

    // Obter referências necessárias (organização cliente, paciente, operador e médico)
    const examsCol = app.findCollectionByNameOrId('exam_requests')

    let orgClient = null
    try {
      orgClient = app.findFirstRecordByData('organizations', 'cnpj', '22.222.222/0001-22')
    } catch (_) {
      try {
        const clientOrgs = app.findRecordsByFilter('organizations', "type = 'client'", '', 1, 0)
        if (clientOrgs.length > 0) orgClient = clientOrgs[0]
      } catch (_) {}
    }

    let unitRecord = null
    if (orgClient) {
      try {
        const units = app.findRecordsByFilter(
          'units',
          `organization_id = '${orgClient.id}'`,
          '',
          1,
          0,
        )
        if (units.length > 0) unitRecord = units[0]
      } catch (_) {}
    }

    let patientRecord = null
    try {
      patientRecord = app.findFirstRecordByData('patients', 'cpf', '111.222.333-44')
    } catch (_) {
      try {
        const pts = app.findRecordsByFilter('patients', '', '', 1, 0)
        if (pts.length > 0) patientRecord = pts[0]
      } catch (_) {}
    }

    let requestedByUser = null
    try {
      requestedByUser = app.findAuthRecordByEmail(
        '_pb_users_auth_',
        'operador.alfa@cardioalfa.fake',
      )
    } catch (_) {
      try {
        requestedByUser = app.findAuthRecordByEmail(
          '_pb_users_auth_',
          'marcio.eliziario@hotmail.com',
        )
      } catch (_) {}
    }

    let doctorMarcio = null
    try {
      const docs = app.findRecordsByFilter('doctors', 'crm = "145892"', '', 1, 0)
      if (docs.length > 0) doctorMarcio = docs[0]
    } catch (_) {}

    if (!orgClient || !patientRecord || !requestedByUser) {
      throw new Error(
        'Entidades mínimas (organização, paciente, usuário) não encontradas para semear exame demo.',
      )
    }

    const examRecord = new Record(examsCol)
    examRecord.set('organization_id', orgClient.id)
    if (unitRecord) examRecord.set('unit_id', unitRecord.id)
    examRecord.set('patient_id', patientRecord.id)
    examRecord.set('requested_by', requestedByUser.id)
    if (doctorMarcio) {
      examRecord.set('assigned_doctor_id', doctorMarcio.id)
      examRecord.set('assigned_at', new Date().toISOString())
      examRecord.set('status', 'in_analysis')
    } else {
      examRecord.set('status', 'pending')
    }
    examRecord.set('urgency', 'routine')
    examRecord.set(
      'clinical_indication',
      'ECG DE DEMONSTRAÇÃO HD — NÃO USAR PARA CONDUTA CLÍNICA (Calibração do Visualizador de ECG v0.0.33)',
    )
    examRecord.set(
      'symptoms',
      'Traçado sintético de alta resolução (2400x1600) para homologação visual.',
    )
    examRecord.set('medications_in_use', 'Nenhuma medicação (Registro de Demonstração)')
    examRecord.set('has_pacemaker', false)
    examRecord.set('exam_date', new Date().toISOString())
    examRecord.set('priority_score', 20)
    examRecord.set('sla_status', 'no_prazo')

    // Anexar arquivo PNG gerado no PocketBase storage
    if (fileObj) {
      examRecord.set('exam_file', fileObj)
    }

    app.save(examRecord)

    // Se o storage não gravou exam_file via fileObj em migration, salvar fisicamente via filesystem e atualizar nome
    let savedFileName = examRecord.getString('exam_file')
    if (!savedFileName) {
      try {
        const fs = app.newFilesystem()
        try {
          const generatedDiskName = `${examRecord.id}_${fileName}`
          const storageKey = examRecord.baseFilesPath() + '/' + generatedDiskName
          fs.upload(pngFileBytes, storageKey)
          app
            .db()
            .newQuery('UPDATE exam_requests SET exam_file = {:f} WHERE id = {:id}')
            .bind({ f: generatedDiskName, id: examRecord.id })
            .execute()
          console.log('Arquivo gravado diretamente no storage:', storageKey)
        } finally {
          if (fs && typeof fs.close === 'function') fs.close()
        }
      } catch (fsErr) {
        console.log('Erro ao fazer fallback de upload no storage:', fsErr)
      }
    }

    console.log(
      'Exame de demonstração salvo com sucesso. ID:',
      examRecord.id,
      'Arquivo:',
      examRecord.getString('exam_file'),
    )
  },
  (app) => {
    try {
      const records = app.findRecordsByFilter(
        'exam_requests',
        "clinical_indication ~ 'ECG DE DEMONSTRAÇÃO'",
        '',
        10,
        0,
      )
      for (const rec of records) {
        app.delete(rec)
      }
    } catch (_) {}
  },
)
