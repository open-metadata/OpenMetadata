## OpenMetadata ORM Profiler

This Profiler is based on SQLAlchemy ORM module. As we have the source tables' metadata already ingested,
we can dynamically convert OpenMetadata Tables to SQLAlchemy Tables.

### 1. Profiler workflow
The whole process is structured as follows:
1. A Profiling workflows runs specifying which `Entities` to analyze. The main arguments here are the
    entities to get from the API + the SQL Config.
2. Each OpenMetadata table gets mapped to its equivalent SQLAlchemy Table.
3. We pick up the required SQLAlchemy `Engine` based on the SQL Config from the JSON.
4. We define a set of queries to run based on the SQLAlchemy Table.
5. If some expressions are not universal, we can `compile` specific expressions for the required `DatabaseServiceType`.
    This allows us to not have any logic branching, as all the expressions will be safely built beforehand. The
    `Engine` will then know what to use in each case.
6. Profiling results are available in `profiler.results` property. This property returns a `dict` with
    the data of all the metrics sent as input.
7. We can validate the `Profile` result with a `ProfileValidator`.

### 2. Using profiler sampling feature
If you want to limit the size of the data the profiler runs against, you can use the sampling feature. You have 2 options:
1. Define your sampling at the workflow level in `source -> sourceConfig -> config -> sampleProfile`
2. Define you sampling at the table level `processor -> config -> tableConfig -> profileSample`

### 3. Specifying number of threads
OpenMetadata profiler leverage multithreading to speed up computation of metrics. You can specify the number of threads to use in `source -> sourceConfig -> config -> threadCount`. Setting this number to 1 will result in the profiler running on a single thread.

### 4. Profiler `yaml` config file example
```yaml
source:
  type: redshift
  serviceName: local_redshift
  serviceConnection:
    config:
      hostPort: host:1234
      username: <username>
      password: <password>
      database: <database>
      type: Redshift
  sourceConfig:
    config:
      type: Profiler
      generateSampleData: true
      sampleProfile: 70
      databaseFilterPattern: 
        includes: 
          - <database>
      schemaFilterPattern:
        includes: 
          - <schema>
      tableFilterPattern:
        includes: 
          - orders
          - customers

processor:
   type: "orm-profiler"
   config:
    tableConfig:
      - fullyQualifiedName: local_redshift.<database>.<schema>.orders
        profileSample: 85
        columnConfig:
          includeColumns:
            - columnName: order_id
            - columnName: order_date
            - columnName: status
      - fullyQualifiedName: local_redshift.<database>.<schema>.orders_new
        profileSample: 55       

sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: no-auth
```

To run this file from the CLI you can simply run

```zsh
metadata profile -c path/to/config.yaml
```

## Development

All classes should use `logger = logging.getLogger("Profiler")`. This way we can easily find logs specific
to the Profiler.
