import { resolve as _resolve } from 'path';
import { merge } from 'webpack-merge';
import { entry, output, resolve, module } from './webpack.common.js';
import CopyPlugin from "copy-webpack-plugin";
import { CleanWebpackPlugin } from "clean-webpack-plugin";

export default merge({ entry, output, resolve, module }, {
    mode: 'development',
    devtool: 'inline-source-map',
    optimization: {
        minimize: false,
    },
    output: {
        filename: 'dist/[name].js',
        path: _resolve(import.meta.dirname, 'dev-firefox'),
    },
    plugins: [
        new CleanWebpackPlugin(),
        new CopyPlugin({
            patterns: [
                { from: "manifest.firefox.json", to: "manifest.json" },
                { from: "_locales", to: "_locales" },
                { from: ".webstore", to: ".webstore" },
                { from: "css", to: "css" },
                { from: "icons", to: "icons" },
                { from: "popup", to: "popup" },
            ],
        }),
    ],
});
