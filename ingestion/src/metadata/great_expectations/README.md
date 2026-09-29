## openmetadata-ingestion[great-expectations]
### How to use this OM module with Great Expectations

Requires Great Expectations `1.x`.

1. install open-metadata great expectations subpackage
```
pip install openmetadata-ingestion[great-expectations]
```

2. Add the action to your checkpoint

```python
import great_expectations as gx

from metadata.great_expectations.action import OpenMetadataValidationAction

context = gx.get_context()

action = OpenMetadataValidationAction(
    config_file_path="path/to/ometa/config/file/",
    database_service_name="my_service_name",
    database_name="my_database",
    schema_name="my_schema",
)

checkpoint = context.checkpoints.add(
    gx.checkpoint.checkpoint.Checkpoint(
        name="my_checkpoint",
        validation_definitions=[my_validation_definition],
        actions=[action],
    )
)
checkpoint.run()
```

`database_service_name` is optional. If you don't specify it, when looking for the table entity it will look for the service name where the table entity name exist. If the same table entity name exists in more than 1 service name it will raise an error.

`database_name` is optional as well. When it is not set, the database of the execution engine the expectations ran against is used.

3. Routing a multi-table checkpoint

When a checkpoint validates several tables — typically with query assets, whose batch spec does not
carry the table it ran against — map each expectation suite to its table:

```python
action = OpenMetadataValidationAction(
    config_file_path="path/to/ometa/config/file/",
    database_service_name="my_service_name",
    expectation_suite_table_config_map={
        "users_suite": {"database_name": "default", "schema_name": "main", "table_name": "users"},
        "orders_suite": {"database_name": "default", "schema_name": "main", "table_name": "orders"},
    },
)
```

Any suite missing from the map falls back to the `database_name` / `schema_name` / `table_name` set on the action.

The `config.yaml` file holds connection details to your Open Metadata instance, e.g.

```yml
hostPort: http://localhost:8585/api
authProvider: azure
apiVersion: v1
securityConfig:
  clientSecret: {{ env('CLIENT_SECRET') }}
  authority: my
  clientId: 123
  scopes:
    - a
    - b
```

If you are using a specific security config for your open metadata server you can check [this page](https://docs.open-metadata.org/deploy/secure-openmetadata) for the implementation details and what parameters to add to your config file.

### Test case description

The `description` set in an expectation's `meta` is carried over to the OpenMetadata test case:

```python
suite.add_expectation(
    gx.expectations.ExpectColumnValuesToNotBeNull(
        column="name",
        meta={"description": "name must never be null"},
    )
)
```
