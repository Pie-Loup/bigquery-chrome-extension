/**
 * BigQuery Query Detection Module
 * Handles the logic for detecting and extracting SQL queries from text
 */

class QueryDetection {
  /**
   * Find the current query at the cursor position in the given text
   * @param {string} text - The full text content
   * @param {number} cursorPosition - The cursor position in the text
   * @returns {Object|null} Query information or null if no query found
   */
  static findCurrentQueryInText(text, cursorPosition) {
    if (!text || typeof cursorPosition !== 'number') {
      return null;
    }

    // Ensure cursor position is within bounds
    if (cursorPosition < 0 || cursorPosition > text.length) {
      return null;
    }

    let effectiveCursor = Math.min(cursorPosition, text.length - 1);

    // If cursor is immediately after a semicolon with no whitespace, treat as end of previous query
    // Example: "query1;query2" with cursor on 'q' of query2 should return query1
    if (effectiveCursor > 0 && text[effectiveCursor - 1] === ';' && 
        text[effectiveCursor] !== ';' && !/\s/.test(text[effectiveCursor])) {
      effectiveCursor = effectiveCursor - 1;
    }

    // Simple approach: just call the search from the effective cursor
    // The search will handle skipping comments and finding valid queries
    return this.searchForQueryAt(text, effectiveCursor);
  }

  /**
   * Helper method to search for a query at a specific cursor position
   * @param {string} text - The full text content
   * @param {number} searchCursor - The cursor position to search from
   * @returns {Object|null} Query information or null
   */
  static searchForQueryAt(text, searchCursor) {
    let cursor = searchCursor;
    
    // Check if cursor is in a "blank separator" area (consecutive blank lines)
    // In that case, we should look FORWARD to the next query, not BACKWARD
    let inBlankArea = false;
    if (/\s/.test(text[cursor]) || text[cursor] === ';') {
      // Look for pattern like "\n\n" (consecutive newlines with only whitespace between)
      let tempCursor = cursor;
      let foundDoubleNewline = false;
      
      // Scan backward through whitespace/semicolons
      while (tempCursor > 0 && (/\s/.test(text[tempCursor]) || text[tempCursor] === ';')) {
        // Check for consecutive newlines (allowing spaces/tabs between)
        if (text[tempCursor] === '\n' && tempCursor > 0) {
          // Look backward for another newline (skipping spaces/tabs but not semicolons)
          let checkCursor = tempCursor - 1;
          while (checkCursor > 0 && (text[checkCursor] === ' ' || text[checkCursor] === '\t')) {
            checkCursor--;
          }
          if (text[checkCursor] === '\n') {
            foundDoubleNewline = true;
            break;
          }
        }
        tempCursor--;
      }
      inBlankArea = foundDoubleNewline;
    }
    
    if (inBlankArea) {
      // Skip FORWARD through whitespace/semicolons to find next query
      while (cursor < text.length - 1 && (/\s/.test(text[cursor]) || text[cursor] === ';')) {
        cursor++;
      }
    } else {
      // Skip BACKWARD through whitespace/semicolons to find previous query
      while (cursor > 0 && (/\s/.test(text[cursor]) || text[cursor] === ';')) {
        cursor--;
      }
    }
    
    // Keep searching backward through invalid content (comments, etc.)
    while (cursor >= 0) {
      // Find left boundary: scan backward from cursor to find semicolon or start
      let leftBoundary = 0;
      for (let i = cursor; i >= 0; i--) {
        if (text[i] === ';') {
          leftBoundary = i + 1;
          break;
        }
      }

      // Find right boundary: scan forward from cursor to find semicolon or end
      let rightBoundary = text.length;
      for (let i = cursor + 1; i < text.length; i++) {
        if (text[i] === ';') {
          rightBoundary = i;
          break;
        }
      }

      // Extract the query text
      let queryText = text.substring(leftBoundary, rightBoundary).trim();

      // Check if the ENTIRE query is wrapped in a multi-line comment block
      const isCommentBlock = queryText.startsWith('/*') && queryText.endsWith('*/');
      
      // Check if it's a valid query (and not a comment block)
      if (!isCommentBlock && this.isValidQuery(queryText)) {
        // Strip leading and trailing comment lines/markers from the query text
        const lines = queryText.split('\n');
        let firstQueryLineIndex = 0;
        let lastQueryLineIndex = lines.length - 1;
        
        // Find first non-comment line
        for (let i = 0; i < lines.length; i++) {
          const trimmedLine = lines[i].trim();
          if (!trimmedLine.startsWith('--') && !trimmedLine.startsWith('/*') && !trimmedLine.startsWith('*/') && trimmedLine.length > 0) {
            firstQueryLineIndex = i;
            break;
          }
        }
        
        // Find last non-comment line
        for (let i = lines.length - 1; i >= firstQueryLineIndex; i--) {
          const trimmedLine = lines[i].trim();
          if (!trimmedLine.startsWith('--') && !trimmedLine.startsWith('*/') && !trimmedLine.endsWith('*/') && trimmedLine.length > 0) {
            lastQueryLineIndex = i;
            break;
          }
        }
        
        // Rebuild query without leading/trailing comments
        if (firstQueryLineIndex > 0 || lastQueryLineIndex < lines.length - 1) {
          queryText = lines.slice(firstQueryLineIndex, lastQueryLineIndex + 1).join('\n');
          
          // Adjust leftBoundary to skip the leading comment lines
          if (firstQueryLineIndex > 0) {
            const commentText = lines.slice(0, firstQueryLineIndex).join('\n');
            leftBoundary += commentText.length + 1; // +1 for newline
          }
          
          // Adjust rightBoundary to skip the trailing comment lines
          if (lastQueryLineIndex < lines.length - 1) {
            const trailingCommentText = lines.slice(lastQueryLineIndex + 1).join('\n');
            rightBoundary -= trailingCommentText.length + 1; // +1 for newline
          }
        }
        
        // Calculate line numbers for the result
        const textBeforeStart = text.substring(0, leftBoundary);
        const textBeforeEnd = text.substring(0, rightBoundary);
        
        const startLine = (textBeforeStart.match(/\n/g) || []).length;
        const endLine = (textBeforeEnd.match(/\n/g) || []).length;

        return {
          text: queryText,
          startLine: startLine,
          endLine: endLine,
          startPosition: leftBoundary,
          endPosition: rightBoundary
        };
      }
      
      // If we found invalid content (comment, etc.), try again before the left boundary
      if (leftBoundary > 0) {
        cursor = leftBoundary - 2;
        // Skip whitespace and semicolons
        while (cursor > 0 && (/\s/.test(text[cursor]) || text[cursor] === ';')) {
          cursor--;
        }
      } else {
        // Reached start of file
        break;
      }
    }
    
    return null;
  }

