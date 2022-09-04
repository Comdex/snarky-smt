/** @type {import('@ts-jest/dist/types').InitialOptionsTsJest} */
export default {
  verbose: true,
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
  transform: {
    '^.+\\.(t)s$': 'ts-jest',
    '^.+\\.(j)s$': 'babel-jest',
  },
  resolver: '<rootDir>/jest-resolver.cjs',
  testPathIgnorePatterns: ['node_modules', 'mongo_store'],
  transformIgnorePatterns: [
    '<rootDir>/node_modules/(?!snarkyjs/node_modules/tslib)',
    '<rootDir>/node_modules/mongodb',
    // '<rootDir>/node_modules/bson',
    '<rootDir>/node_modules/mongoose',
   // '<rootDir>/node_modules/sift',
  ],
};