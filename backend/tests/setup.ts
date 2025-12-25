// Test setup file
// Runs before all tests

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.DB_NAME = 'twitter_clone_test';

// Note: Console mocking removed to avoid TypeScript errors
// Tests will have normal console output
