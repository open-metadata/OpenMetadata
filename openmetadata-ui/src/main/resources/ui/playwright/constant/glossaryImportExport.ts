/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
export const CUSTOM_PROPERTIES_TYPES = {
  STRING: 'String',
  MARKDOWN: 'Markdown',
  SQL_QUERY: 'Sql Query',
  TABLE: 'Table',
};

export const FIELD_VALUES_CUSTOM_PROPERTIES = {
  STRING: 'This is "testing" string;',
  MARKDOWN: `### Overview
This project is designed to **simplify** and *automate* daily tasks. It aims to:
- Increase productivity
- Reduce manual effort
- Provide real-time data insights

### Features
1. **Task Management**: Organize tasks efficiently with custom tags.
2. **Real-Time Analytics**: Get up-to-date insights on task progress.
3. **Automation**: Automate repetitive workflows using custom scripts.`,
  SQL_QUERY: 'SELECT * FROM table_name WHERE id="20";',
  TABLE: {
    columns: ['pw-import-export-column1', 'pw-import-export-column2'],
    rows: 'pw-import-export-row1-column1,pw-import-export-row1-column2',
  },
};
