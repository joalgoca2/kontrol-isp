/**
 * RouterOS API binary protocol length encoder / decoder.
 * Supports MikroTik RouterOS protocol specification (ports 8728 / 8729).
 */

export function encodeLength(len: number): Buffer {
  if (len < 0x80) {
    return Buffer.from([len]);
  } else if (len < 0x4000) {
    const val = len | 0x8000;
    return Buffer.from([(val >> 8) & 0xff, val & 0xff]);
  } else if (len < 0x200000) {
    const val = len | 0xc00000;
    return Buffer.from([(val >> 16) & 0xff, (val >> 8) & 0xff, val & 0xff]);
  } else if (len < 0x10000000) {
    const val = len | 0xe0000000;
    return Buffer.from([
      (val >> 24) & 0xff,
      (val >> 16) & 0xff,
      (val >> 8) & 0xff,
      val & 0xff,
    ]);
  } else {
    return Buffer.from([
      0xf0,
      (len >> 24) & 0xff,
      (len >> 16) & 0xff,
      (len >> 8) & 0xff,
      len & 0xff,
    ]);
  }
}

export function encodeSentence(words: string[]): Buffer {
  const buffers: Buffer[] = [];
  for (const word of words) {
    const wordBuf = Buffer.from(word, "utf-8");
    buffers.push(encodeLength(wordBuf.length));
    buffers.push(wordBuf);
  }
  // End of sentence is marked by length 0
  buffers.push(Buffer.from([0x00]));
  return Buffer.concat(buffers);
}

export interface ParseResult {
  sentences: Array<Record<string, string>>;
  done: boolean;
  trap: boolean;
  errorMessage?: string;
}

export function parseRawSentences(rawBuffers: Buffer[]): ParseResult {
  const fullBuffer = Buffer.concat(rawBuffers);
  let offset = 0;
  const sentences: Array<Record<string, string>> = [];
  let currentSentence: Record<string, string> = {};
  let isDone = false;
  let isTrap = false;
  let errorMessage: string | undefined;

  while (offset < fullBuffer.length) {
    if (offset >= fullBuffer.length) break;
    const firstByte = fullBuffer[offset];

    if (firstByte === 0x00) {
      // End of sentence
      offset += 1;
      if (Object.keys(currentSentence).length > 0) {
        sentences.push(currentSentence);
        currentSentence = {};
      }
      continue;
    }

    // Decode length
    let len = 0;
    let lenBytes = 0;

    if ((firstByte & 0x80) === 0x00) {
      len = firstByte;
      lenBytes = 1;
    } else if ((firstByte & 0xc0) === 0x80) {
      if (offset + 1 >= fullBuffer.length) break;
      len = ((firstByte & 0x3f) << 8) | fullBuffer[offset + 1];
      lenBytes = 2;
    } else if ((firstByte & 0xe0) === 0xc0) {
      if (offset + 2 >= fullBuffer.length) break;
      len =
        ((firstByte & 0x1f) << 16) |
        (fullBuffer[offset + 1] << 8) |
        fullBuffer[offset + 2];
      lenBytes = 3;
    } else if ((firstByte & 0xf0) === 0xe0) {
      if (offset + 3 >= fullBuffer.length) break;
      len =
        ((firstByte & 0x0f) << 24) |
        (fullBuffer[offset + 1] << 16) |
        (fullBuffer[offset + 2] << 8) |
        fullBuffer[offset + 3];
      lenBytes = 4;
    } else {
      if (offset + 4 >= fullBuffer.length) break;
      len =
        (fullBuffer[offset + 1] << 24) |
        (fullBuffer[offset + 2] << 16) |
        (fullBuffer[offset + 3] << 8) |
        fullBuffer[offset + 4];
      lenBytes = 5;
    }

    offset += lenBytes;
    if (offset + len > fullBuffer.length) {
      // Incomplete packet in buffer
      break;
    }

    const word = fullBuffer.toString("utf-8", offset, offset + len);
    offset += len;

    if (word === "!done") {
      isDone = true;
    } else if (word === "!trap") {
      isTrap = true;
    } else if (word.startsWith("=message=")) {
      errorMessage = word.slice(9);
    } else if (word.startsWith("=")) {
      const eqIdx = word.indexOf("=", 1);
      if (eqIdx !== -1) {
        const key = word.slice(1, eqIdx);
        const val = word.slice(eqIdx + 1);
        currentSentence[key] = val;
      }
    }
  }

  return {
    sentences,
    done: isDone,
    trap: isTrap,
    errorMessage,
  };
}
