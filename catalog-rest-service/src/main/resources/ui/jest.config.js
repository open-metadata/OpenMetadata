module.exports = {
  // Project name
  displayName: '@collate/openmetadata',

  // Working directory
  roots: ['<rootDir>/src'],

  // Test files
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx,js,jsx}'], // All test files in subdirectories under /src

  // // Test coverage
  // coverageDirectory: "<rootDir>/src/test/unit/coverage",
  // collectCoverageFrom: [
  //     "<rootDir>/src/**/*.{ts,tsx,js,jsx}", // All files in subdirectories under src/app
  //     "!<rootDir>/src/*", // Exclude files directly under src/app
  // ],

  // TypeScript
  // preset: 'ts-jest',

  // Transforms
  transform: {
    '^.+\\.ts|tsx?$': 'ts-jest',
    '^.+\\.js|jsx?$': '<rootDir>/node_modules/babel-jest',
  },

  // "scriptPreprocessor": "<rootDir>/node_modules/babel-jest",
  // "moduleFileExtensions": ["js", "json","jsx" ],

  // Test Environment
  testEnvironment: 'jest-environment-jsdom-fourteen',
  setupFilesAfterEnv: ['@testing-library/jest-dom/extend-expect'],
  clearMocks: true,
  moduleNameMapper: {
    '\\.svg': '<rootDir>/src/test/unit/mocks/svg.mock.js', // Mock SVG imports
    '\\.(scss)$': 'identity-obj-proxy', // Mock style imports
    '\\.(jpg|JPG|gif|GIF|png|PNG|less|LESS|css|CSS)$':
      '<rootDir>/src/test/unit/mocks/file.mock.js',
  },
};
