---
title: updateColumn
slug: /main-concepts/metadata-standard/schemas/api/data/updatecolumn
---

# UpdateColumn

*Update Column API request to update individual column metadata such as display name, description, tags, and glossary terms. This API works for columns in both tables and dashboard data models using the column's fully qualified name. The constraint field is only applicable to table columns.*

## Properties

- **`displayName`** *(string)*: Display Name that identifies this column name.
- **`description`**: Description of the column. Refer to *../../type/basic.json#/definitions/markdown*.
- **`tags`** *(array)*: Tags and glossary terms associated with the column. Use source: 'Classification' for classification tags and source: 'Glossary' for glossary terms. Provide an empty array to remove all tags. Note: Invalid or non-existent tags/glossary terms will result in a 404 error. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`constraint`**: Column level constraint. Only applicable to table columns, ignored for dashboard data model columns. Refer to *../../entity/data/table.json#/definitions/constraint*.
- **`removeConstraint`** *(boolean)*: Set to true to remove the existing column constraint. Only applicable to table columns, ignored for dashboard data model columns. If both 'constraint' and 'removeConstraint' are provided, 'removeConstraint' takes precedence. Default: `False`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
