module.exports = {
  packagerConfig: {
    asar: true,
    executableName: 'DAIC',
    ignore: [/^\/(source|img|Tasks|tests|scripts|src|\.local|\.test-build)(\/|$)/, /^\/tsconfig/, /^\/README\.md$/],
  },
  makers: [{ name: '@electron-forge/maker-squirrel', config: { name: 'DAIC' }, platforms: ['win32'] }],
};
