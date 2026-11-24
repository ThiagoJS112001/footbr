module.exports = {
  packagerConfig: {
    asar: true,
    ignore: /^\/(?!desktop(?:\/|$)|dist(?:\/|$)|node_modules(?:\/|$)|package\.json$)|^\/desktop\/backend\.ts$/,
  },
  makers: [{
    name: '@electron-forge/maker-squirrel',
    config: {
      authors: 'FootBR',
      description: 'Jogo de gerenciamento de futebol',
      setupExe: 'FootBR-Setup.exe',
    },
  }],
};
