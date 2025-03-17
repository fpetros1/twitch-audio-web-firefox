import { resolve as _resolve } from 'path';
import { merge } from 'webpack-merge';
import CopyPlugin from "copy-webpack-plugin";

import { entry, output, resolve, module } from './webpack.common.js';

export default merge({ entry, output, resolve, module }, {
  mode: 'production',
  output: {
    filename: 'dist/[name].js',
    path: _resolve(import.meta.dirname, 'release'),
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "manifest.json", to: "manifest.json" },
        { from: "_locales", to: "_locales" },
        { from: ".webstore", to: ".webstore" },
        { from: "css", to: "css" },
        { from: "icons", to: "icons" },
        { from: "popup", to: "popup" },
      ],
    }),
  ],
});
