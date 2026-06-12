module.exports = {
  plugins: [
    require('postcss-custom-properties')({ preserve: false }),
    require('autoprefixer')({ overrideBrowserslist: ['chrome >= 38'] }),
    require('cssnano')({
      preset: ['default', {
        discardComments:    { removeAll: true },
        normalizeWhitespace: true,
        minifyFontValues:   true,
        colormin:           true,
        reduceIdents:       false, // keep named animations — referenced by JS
        mergeRules:         true,
      }]
    }),
  ]
};
