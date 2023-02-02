/*
 *  Copyright 2022 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

module.exports = {
  // Project name
  displayName: '@openmetadata',

  globals: {
    // TypeScript
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },

  // Working directory
  roots: ['<rootDir>/src'],

  // Test files
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx,js,jsx}'], // All test files in subdirectories under /src

  // Test coverage
  coverageDirectory: '<rootDir>/src/test/unit/coverage',
  collectCoverageFrom: [
    '<rootDir>/src/**/*.{ts,tsx,js,jsx}', // All files in subdirectories under src/app
    '!<rootDir>/src/*', // Exclude files directly under src/app
  ],
  coveragePathIgnorePatterns: [
    '<rootDir>/src/@types/*',
    '<rootDir>/src/interface/*',
    '<rootDir>/src/generated/*',
    '<rootDir>/src/enums/*',
  ],

  // Transforms
  transform: {
    '^.+\\.ts|tsx?$': 'ts-jest',
    '^.+\\.js|jsx?$': '<rootDir>/node_modules/babel-jest',
  },
  // "scriptPreprocessor": "<rootDir>/node_modules/babel-jest",
  // "moduleFileExtensions": ["js", "json","jsx" ],

  setupFilesAfterEnv: ['./src/setupTests.js'],
  clearMocks: true,
  moduleNameMapper: {
    '\\.svg': '<rootDir>/src/test/unit/mocks/svg.mock.js', // Mock SVG imports
    '\\.(scss)$': 'identity-obj-proxy', // Mock style imports
    '\\.(jpg|JPG|gif|GIF|png|PNG|less|LESS|css|CSS)$':
      '<rootDir>/src/test/unit/mocks/file.mock.js',
    '\\.json': '<rootDir>/src/test/unit/mocks/json.mock.js',
    '@fortawesome/react-fontawesome':
      '<rootDir>/src/test/unit/mocks/fontawesome.mock.js',
    '@github/g-emoji-element': '<rootDir>/src/test/unit/mocks/gemoji.mock.js',
  },

  // TypeScript
  preset: 'ts-jest',

  // Test Environment
  testEnvironment: 'jsdom',

  // Sonar Cloud Configuration
  testResultsProcessor: 'jest-sonar-reporter',

  // use fake timers
  timers: 'fake',

  moduleDirectories: ['node_modules', 'src'],
};
