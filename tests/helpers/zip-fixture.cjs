const {ZipFile} = require('yazl');
const {once} = require('node:events');

async function zipBuffer(entries) {
  const zip = new ZipFile(), chunks = [];
  zip.outputStream.on('data', chunk => chunks.push(chunk));
  const end = once(zip.outputStream, 'end');
  for (const {name, bytes, mode} of entries) zip.addBuffer(bytes, name, mode === undefined ? {} : {mode});
  zip.end();
  await end;
  return Buffer.concat(chunks);
}
module.exports = {zipBuffer};
