## Data Quality

### Adding Data Quality Test Cases from yaml config

When creating a JSON config for a test workflow the source configuration is very simple.
```yaml
source:
  type: TestSuite
  serviceName: <your_service_name>
  sourceConfig:
    config:
      type: TestSuite
      entityFullyQualifiedName: <entityFqn>
```
The only sections you need to modify here are the `serviceName` (this name needs to be unique) and `entityFullyQualifiedName` (the entity for which we'll be executing tests against) keys.

Once you have defined your source configuration you'll need to define te processor configuration. 

```yaml
processor:
  type: "orm-test-runner"
  config:
    forceUpdate: <false|true>
    testCases:
      - name: <testCaseName>
        testDefinitionName: columnValueLengthsToBeBetween
        columnName: <columnName>
        parameterValues:
          - name: minLength
            value: 10
          - name: maxLength
            value: 25
      - name: <testCaseName>
        testDefinitionName: tableRowCountToEqual
        parameterValues:
          - name: value
            value: 10
```

The processor type should be set to ` "orm-test-runner"`. For accepted test definition names and parameter value names refer to the [tests page](/how-to-guides/data-quality-observability/quality/tests-yaml).

{% note %}

Note that while you can define tests directly in this YAML configuration, running the
workflow will execute ALL THE TESTS present in the table, regardless of what you are defining in the YAML.

This makes it easy for any user to contribute tests via the UI, while maintaining the test execution external.

{% /note %}

You can keep your YAML config as simple as follows if the table already has tests.

```yaml
processor:
  type: "orm-test-runner"
  config: {}
```

### Key reference:

- `forceUpdate`: if the test case exists (base on the test case name) for the entity, implements the strategy to follow when running the test (i.e. whether or not to update parameters)
- `testCases`: list of test cases to add to the entity referenced. Note that we will execute all the tests present in the Table.
- `name`: test case name
- `testDefinitionName`: test definition
- `columnName`: only applies to column test. The name of the column to run the test against
- `parameterValues`: parameter values of the test


The `sink` and `workflowConfig` will have the same settings as the ingestion and profiler workflow.

### Full  `yaml` config example

```yaml
source:
  type: TestSuite
  serviceName: MyAwesomeTestSuite
  sourceConfig:
    config:
      type: TestSuite
      entityFullyQualifiedName: MySQL.default.openmetadata_db.tag_usage
#     testCases: ["run_only_this_test_case"] # Optional, if not provided all tests will be executed

processor:
  type: "orm-test-runner"
  config:
    forceUpdate: false
    testCases:
      - name: column_value_length_tagFQN
        testDefinitionName: columnValueLengthsToBeBetween
        columnName: tagFQN
        parameterValues:
          - name: minLength
            value: 10
          - name: maxLength
            value: 25
      - name: table_row_count_test
        testDefinitionName: tableRowCountToEqual
        parameterValues:
          - name: value
            value: 10

sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```

### How to Run Tests

To run the tests from the CLI execute the following command
```
metadata test -c /path/to/my/config.yaml
```
