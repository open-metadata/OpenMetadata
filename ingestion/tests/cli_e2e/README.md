# E2E CLI tests

### How to add a connector

1. Add an ingestion YAML file with the service and the credentials of it. Use when possible a Dockerized environment, otherwise, remember to use environment
variables for sensitive information in case of external resources. On each test, the YAML file will be modified by the `build_yaml` method which will create
a copy of the file and prepare it for the tests. This way, we avoid adding (and maintaining) an extra YAML for each test.

2. The `{connector}` name must be added in the list of connectors in the GH Action: `.github/workflows/py-cli-e2e-tests.yml`

```yaml

jobs:
  py-cli-e2e-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        py-version: ['3.9']
        e2e-test: ['mysql', '{connector}']
```

## Database connectors

Currently, it runs CLI tests for any database connector. 

- `./base/test_cli_db` has 8 test definitions for database connectors. It is an abstract class.  
- `./common/test_cli_db` is another abstract class for those connectors whose sources implement the `CommonDbSourceService` class. 
- It partially implements some methods from `test_cli_db_base`.
- `test_cli_{connector}` is the specific connector test. More tests apart the ones implemented by the `./base/test_cli_db` can be run inside this class.

### How to add a database connector

1. Use `test_cli_mysql.py` as example. Your connector E2E CLI test must follow the name convention: `test_cli_{connector}.py` and the test 
class must extend from `CliCommonDB.TestSuite` if the connector's source implement the `CommonDbSourceService` class, otherwise, from `CliDBBase.TestSuite`.

2. If it is a database connector whose source implement the `CommonDbSourceService` class, these methods must be overwritten:

```python
    # the connector name
    def get_connector_name() -> str:
        return "{connector}"

    # create using the SQLAlchemy engine a table, a view associated to it and add some rows to the table
    def create_table_and_view(self) -> None:
        pass
    
    # delete the view and table created using the SQLAlchemy engine
    def delete_table_and_view(self) -> None:
        pass
    
    # expected tables to be ingested
    def expected_tables() -> int:
        pass

    # numbers of rows added to the created table
    def inserted_rows_count(self) -> int:
        pass

    # created table FQN
    def fqn_created_table() -> str:
        pass

    # list of schemas patterns to be included in the schema filters
    def get_includes_schemas() -> List[str]:
        pass

    # list of table patterns to be included in the table filters
    def get_includes_tables() -> List[str]:
        pass

    # list of table patterns to be excluded in the table filters
    def get_excludes_tables() -> List[str]:
        pass
    
    # expected number of schemas to be filtered with the use of includes (get_includes_schemas)
    def expected_filtered_schema_includes() -> int:
        pass
    
    # expected number of schemas to be filtered with the use of excludes (get_includes_schemas)
    def expected_filtered_schema_excludes() -> int:
        pass

    # expected number of tables to be filtered with the use of includes (get_includes_tables)
    def expected_filtered_table_includes() -> int:
        pass

    # expected number of tables to be filtered with the use of excludes (get_includes_tables)
    def expected_filtered_table_excludes() -> int:
        pass

    # expected number of filter entities with the use of a mix of filters (get_includes_schemas, get_includes_tables, get_excludes_tables)
    def expected_filtered_mix() -> int:
        pass
```

## Dashboard connectors

Currently, it runs CLI tests for any database connector. 

- `./base/test_cli_dashboard` has 3 test definitions for database connectors. It is an abstract class.  
- `./common/test_cli_dashboard` is another class that partially implements some methods from `test_cli_dashboard_base`.
- `test_cli_{connector}` is the specific connector test. More tests apart the ones implemented by the `./base/test_cli_dashboard` can be run inside this class.

### How to add a dashboard connector

1. Use `test_cli_tableau.py` as example. Your connector E2E CLI test must follow the name convention: `test_cli_{connector}.py` and the test 
class must extend from `CliCommonDashboard.TestSuite`.

2. These methods must be overwritten:

```python
    # in case we want to do something before running the tests
    def prepare() -> None:
        pass
    
    # the connector name
    def get_connector_name() -> str:
        return "{connector}"

    # the dashboard to include in filters
    def get_includes_dashboards() -> List[str]:
        pass

    # the dashboard to exclude in filters
    def get_excludes_dashboards() -> List[str]:
        pass

    # the charts to include in filters
    def get_includes_charts() -> List[str]:
        pass

    # the charts to exclude in filters
    def get_excludes_charts() -> List[str]:
        pass

    # the data models to include in filters
    def get_includes_datamodels() -> List[str]:
        pass
    
    # the data models to exclude in filters
    def get_excludes_datamodels() -> List[str]:
        pass
    
    # expected number of entities to be ingested
    def expected_entities() -> int:
        pass
    
    # expected number of lineage to be ingested
    def expected_lineage() -> int:
        pass
    
    # expected number of tags to be ingested
    def expected_tags() -> int:
        pass
    
    # expected number of entities to be filtered when testing include tags and data models options
    def expected_not_included_entities() -> int:
        pass

    # expected number of entities to be filtered in the sink step when testing include tags and data models options
    def expected_not_included_sink_entities() -> int:
        pass
    
    # expected number of entities to be filtered out when testing mix of filters
    def expected_filtered_mix() -> int:
        pass
        
    # expected number of entities to be filtered out in the sink step when testing mix of filters
     def expected_filtered_sink_mix() -> int:
        pass
```



