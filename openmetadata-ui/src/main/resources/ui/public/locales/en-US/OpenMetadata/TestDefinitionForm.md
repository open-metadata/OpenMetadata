# Test Definition

Create test definitions to describe reusable data quality rules. A test definition controls where a rule can be used, which engines can execute it, and which parameters a user must provide while creating test cases.

$$section
### Name $(id="name")

Provide the unique technical name for the test definition. This name is used to reference the definition in APIs, test cases, and rule configuration. Use a concise name that describes the validation the rule performs.
$$

$$section
### Display Name $(id="displayName")

Provide a user-friendly name shown in the UI. Use this field when the technical name needs clearer spacing, capitalization, or wording for users browsing the test library.
$$

$$section
### Description $(id="description")

Describe what the test definition validates, when it should be used, and any important behavior users should know before creating test cases from it.
$$

$$section
### SQL Query $(id="sqlExpression")

Define the SQL expression used to evaluate the rule for OpenMetadata-native tests. The expression should match the selected entity type and use the placeholders expected by the validator.
$$

$$section
### Entity Type $(id="entityType")

Choose whether this definition applies to tables or columns. This controls where the definition appears when users add data quality tests.
$$

$$section
### Test Platforms $(id="testPlatforms")

Select the platforms that support this definition, such as OpenMetadata, dbt, or Great Expectations. OpenMetadata definitions can use SQL expressions and supported data type settings.
$$

$$section
### Data Quality Dimension $(id="dataQualityDimension")

Classify the rule under a data quality dimension such as completeness, accuracy, consistency, or validity. This helps teams group and report test coverage.
$$

$$section
### Supported Services $(id="supportedServices")

Limit the definition to specific database services when the rule only works for certain engines. Leave this empty when the definition can be used for all supported services.
$$

$$section
### Supported Data Types $(id="supportedDataTypes")

Select the column data types where this definition is valid. This is used for column-level OpenMetadata tests so users only see applicable rules for the selected column.
$$

$$section
### Parameters $(id="parameterDefinition")

Define the inputs users must provide when creating test cases from this definition. Each parameter can include a name, display name, description, data type, and whether it is required.
$$
