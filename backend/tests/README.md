# Backend Test Suite Documentation

## Overview

This test suite provides comprehensive coverage of the authentication system, including unit tests, integration tests, and security tests.

## Test Structure

```
tests/
├── unit/               # Unit tests for individual functions
│   └── auth.utils.test.ts
├── integration/        # Integration tests for API endpoints
│   └── auth.endpoints.test.ts
├── security/          # Security and penetration tests
│   └── security.test.ts
└── setup.ts           # Test configuration
```

## Running Tests

```bash
# Run all tests with coverage
npm test

# Run tests in watch mode
npm run test:watch

# Run only security tests
npm run test:security
```

## Test Coverage

### Unit Tests (auth.utils.test.ts)
- **Password Hashing** (6 tests)
  - Hash generation
  - Hash uniqueness
  - Password comparison
  - Edge cases

- **JWT Token Generation** (6 tests)
  - Token creation
  - Token verification
  - Invalid token rejection
  - Token tampering detection
  - Refresh token generation

- **Password Validation** (7 tests)
  - Uppercase requirement
  - Lowercase requirement
  - Number requirement
  - Length requirement
  - Special characters allowed

- **Username Validation** (8 tests)
  - Valid formats
  - Length constraints
  - Character restrictions
  - Starting character rules

- **Email Validation** (9 tests)
  - Valid email formats
  - Invalid email rejection
  - Edge cases

**Total Unit Tests: 36**

### Integration Tests (auth.endpoints.test.ts)
- **Registration Endpoint** (8 tests)
  - Successful registration
  - Duplicate username rejection
  - Duplicate email rejection
  - Password validation
  - Username validation
  - Email validation
  - Missing fields
  - Error handling

- **Login Endpoint** (4 tests)
  - Successful login
  - Wrong password rejection
  - Non-existent email
  - Missing fields

- **Rate Limiting** (2 tests)
  - Login rate limiting
  - Registration rate limiting

**Total Integration Tests: 14**

### Security Tests (security.test.ts)
- **SQL Injection** (26 tests)
  - 13 common SQL injection payloads in email
  - 13 common SQL injection payloads in username
  - Parameterized query verification

- **XSS Protection** (8 tests)
  - Script tag injection
  - Event handler injection
  - SVG/iframe injection
  - Various XSS vectors

- **Brute Force Protection** (2 tests)
  - Rapid login attempt blocking
  - Password enumeration prevention

- **Input Length Attacks** (3 tests)
  - Extremely long username
  - Extremely long email
  - Extremely long password

- **Special Character Handling** (6 tests)
  - Null bytes
  - Control characters
  - Special ASCII characters

- **Unicode & Encoding** (2 tests)
  - Unicode characters
  - Emoji handling

- **JSON Manipulation** (3 tests)
  - Malformed JSON
  - Prototype pollution
  - Deeply nested objects

- **Header Injection** (1 test)
  - Malicious headers

- **Timing Attacks** (1 test)
  - Response time consistency

**Total Security Tests: 52**

## Total Test Count: 102 tests

## Attack Vectors Tested

### SQL Injection
Tests all OWASP Top 10 SQL injection patterns:
- Classic injection (`' OR '1'='1`)
- Comment injection (`admin'--`)
- Union-based (`UNION SELECT`)
- Stacked queries (`; DROP TABLE`)
- Boolean-based blind
- Time-based blind

### Cross-Site Scripting (XSS)
Tests common XSS vectors:
- Script tags
- Event handlers
- Image tags
- SVG elements
- Iframe injection
- JavaScript protocol

### Other Security Concerns
- CSRF (tested via cookie configuration)
- Rate limiting / Brute force
- Input validation bypass
- Buffer overflow attempts
- Prototype pollution
- Header injection
- Timing attacks

## Coverage Goals

Target coverage: **80%+**

Current focus areas:
- Authentication utilities: 100%
- Auth controllers: 90%+
- Middleware: 85%+
- Error handling: 80%+

## Known Test Limitations

1. **Database Tests**: Currently mocked - need real DB integration tests
2. **Redis Tests**: Currently mocked - need real cache tests
3. **Email Tests**: No email sending tests yet
4. **Performance Tests**: Load testing not included
5. **E2E Tests**: No browser automation yet

## Next Steps

1. Add real database integration tests (use test database)
2. Add Redis integration tests
3. Add email service tests (when implemented)
4. Add load/stress tests with artillery or k6
5. Add E2E tests with Playwright

## Security Testing Recommendations

### Before Production
- [ ] Run OWASP ZAP scan
- [ ] Run SQL injection scanner (sqlmap)
- [ ] Run dependency vulnerability scan (`npm audit`)
- [ ] Test rate limiting under load
- [ ] Verify HTTPS configuration
- [ ] Test session management
- [ ] Review CORS settings
- [ ] Test file upload security (when implemented)

### Continuous Security
- [ ] Set up automated security scanning in CI/CD
- [ ] Monitor for dependency vulnerabilities
- [ ] Regular penetration testing
- [ ] Security audit logs review

## Contributing

When adding new features:
1. Write unit tests first (TDD)
2. Add integration tests
3. Consider security implications
4. Update this documentation
5. Aim for 80%+ coverage

## Troubleshooting

### Tests timing out
- Increase `testTimeout` in jest.config.js
- Check for unhandled promises
- Verify database mocks are resolving

### Mock not working
- Ensure mock is before import
- Check mock path is correct
- Clear jest cache: `jest --clearCache`

### Coverage not updating
- Delete coverage folder
- Run `npm test` again
- Check .gitignore isn't excluding files
