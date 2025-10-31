# Setting Up Required Status Checks

To require the query detection tests to pass before merging PRs, follow these steps:

## 1. Enable GitHub Actions
- Go to your repository on GitHub
- Navigate to **Settings** → **Actions** → **General**
- Ensure "Allow all actions and reusable workflows" is selected

## 2. Set Up Branch Protection Rule

1. Go to **Settings** → **Branches**
2. Click **Add branch protection rule**
3. In "Branch name pattern", enter: `main` (or `master` depending on your default branch)
4. Check the following options:
   - ✅ **Require a pull request before merging**
   - ✅ **Require status checks to pass before merging**
5. In the status checks search box, type: **test**
6. Select the check that appears: **test (18.x)** and **test (20.x)**
   - These are the test jobs from the workflow running on Node.js 18 and 20
7. Optionally check:
   - ✅ **Require branches to be up to date before merging**
   - ✅ **Do not allow bypassing the above settings**
8. Click **Create** or **Save changes**

## 3. Verify It Works

1. Create a new branch
2. Make a change to `queryDetection.js`
3. Open a Pull Request
4. You should see the "Query Detection Tests" check running
5. The merge button will be disabled until tests pass ✅

## Testing Matrix

The workflow runs tests on:
- Node.js 18.x
- Node.js 20.x

This ensures compatibility across different Node.js versions.

## What Gets Tested

The workflow runs **both** test suites (49 total tests):

### Unit Tests (31 tests)
- Query detection with various cursor positions
- Multi-line queries and WITH clauses  
- Query extraction and validation
- Edge cases and error handling

### Query Detection Tests (18 tests across 6 SQL files)
- Cursor positioning edge cases
- Semicolon handling (single, multiple, consecutive)
- Multi-line queries and CTEs
- Comment handling (inline and block comments)
- Queries on the same line
- Blank line separators

All 49 tests must pass (100% pass rate) for the PR to be mergeable.

