const QueryDetection = require('./queryDetection.js');
const { testCases, extractAllQueriesTestCases, isValidQueryTestCases } = require('./testData.js');

class TestRunner {
  constructor() {
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
  }

  // ANSI color codes for terminal output
  colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
  };

  log(message, color = 'reset') {
    console.log(`${this.colors[color]}${message}${this.colors.reset}`);
  }

  deepEquals(obj1, obj2) {
    if (obj1 === obj2) return true;
    if (obj1 == null || obj2 == null) return false;
    if (typeof obj1 !== typeof obj2) return false;
    
    if (typeof obj1 === 'object') {
      const keys1 = Object.keys(obj1);
      const keys2 = Object.keys(obj2);
      
      if (keys1.length !== keys2.length) return false;
      
      for (let key of keys1) {
        if (!keys2.includes(key)) return false;
        if (!this.deepEquals(obj1[key], obj2[key])) return false;
      }
      
      return true;
    }
    
    return obj1 === obj2;
  }

  runTest(testName, testFunction) {
    this.totalTests++;
    try {
      const result = testFunction();
      if (result.passed) {
        this.passedTests++;
        this.log(`✓ ${testName}`, 'green');
      } else {
        this.failedTests++;
        this.log(`✗ ${testName}`, 'red');
        if (result.error) {
          this.log(`  Error: ${result.error}`, 'red');
        }
        if (result.expected !== undefined && result.actual !== undefined) {
          this.log(`  Expected: ${JSON.stringify(result.expected, null, 2)}`, 'yellow');
          this.log(`  Actual: ${JSON.stringify(result.actual, null, 2)}`, 'yellow');
        }
      }
    } catch (error) {
      this.failedTests++;
      this.log(`✗ ${testName} - Exception: ${error.message}`, 'red');
    }
  }

  testFindCurrentQueryInText() {
    this.log('\n📍 Testing findCurrentQueryInText...', 'blue');
    
    testCases.forEach(testCase => {
      this.runTest(testCase.name, () => {
        const result = QueryDetection.findCurrentQueryInText(testCase.text, testCase.cursorPosition);
        
        if (testCase.expected === null) {
          return {
            passed: result === null,
            expected: null,
            actual: result
          };
        }
        
        const passed = this.deepEquals(result, testCase.expected);
        return {
          passed,
          expected: testCase.expected,
          actual: result
        };
      });
    });
  }

  testExtractAllQueries() {
    this.log('\n📝 Testing extractAllQueries...', 'blue');
    
    extractAllQueriesTestCases.forEach(testCase => {
      this.runTest(testCase.name, () => {
        const result = QueryDetection.extractAllQueries(testCase.text);
        const passed = this.deepEquals(result, testCase.expected);
        
        return {
          passed,
          expected: testCase.expected,
          actual: result
        };
      });
    });
  }

  testIsValidQuery() {
    this.log('\n🔍 Testing isValidQuery...', 'blue');
    
    isValidQueryTestCases.forEach((testCase, index) => {
      this.runTest(`isValidQuery test ${index + 1}: "${testCase.text}"`, () => {
        const result = QueryDetection.isValidQuery(testCase.text);
        const passed = result === testCase.expected;
        
        return {
          passed,
          expected: testCase.expected,
          actual: result
        };
      });
    });
  }

  testEdgeCases() {
    this.log('\n⚠️  Testing edge cases...', 'blue');

    // Test with invalid inputs
    this.runTest('findCurrentQueryInText with null text', () => {
      const result = QueryDetection.findCurrentQueryInText(null, 0);
      return { passed: result === null };
    });

    this.runTest('findCurrentQueryInText with undefined cursor', () => {
      const result = QueryDetection.findCurrentQueryInText('SELECT 1', undefined);
      return { passed: result === null };
    });

    this.runTest('extractAllQueries with empty string', () => {
      const result = QueryDetection.extractAllQueries('');
      return { passed: Array.isArray(result) && result.length === 0 };
    });

    this.runTest('getLineAndColumn basic test', () => {
      const text = "line 1\nline 2\nline 3";
      const result = QueryDetection.getLineAndColumn(text, 10);
      const expected = { line: 1, column: 3 };
      return { 
        passed: this.deepEquals(result, expected),
        expected,
        actual: result
      };
    });

    this.runTest('findQueryBoundaries test', () => {
      const text = "SELECT 1; SELECT 2;";
      const result = QueryDetection.findQueryBoundaries(text, 12);
      const passed = result !== null && result.text === "SELECT 2";
      return { 
        passed,
        expected: "Non-null result with text 'SELECT 2'",
        actual: result ? result.text : null
      };
    });
  }

  printSummary() {
    this.log('\n' + '='.repeat(50), 'blue');
    this.log(`📊 Test Summary`, 'bold');
    this.log('='.repeat(50), 'blue');
    this.log(`Total tests: ${this.totalTests}`);
    this.log(`Passed: ${this.passedTests}`, 'green');
    this.log(`Failed: ${this.failedTests}`, this.failedTests > 0 ? 'red' : 'green');
    
    const successRate = ((this.passedTests / this.totalTests) * 100).toFixed(1);
    this.log(`Success rate: ${successRate}%`, successRate === '100.0' ? 'green' : 'yellow');
    
    if (this.failedTests === 0) {
      this.log('\n🎉 All tests passed!', 'green');
    } else {
      this.log(`\n❌ ${this.failedTests} test(s) failed.`, 'red');
    }
  }

  runAllTests() {
    this.log('🚀 Starting BigQuery Query Detection Tests...', 'bold');
    
    this.testFindCurrentQueryInText();
    this.testExtractAllQueries();
    this.testIsValidQuery();
    this.testEdgeCases();
    
    this.printSummary();
    
    // Exit with appropriate code
    process.exit(this.failedTests > 0 ? 1 : 0);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const runner = new TestRunner();
  runner.runAllTests();
}

module.exports = TestRunner;
