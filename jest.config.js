import { defaults } from 'jest-config';

export const roots = ['<rootDir>'];
export const transform = {
    "^.+\\.jsx?$": "babel-jest",
    '^.+\\.tsx?$': 'ts-jest',
    "^.+\\.html?$": "html-loader-jest"
};
export const testRegex = '(./tests/).*_test.[jt]sx?$';
export const moduleFileExtensions = [...defaults.moduleFileExtensions, 'ts', 'tsx'];
export const verbose = true;
export const automock = false;
export const preset = 'ts-jest';
export const setupFiles = ["./tests/setupJest.js", "jest-webextension-mock"];
