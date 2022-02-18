# WIP - OpenMetadata ORM Profiler

This Profiler is based on SQLAlchemy ORM module. As we have the source tables' metadata already ingested,
we can dynamically convert OpenMetadata Tables to SQLAlchemy Tables.

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

## Development

All classes should use `logger = logging.getLogger("Profiler")`. This way we can easily find logs specific
to the Profiler.

## TODO
- query on sample
- define validation structure on custom query
- define validation structure on Profiling
