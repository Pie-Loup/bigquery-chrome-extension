const QueryDetection = require('./queryDetection.js');

// Test data with queries and expected results
const testCases = [
  {
    name: "Single SELECT query with cursor in middle",
    text: "SELECT name, age FROM users WHERE age > 25;",
    cursorPosition: 20,
    expected: {
      text: "SELECT name, age FROM users WHERE age > 25",
      startLine: 0,
      endLine: 0,
      startPosition: 0,
      endPosition: 42
    }
  },
  {
    name: "Multiple queries - cursor in first query",
    text: `SELECT * FROM table1;
SELECT * FROM table2;
SELECT * FROM table3;`,
    cursorPosition: 10,
    expected: {
      text: "SELECT * FROM table1",
      startLine: 0,
      endLine: 0,
      startPosition: 0,
      endPosition: 20
    }
  },
  {
    name: "Multiple queries - cursor in second query",
    text: `SELECT * FROM table1;
SELECT * FROM table2;
SELECT * FROM table3;`,
    cursorPosition: 35,
    expected: {
      text: "SELECT * FROM table2",
      startLine: 0,
      endLine: 1,
      startPosition: 21,
      endPosition: 42
    }
  },
  {
    name: "Multi-line query with cursor in middle",
    text: `SELECT 
  name,
  age,
  email
FROM users
WHERE age > 25
AND status = 'active';`,
    cursorPosition: 50,
    expected: {
      text: `SELECT 
  name,
  age,
  email
FROM users
WHERE age > 25
AND status = 'active'`,
      startLine: 0,
      endLine: 6,
      startPosition: 0,
      endPosition: 78
    }
  },
  {
    name: "WITH clause query",
    text: `WITH temp_table AS (
  SELECT id, name FROM users
)
SELECT * FROM temp_table;`,
    cursorPosition: 40,
    expected: {
      text: `WITH temp_table AS (
  SELECT id, name FROM users
)
SELECT * FROM temp_table`,
      startLine: 0,
      endLine: 3,
      startPosition: 0,
      endPosition: 76
    }
  },
  {
    name: "INSERT query",
    text: "INSERT INTO users (name, age) VALUES ('John', 30);",
    cursorPosition: 25,
    expected: {
      text: "INSERT INTO users (name, age) VALUES ('John', 30)",
      startLine: 0,
      endLine: 0,
      startPosition: 0,
      endPosition: 49
    }
  },
  {
    name: "Query without semicolon at end",
    text: `SELECT * FROM table1;
SELECT name FROM table2`,
    cursorPosition: 40,
    expected: {
      text: "SELECT name FROM table2",
      startLine: 0,
      endLine: 1,
      startPosition: 21,
      endPosition: 45
    }
  },
  {
    name: "Comments and empty lines",
    text: `-- This is a comment
SELECT * FROM table1;

-- Another comment
SELECT * FROM table2;`,
    cursorPosition: 80,
    expected: {
      text: "SELECT * FROM table2",
      startLine: 3,
      endLine: 4,
      startPosition: 61,
      endPosition: 83
    }
  },
  {
    name: "No valid query",
    text: "This is just some text without SQL",
    cursorPosition: 15,
    expected: null
  },
  {
    name: "Empty text",
    text: "",
    cursorPosition: 0,
    expected: null
  },
  {
    name: "Cursor at very beginning",
    text: "SELECT * FROM users;",
    cursorPosition: 0,
    expected: {
      text: "SELECT * FROM users",
      startLine: 0,
      endLine: 0,
      startPosition: 0,
      endPosition: 19
    }
  },
  {
    name: "Cursor at very end",
    text: "SELECT * FROM users;",
    cursorPosition: 20,
    expected: {
      text: "SELECT * FROM users",
      startLine: 0,
      endLine: 0,
      startPosition: 0,
      endPosition: 19
    }
  },
  {
    name: "Multiple statements separated by semicolons on same line",
    text: "SELECT 1; SELECT 2; SELECT 3;",
    cursorPosition: 15,
    expected: {
      text: "SELECT 2",
      startLine: 0,
      endLine: 0,
      startPosition: 9,
      endPosition: 18
    }
  }
];

// Test cases for extractAllQueries
const extractAllQueriesTestCases = [
  {
    name: "Multiple simple queries",
    text: `SELECT * FROM table1;
SELECT * FROM table2;
SELECT * FROM table3;`,
    expected: [
      {
        text: "SELECT * FROM table1",
        startLine: 0,
        endLine: 0,
        startPosition: 0,
        endPosition: 20
      },
      {
        text: "SELECT * FROM table2",
        startLine: 0,
        endLine: 1,
        startPosition: 21,
        endPosition: 42
      },
      {
        text: "SELECT * FROM table3",
        startLine: 1,
        endLine: 2,
        startPosition: 43,
        endPosition: 64
      }
    ]
  },
  {
    name: "Mixed query types",
    text: `SELECT * FROM users;
INSERT INTO users (name) VALUES ('John');
UPDATE users SET age = 30;`,
    expected: [
      {
        text: "SELECT * FROM users",
        startLine: 0,
        endLine: 0,
        startPosition: 0,
        endPosition: 19
      },
      {
        text: "INSERT INTO users (name) VALUES ('John')",
        startLine: 0,
        endLine: 1,
        startPosition: 20,
        endPosition: 61
      },
      {
        text: "UPDATE users SET age = 30",
        startLine: 1,
        endLine: 2,
        startPosition: 62,
        endPosition: 88
      }
    ]
  }
];

// Test cases for isValidQuery
const isValidQueryTestCases = [
  { text: "SELECT * FROM users", expected: true },
  { text: "WITH temp AS (SELECT 1) SELECT * FROM temp", expected: true },
  { text: "INSERT INTO table VALUES (1)", expected: true },
  { text: "UPDATE table SET col = 1", expected: true },
  { text: "DELETE FROM table", expected: true },
  { text: "CREATE TABLE test (id INT)", expected: true },
  { text: "DROP TABLE test", expected: true },
  { text: "This is just text", expected: false },
  { text: "", expected: false },
  { text: null, expected: false },
  { text: undefined, expected: false }
];

module.exports = {
  testCases,
  extractAllQueriesTestCases,
  isValidQueryTestCases
};
