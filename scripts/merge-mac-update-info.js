import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import yaml from 'js-yaml';

const [armDirectory, intelDirectory, destination] = process.argv.slice(2);
const inputs = await Promise.all([armDirectory, intelDirectory].map(directory =>
  readFile(join(directory, 'latest-mac.yml'), 'utf8').then(yaml.load)));
const [arm, intel] = inputs;
if (arm.version !== intel.version ||
    !arm.files.some(item => item.url.endsWith('-arm64.zip')) ||
    !intel.files.some(item => item.url.endsWith('-x64.zip'))) {
  throw new Error('Expected matching Apple Silicon and Intel update archives.');
}
await writeFile(join(destination, 'latest-mac.yml'), yaml.dump({
  ...intel, files: [...intel.files, ...arm.files]
}));
