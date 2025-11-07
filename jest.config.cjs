/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  moduleNameMapper: {
    '^https://esm.sh/@supabase/supabase-js@2\\.45\\.3$': '<rootDir>/supabase/functions/manipulate_stock/__tests__/supabaseClientMock.ts',
  },
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.jest.json',
      diagnostics: {
        warnOnly: true,
      },
    },
  },
};