  /**
   * Check if the given text is a valid SQL query
   * @param {string} queryText - The text to validate
   * @returns {boolean} True if the text appears to be a valid SQL query
   */
  static isValidQuery(queryText) {
    if (!queryText || typeof queryText !== 'string') {
      return false;
    }

    const normalizedText = queryText.toLowerCase().trim();
    
    // Check for SQL keywords that indicate a valid query
    const validKeywords = [
      'select',
      'with',
      'insert',
      'update',
      'delete',
      'create',
      'drop',
      'alter',
      'truncate'
    ];
    
    // The query should contain one of these keywords
    // Split by lines and words to find the first meaningful SQL keyword
    const lines = normalizedText.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip comment-only lines
      if (trimmedLine.startsWith('--') || trimmedLine.startsWith('/*')) {
        continue;
      }
      
      // Check if this line starts with a valid SQL keyword
      const words = trimmedLine.split(/\s+/);
      const firstWord = words[0];
      
      if (firstWord && validKeywords.includes(firstWord)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Extract all queries from a text block
   * @param {string} text - The full text content
   * @returns {Array} Array of query objects
   */
  static extractAllQueries(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const queries = [];
    let currentStart = 0;

    // Split by semicolons and extract each query
    for (let i = 0; i < text.length; i++) {
      if (text[i] === ';') {
        const queryText = text.substring(currentStart, i).trim();
        
        if (this.isValidQuery(queryText)) {
          const textBeforeStart = text.substring(0, currentStart);
          const textBeforeEnd = text.substring(0, i);
          
          const startLine = (textBeforeStart.match(/\n/g) || []).length;
          const endLine = (textBeforeEnd.match(/\n/g) || []).length;

          queries.push({
            text: queryText,
            startLine: startLine,
            endLine: endLine,
            startPosition: currentStart,
            endPosition: i
          });
        }
        
        // Move to next potential query (skip whitespace after semicolon)
        currentStart = i + 1;
        while (currentStart < text.length && /\s/.test(text[currentStart]) && text[currentStart] !== '\n') {
          currentStart++;
        }
      }
    }

    // Handle the last query if it doesn't end with a semicolon
    if (currentStart < text.length) {
      const queryText = text.substring(currentStart).trim();
      
      if (this.isValidQuery(queryText)) {
        const textBeforeStart = text.substring(0, currentStart);
        const startLine = (textBeforeStart.match(/\n/g) || []).length;
        const endLine = (text.match(/\n/g) || []).length;

        queries.push({
          text: queryText,
          startLine: startLine,
          endLine: endLine,
          startPosition: currentStart,
          endPosition: text.length
        });
      }
    }

    return queries;
  }

  /**
   * Find query boundaries around a specific position
   * @param {string} text - The full text content
   * @param {number} position - The position to search around
   * @returns {Object|null} Query boundaries or null
   */
  static findQueryBoundaries(text, position) {
    return this.findCurrentQueryInText(text, position);
  }

  /**
   * Get the line and column from a text position
   * @param {string} text - The full text content
   * @param {number} position - The position in the text
   * @returns {Object} Object with line and column properties
   */
  static getLineAndColumn(text, position) {
    if (!text || typeof position !== 'number') {
      return { line: 0, column: 0 };
    }

    const textBeforePosition = text.substring(0, position);
    const lines = textBeforePosition.split('\n');
    
    return {
      line: lines.length - 1,
      column: lines[lines.length - 1].length
    };
  }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QueryDetection;
} else if (typeof window !== 'undefined') {
  window.QueryDetection = QueryDetection;
}
