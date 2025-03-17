import { resolve as _resolve } from 'path';

export const entry = {
    'background': './src/background.ts',
    'contentscript': './src/contentscript.ts'
};
export const output = {
    filename: '[name].js',
    path: _resolve(import.meta.dirname, 'dist'),
};
export const resolve = {
    extensions: ['.tsx', '.ts', '.js'],
};

export const module = {
    rules: [
        {
            test: /\.css$/,
            use: [
                'style-loader',
                'css-loader',
            ]
        },
        {
            test: /\.(png|svg|jpg|gif)/,
            use: 'file-loader'
        },
        {
            test: /\.tsx?$/,
            use: 'ts-loader',
            exclude: /node_modules/,
        }
    ]
};

