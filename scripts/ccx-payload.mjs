// Inspect in memory on either platform. Never extract downloaded paths to disk.
import yauzl from 'yauzl';

const MAX_ENTRY_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 16 * 1024 * 1024;
export async function readCcxPayload(bytes, allowed) {
  let zip;
  try {
    zip = await yauzl.fromBufferPromise(bytes, {
      lazyEntries: true, strictFileNames: true, validateEntrySizes: true,
    });
  } catch { throw new Error('CCX archive is invalid.'); }
  const files = new Map();
  let total = 0;
  try {
    if (zip.entryCount !== allowed.length)
      throw new Error('CCX contains unexpected or duplicate entries.');
    await new Promise((resolve, reject) => {
      zip.on('error', reject);
      zip.on('end', resolve);
      zip.on('entry', entry => {
        void (async () => {
          const type = (entry.externalFileAttributes >>> 16) & 0o170000;
          if (!allowed.includes(entry.fileName) || files.has(entry.fileName) ||
              (entry.generalPurposeBitFlag & 1) || (entry.externalFileAttributes & 0x10) ||
              (type !== 0 && type !== 0o100000))
            throw new Error('CCX contains unexpected, duplicate, encrypted or linked entries.');
          if (entry.uncompressedSize > MAX_ENTRY_BYTES ||
              total + entry.uncompressedSize > MAX_TOTAL_BYTES)
            throw new Error('CCX expanded payload exceeds the size limit.');
          const local = await zip.readLocalFileHeaderPromise(entry);
          if (local.fileName.toString('utf8') !== entry.fileName ||
              local.compressionMethod !== entry.compressionMethod ||
              local.generalPurposeBitFlag !== entry.generalPurposeBitFlag)
            throw new Error('CCX local and central headers disagree.');
          const stream = await zip.openReadStreamPromise(entry);
          const chunks = [];
          let length = 0;
          for await (const chunk of stream) {
            length += chunk.length;
            if (length > entry.uncompressedSize || length > MAX_ENTRY_BYTES)
              throw new Error('CCX expanded payload exceeds the size limit.');
            chunks.push(chunk);
          }
          if (length !== entry.uncompressedSize) throw new Error('CCX entry size mismatch.');
          total += length;
          files.set(entry.fileName, Buffer.concat(chunks));
          zip.readEntry();
        })().catch(reject);
      });
      zip.readEntry();
    });
    if (files.size !== allowed.length) throw new Error('CCX payload is incomplete.');
    return files;
  } catch (error) {
    if (error.message?.startsWith('CCX ')) throw error;
    throw new Error('CCX archive is invalid.');
  } finally { zip.close(); }
}
