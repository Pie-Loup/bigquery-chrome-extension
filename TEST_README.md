# BigQuery Smart Execute - Testing

This document explains how to run tests for the query detection functionality.

## Test Setup

The query detection logic has been extracted into a separate module (`queryDetection.js`) to make it easier to test and maintain.

### Files Structure

- `queryDetection.js` - Main query detection logic
- `testData.js` - Test cases with queries and expected results
- `testRunner.js` - Test runner with colored output
- `package.json` - NPM configuration with test scripts

### Running Tests

#### Prerequisites

Make sure you have Node.js installed (version 14 or higher).

#### Install Dependencies

```bash
npm install
```

#### Run Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (reruns on file changes)
npm run test:watch
```

### Test Categories

The test suite covers the following scenarios:

1. **Single Query Detection**
   - Simple SELECT statements
   - Queries with different cursor positions
   - Multi-line queries

2. **Multiple Query Handling**
   - Detecting individual queries in multi-query text
   - Proper boundary detection between queries

3. **SQL Statement Types**
   - SELECT, INSERT, UPDATE, DELETE
   - WITH clauses (CTEs)
   - CREATE, DROP, ALTER statements

4. **Edge Cases**
   - Queries without semicolons
   - Comments and empty lines
   - Invalid inputs (null, undefined)
   - Empty text

5. **Boundary Detection**
   - Cursor at beginning/end of text
   - Multiple statements on same line
   - Queries separated by semicolons

### Adding New Tests

To add new test cases, edit `testData.js`:

```javascript
{
  name: "Description of your test",
  text: "Your SQL text here",
  cursorPosition: 10, // Position where cursor is located
  expected: {
    text: "Expected extracted query",
    startLine: 0,
    endLine: 0,
    startPosition: 0,
    endPosition: 20
  } // or null if no query should be detected
}
```

### Test Output

The test runner provides colored console output:
- ✅ Green checkmarks for passing tests
- ❌ Red X marks for failing tests
- Expected vs Actual values for failed tests
- Summary with success rate

Example output:
```
🚀 Starting BigQuery Query Detection Tests...

📍 Testing findCurrentQueryInText...
✓ Single SELECT query with cursor in middle
✓ Multiple queries - cursor in first query
✓ Multiple queries - cursor in second query
...

📊 Test Summary
==================================================
Total tests: 25
Passed: 25
Failed: 0
Success rate: 100.0%

🎉 All tests passed!
```

### Continuous Development

For active development, use the watch mode:

```bash
npm run test:watch
```

This will automatically rerun tests whenever you modify:
- `queryDetection.js`
- `testData.js`
- `testRunner.js`

### Integration with Extension

The `queryDetection.js` module is designed to work in both Node.js (for testing) and browser environments (for the Chrome extension). The content script (`content.js`) has been updated to use the extracted query detection logic.
