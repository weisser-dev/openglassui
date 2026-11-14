const signed = process.env.OPENGLASS_SIGNED_BUILD === '1';

module.exports = {
  appId: 'si.openagentix.openglassui',
  productName: 'OpenGlassUI',
  extraMetadata: { main: 'desktop/main.cjs', desktopSigned: signed },
  directories: { output: 'dist' },
  files: [
    '*.js', '!hello-world.js', 'config.example.json', 'LICENSE', 'desktop/*.cjs',
    'desktop/icon.png', 'public/**/*', 'public/.well-known/**/*', 'bin/claude-desktop-send.swift'
  ],
  // Agent SDK subprocesses may execute bundled binaries or read real filesystem paths.
  asarUnpack: ['*.js', 'package.json', 'config.example.json', 'public/**/*', 'public/.well-known/**/*', 'node_modules/**/*', 'bin/claude-desktop-send.swift'],
  icon: 'desktop/icon.png',
  electronFuses: {
    runAsNode: false, enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false, onlyLoadAppFromAsar: true
  },
  publish: { provider: 'github', owner: 'weisser-dev', repo: 'openglassui' },
  artifactName: 'OpenGlassUI-${version}-${os}-${arch}.${ext}',
  mac: {
    target: [{ target: 'dmg', arch: ['arm64', 'x64'] }, { target: 'zip', arch: ['arm64', 'x64'] }],
    category: 'public.app-category.developer-tools',
    identity: signed ? undefined : '-',
    hardenedRuntime: signed,
    forceCodeSigning: signed,
    notarize: signed
  },
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    signExecutable: signed,
    forceCodeSigning: signed
  },
  nsis: { oneClick: true, perMachine: false, deleteAppDataOnUninstall: false }
};
