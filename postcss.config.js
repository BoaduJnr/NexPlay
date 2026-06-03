module.exports = {
  plugins: [
    require('postcss-custom-properties')({ preserve: false }),
    require('autoprefixer')({ overrideBrowserslist: ['chrome >= 38'] }),
  ]
};
