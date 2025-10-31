const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const QueryDetection = require('../queryDetection.js');

class TestQueryDetection {
  constructor() {
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
    this.testResults = [];
  }

  // ANSI color codes for terminal output
  colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m'
  };

  log(message, color = 'reset') {
    console.log(`${this.colors[color]}${message}${this.colors.reset}`);
  }

  /**
   * Convert line/column position to character offset in text
   * @param {string} text - The full text content
   * @param {number} line - Line number (1-based)
   * @param {number} column - Column number (1-based)
   * @returns {number} Character offset
   */
  lineColumnToOffset(text, line, column) {
    const lines = text.split('\n');
    let offset = 0;
    
    // Add all complete lines before the target line
    for (let i = 0; i < line - 1; i++) {
      offset += lines[i].length + 1; // +1 for newline character
    }
    
    // Add columns in the target line
    offset += column - 1; // -1 because column is 1-based
    
    return offset;
  }

  /**
   * Load and parse the YAML configuration file
   * @param {string} configPath - Path to config file
   * @returns {Object} Parsed configuration
   */
  loadConfig(configPath) {
    try {
      const fileContents = fs.readFileSync(configPath, 'utf8');
      return yaml.load(fileContents);
    } catch (e) {
      this.log(`Error loading config file: ${e.message}`, 'red');
      throw e;
    }
  }

  /**
   * Load SQL file content
   * @param {string} sqlPath - Path to SQL file
   * @returns {string} SQL file content
   */
  loadSqlFile(sqlPath) {
    try {
      return fs.readFileSync(sqlPath, 'utf8');
    } catch (e) {
      this.log(`Error loading SQL file: ${e.message}`, 'red');
      throw e;
    }
  }

  /**
   * Normalize query text for comparison (trim, remove extra whitespace)
   * @param {string} query - Query text
   * @returns {string} Normalized query
   */
  normalizeQuery(query) {
    if (!query) return '';
    return query.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  /**
   * Run a single test case
   * @param {string} testName - Name of the test file
   * @param {Object} testCase - Test case configuration
   * @param {string} sqlContent - SQL file content
   * @param {number} testIndex - Index of test case
   */
  runTestCase(testName, testCase, sqlContent, testIndex) {
    this.totalTests++;
    
    const { from_line, to_line, from_column, to_column, expected_query } = testCase;
    
    // Calculate cursor positions to test
    const startOffset = this.lineColumnToOffset(sqlContent, from_line, from_column);
    const endOffset = this.lineColumnToOffset(sqlContent, to_line, to_column);
    
    // Test at multiple positions within the range
    const testPositions = [
      { pos: startOffset, desc: 'start' },
      { pos: Math.floor((startOffset + endOffset) / 2), desc: 'middle' },
      { pos: endOffset, desc: 'end' }
    ];
    
    let allPositionsPassed = true;
    let failureDetails = [];
    
    for (const { pos, desc } of testPositions) {
      const result = QueryDetection.findCurrentQueryInText(sqlContent, pos);
      
      const extractedQuery = result ? result.text : null;
      const normalizedExtracted = this.normalizeQuery(extractedQuery);
      const normalizedExpected = this.normalizeQuery(expected_query);
      
      if (normalizedExtracted !== normalizedExpected) {
        allPositionsPassed = false;
        failureDetails.push({
          position: desc,
          offset: pos,
          expected: expected_query,
          actual: extractedQuery
        });
      }
    }
    
    const testDescription = `${testName} - Test #${testIndex + 1} (L${from_line}:${from_column} to L${to_line}:${to_column})`;
    
    if (allPositionsPassed) {
      this.passedTests++;
      this.log(`  ✓ ${testDescription}`, 'green');
      this.testResults.push({
        name: testDescription,
        passed: true
      });
    } else {
      this.failedTests++;
      this.log(`  ✗ ${testDescription}`, 'red');
      
      // Show failure details
      for (const failure of failureDetails) {
        this.log(`    At ${failure.position} (offset ${failure.offset}):`, 'dim');
        this.log(`    Expected: "${failure.expected}"`, 'yellow');
        this.log(`    Actual:   "${failure.actual}"`, 'yellow');
      }
      
      this.testResults.push({
        name: testDescription,
        passed: false,
        failures: failureDetails
      });
    }
  }

  /**
   * Run all tests for a specific SQL file
   * @param {string} testName - Name of the test (e.g., 'test1')
   * @param {Array} testCases - Array of test case configurations
   * @param {string} testsDir - Directory containing test files
   */
  runTestFile(testName, testCases, testsDir) {
    this.log(`\n📝 Testing ${testName}.sql`, 'blue');
    
    const sqlPath = path.join(testsDir, `${testName}.sql`);
    const sqlContent = this.loadSqlFile(sqlPath);
    
    testCases.forEach((testCase, index) => {
      this.runTestCase(testName, testCase, sqlContent, index);
    });
  }

  /**
   * Print test summary
   */
  printSummary() {
    this.log('\n' + '='.repeat(70), 'blue');
    this.log(`📊 Test Summary`, 'bold');
    this.log('='.repeat(70), 'blue');
    this.log(`Total tests: ${this.totalTests}`);
    this.log(`Passed: ${this.passedTests}`, this.passedTests === this.totalTests ? 'green' : 'yellow');
    this.log(`Failed: ${this.failedTests}`, this.failedTests > 0 ? 'red' : 'green');
    
    const successRate = this.totalTests > 0 
      ? ((this.passedTests / this.totalTests) * 100).toFixed(1)
      : 0;
    this.log(`Success rate: ${successRate}%`, successRate === '100.0' ? 'green' : 'yellow');
    
    if (this.failedTests === 0) {
      this.log('\n🎉 All tests passed!', 'green');
    } else {
      this.log(`\n❌ ${this.failedTests} test(s) failed.`, 'red');
    }
  }

  /**
   * Run all tests
   */
  runAllTests() {
    this.log('🚀 Starting Query Detection Tests from YAML Config...', 'bold');
    
    const testsDir = path.join(__dirname);
    const configPath = path.join(testsDir, 'config_test.yaml');
    
    // Load configuration
    const config = this.loadConfig(configPath);
    
    // Run tests for each test file
    for (const [testName, testCases] of Object.entries(config)) {
      this.runTestFile(testName, testCases, testsDir);
    }
    
    // Print summary
    this.printSummary();
    
    // Exit with appropriate code
    process.exit(this.failedTests > 0 ? 1 : 0);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const runner = new TestQueryDetection();
  runner.runAllTests();
}

module.exports = TestQueryDetection;

