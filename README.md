# BigQuery Smart Execute - Chrome Extension

This Chrome extension allows you to automatically execute the SQL query under your cursor in BigQuery, without needing to manually select it.

## 🚀 Features

- **Intelligent priority logic**: Respects manual selection as priority
- **Enhanced Run button**: Run button displays "Run current" or "Run all" based on mode
- **Selective execution**: Detects and executes the SQL query around the cursor
- **Single Query toggle**: Enable/disable single query mode
- **Manual selection**: Full support for BigQuery text selection
- **Keyboard shortcut**: `Ctrl+Enter` (or `Cmd+Enter` on Mac)
- **Transparent interception**: Modifies behavior without breaking the interface
- **Intelligent detection**: Automatically identifies query boundaries (separated by `;`)
- **Native interface**: Compatible with BigQuery's custom editor
- **Visual feedback**: Status indicators and informative messages
- **Persistent settings**: Preferences are automatically saved

## 📦 Installation

### Option 1: Developer mode (recommended)

1. **Download the extension**:
   ```bash
   git clone [this-repo]
   cd chrome-extension
   ```

2. **Open Chrome** and go to: `chrome://extensions/`

3. **Enable Developer mode** in the top right

4. **Click "Load unpacked"**

5. **Select the folder** `chrome-extension`

6. **The extension is now installed**! 🎉

### Option 2: From .crx file

1. Package the extension from `chrome://extensions/`
2. Install the generated `.crx` file

## 🔧 Usage

1. **Open BigQuery**: [console.cloud.google.com/bigquery](https://console.cloud.google.com/bigquery)

2. **Configure the extension**: Click on the extension icon to open the popup
   - **Single Query Mode ON**: Execute only the query under the cursor
   - **Single Query Mode OFF**: Execute all editor content

3. **Write your SQL queries**:
   ```sql
   select 1;
   select 3
   union all
   select 4
   ;
   select 2;
   ```

4. **Place the cursor** anywhere in a query (if Single Query mode is enabled)

5. **Use one of these methods**:
   - **Press `Ctrl+Enter`** (or `Cmd+Enter` on Mac)
   - **Click the "Run" button** which now displays:
     - **"Run current"** in Single Query mode
     - **"Run all"** in complete mode

6. **The query executes with priority logic**! ✨

## 🎯 How it works

The extension uses **intelligent priority logic**:

### 🥇 **Priority 1: Manual selection**
- If you have selected text → Executes the selection
- Identical to BigQuery's standard behavior

### 🥈 **Priority 2: Single Query mode (if enabled)**
- Automatically detects the query under the cursor
- Finds boundaries between `;`
- Selects and executes only that query

### 🥉 **Priority 3: Complete execution (fallback)**
- Executes all editor content
- BigQuery's default mode

### ⚙️ **Technical process**
1. **Detects BigQuery's custom editor** (classes `cfc-code-editor`)
2. **Intercepts the Run button** to apply the same logic as Ctrl+Enter
3. **Checks manual selection** (textarea or Selection API)
4. **Analyzes text** around cursor position
5. **Finds query boundaries** (separated by `;`)
6. **Automatically selects** the detected query
7. **Triggers execution** via BigQuery's native events

## 🔍 Detection algorithm

```javascript
// Example with your HTML
// Cursor on line "select 3"
//
// ↓ Search upward until ;
// select 1;        <- boundary found
// select 3         <- cursor here
// union all        
// select 4
// ;                <- search downward until ;
// select 2;
//
// Result: selects "select 3\nunion all\nselect 4\n;"
```

## 🛠️ Project structure

```
chrome-extension/
├── manifest.json     # Extension configuration
├── content.js        # Main script (BigQuery injection)
├── popup.html        # User interface
├── popup.js          # Popup logic
├── favicon.png       # Extension icon
└── README.md         # Documentation
```

## 🐛 Debugging

### Developer Tools Console

1. **Open DevTools** in BigQuery (`F12`)
2. **Look for logs**: `BigQuery Smart Execute`
3. **Check errors** in the console

### Common error messages

- `BigQuery editor not available`: Editor not yet loaded
- `No query detected`: Cursor is not in a valid SQL query
- `Execution error`: Problem with BigQuery API

## ⚙️ Configuration

### Configuration interface

The extension has a popup accessible by clicking its icon:

- **Toggle Single Query**: Enable/disable single query mode
- **Status**: Shows if the extension is active on BigQuery
- **Visual feedback**: Informative messages about the state

### Operating modes

The extension always respects this priority hierarchy:

1. **🎯 Manual selection (always priority)**:
   - You manually select text
   - Extension executes only the selection
   - Works regardless of Single Query mode

2. **⚡ Single Query Mode ON (default)**:
   - Automatically detects query under cursor
   - Executes only that query
   - Ideal for testing individual queries

3. **📝 Single Query Mode OFF**:
   - Executes all editor content
   - Standard BigQuery behavior
   - Useful for running multiple queries in sequence

**Note:** Manual selection always takes priority over automatic modes.

### 🎯 **Smart Run button**

The extension enhances BigQuery's "Run" button with clear visual feedback:

#### 📝 **Adaptive text**
- **Single Query Mode ON** → Button displays **"Run current"**
- **Single Query Mode OFF** → Button displays **"Run all"**
- **Real-time updates** when you change the mode

#### ⚙️ **Technical features**
- **Automatic detection**: Finds the Run button in the interface
- **Transparent interception**: Prevents default behavior
- **Unified logic**: Applies same priority as Ctrl+Enter
- **Original text saved**: Possible restoration of original text
- **Subtle animation**: Visual indication during changes
- **Smart bypass**: Lets internal clicks pass to avoid loops

**Result:** You immediately see what will be executed! 👀

### Advanced customization

#### Change keyboard shortcut

In `content.js`, section `addKeyboardListeners()`:

```javascript
// Change Ctrl+Enter to Alt+R for example
if (e.altKey && e.key === 'r') {
  e.preventDefault();
  this.executeCurrentQuery();
}
```

#### Add other query types

In `findCurrentQueryInText()`:

```javascript
// Add support for CREATE, DROP, etc.
if (queryText && (
  queryText.toLowerCase().includes('select') ||
  queryText.toLowerCase().includes('create') ||
  queryText.toLowerCase().includes('drop')
)) {
  // ...
}
```

## 🚨 Limitations

- **Operation**: Only on `console.cloud.google.com/bigquery`
- **Detection**: Based on semicolons (`;`) as separators
- **Compatibility**: Tested on Chrome 120+
- **Permissions**: Requires access to current tab

## 🤝 Contributing

Contributions are welcome!

1. Fork the project
2. Create a feature branch
3. Commit changes
4. Push to the branch
5. Open a Pull Request

## 📝 License

MIT License - see LICENSE file for details.

## 🆘 Support

If you encounter problems:

1. **Check console** in DevTools
2. **Reload extension** from `chrome://extensions/`
3. **Open an issue** with problem details

---

Made with ❤️ to improve BigQuery experience! 