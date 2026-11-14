import { existsSync } from 'node:fs';
import { join, delimiter } from 'node:path';

// Node cannot start npm's Windows .cmd shim without a shell. Resolve the
// native binary shipped by the corresponding npm package instead.
export function resolveCodexExecutable(command = 'codex') {
  if (process.platform !== 'win32' || command !== 'codex') return command;
  const arch = process.arch;
  const target = { x64: 'x86_64', arm64: 'aarch64' }[arch];
  if (!target) return command;

  const dirs = (process.env.PATH || '').split(delimiter).filter(Boolean);
  for (const directory of dirs) {
    const executable = join(directory, 'codex.exe');
    if (existsSync(executable)) return executable;

    const npmPackage = join(directory, 'node_modules', '@openai', 'codex');
    if (!existsSync(join(npmPackage, 'package.json'))) continue;
    const vendorPath = join('vendor', `${target}-pc-windows-msvc`, 'bin', 'codex.exe');
    const packages = [
      join(npmPackage, 'node_modules', '@openai', `codex-win32-${arch}`),
      join(directory, 'node_modules', '@openai', `codex-win32-${arch}`),
      npmPackage
    ];
    for (const root of packages) {
      const nativeCodex = join(root, vendorPath);
      if (existsSync(nativeCodex)) return nativeCodex;
    }
  }
  return command;
}
