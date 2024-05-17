---
title: Develop the Ingestion Code
slug: /developers/contribute/developing-a-new-connector/develop-ingestion-code
---

# Develop the Ingestion Code

We recommend you to take some time to understand how the Ingestion Framework works by reading [this small article](https://blog.open-metadata.org/how-we-built-the-ingestion-framework-1af0b6ff5c81).

The main takes for developing a new connector are:
- To understand that each of our Source Types (Databases, Dashboards, etc) have a Topology attached.
- To understand that the process flow is implemented as a generator chain, going through each step.

## Service Topology

The Topology defines a series of Nodes and Stages that get executed in a hierarchical way and describe how we extract the needed data from the sources.

Starting from the Root node we process the entities in a depth first approach, following the topology tree through the node's children.

From the Service Topology you can understand what methods you need to implement:
- **producer**: Methods that will fetch the entities we need to process
- **processor**: Methods that will `yield` a given `Entity`
- **post_process**: Methods that will `yield` a given `Entity` but are ran after all entities from that node were processed.

### Example - DatabaseServiceTopology

Can be found in [`ingestion/src/metadata/ingestion/source/database/database_service.py`](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/src/metadata/ingestion/source/database/database_service.py)

```python
class DatabaseServiceTopology(ServiceTopology):
    """
    Defines the hierarchy in Database Services.
    service -> db -> schema -> table.

    We could have a topology validator. We can only consume
    data that has been produced by any parent node.
    """

    root = TopologyNode(
        producer="get_services",
        stages=[
            NodeStage(
                type_=DatabaseService,
                context="database_service",
                processor="yield_create_request_database_service",
                overwrite=False,
                must_return=True,
                cache_entities=True,
            ),
        ],
        children=["database"],
        # Note how we have `yield_view_lineage` and `yield_stored_procedure_lineage`
        # as post_processed. This is because we cannot ensure proper lineage processing
        # until we have finished ingesting all the metadata from the source.
        post_process=["yield_view_lineage", "yield_procedure_lineage_and_queries"],
    )
    database = TopologyNode(
        producer="get_database_names",
        stages=[
            NodeStage(
                type_=OMetaTagAndClassification,
                context="tags",
                processor="yield_database_tag_details",
                nullable=True,
                store_all_in_context=True,
            ),
            NodeStage(
                type_=Database,
                context="database",
                processor="yield_database",
                consumer=["database_service"],
                cache_entities=True,
                use_cache=True,
            ),
        ],
        children=["databaseSchema"],
    )
    databaseSchema = TopologyNode(
        producer="get_database_schema_names",
        stages=[
            NodeStage(
                type_=OMetaTagAndClassification,
                context="tags",
                processor="yield_database_schema_tag_details",
                nullable=True,
                store_all_in_context=True,
            ),
            NodeStage(
                type_=DatabaseSchema,
                context="database_schema",
                processor="yield_database_schema",
                consumer=["database_service", "database"],
                cache_entities=True,
                use_cache=True,
            ),
        ],
        children=["table", "stored_procedure"],
        post_process=["mark_tables_as_deleted", "mark_stored_procedures_as_deleted"],
    )
    table = TopologyNode(
        producer="get_tables_name_and_type",
        stages=[
            NodeStage(
                type_=OMetaTagAndClassification,
                context="tags",
                processor="yield_table_tag_details",
                nullable=True,
                store_all_in_context=True,
            ),
            NodeStage(
                type_=Table,
                context="table",
                processor="yield_table",
                consumer=["database_service", "database", "database_schema"],
                use_cache=True,
            ),
            NodeStage(
                type_=OMetaLifeCycleData,
                processor="yield_life_cycle_data",
                nullable=True,
            ),
        ],
    )
    stored_procedure = TopologyNode(
        producer="get_stored_procedures",
        stages=[
            NodeStage(
                type_=StoredProcedure,
                context="stored_procedures",
                processor="yield_stored_procedure",
                consumer=["database_service", "database", "database_schema"],
                store_all_in_context=True,
                store_fqn=True,
                use_cache=True,
            ),
        ],
    )
```

## Service Source

Now that you understand how the Ingestion Process works, you need to understand the Service Source.

A Service Source is an abstract class that is the base for any Connector from that Source Type.
They tend to have a lot of methods and are pretty overwhelming at first glance but you don't need to worry. You'll need to check which abstract methods you need to implement in your connector.

{% note %}
**Hint**

You can start slow, yielding nothing with `yield from []` to see the whole flow running and then slowly implement the features you want.

On this note, also remember that you don't need to implement everything. You could contribute by start and implement just the Metadata Extraction features but without extracting Owner/Tags or deal with Lineage.
{% /note %}

### Example - DatabaseServiceSource

Can be found in [`ingestion/src/metadata/ingestion/source/database/database_service.py`](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/src/metadata/ingestion/source/database/database_service.py)
```python
class DatabaseServiceSource(
    TopologyRunnerMixin, Source, ABC
):  # pylint: disable=too-many-public-methods
    """
    Base class for Database Services.
    It implements the topology and context.
    """

    source_config: DatabaseServiceMetadataPipeline
    config: WorkflowSource
    database_source_state: Set = set()
    stored_procedure_source_state: Set = set()
    # Big union of types we want to fetch dynamically
    service_connection: DatabaseConnection.__fields__["config"].type_

    # When processing the database, the source will update the inspector if needed
    inspector: Inspector

    topology = DatabaseServiceTopology()
    context = TopologyContext.create(topology)

    @property
    def name(self) -> str:
        return self.service_connection.type.name

    def prepare(self):
        """By default, there is no preparation needed"""

    def get_services(self) -> Iterable[WorkflowSource]:
        yield self.config

    def yield_create_request_database_service(
        self, config: WorkflowSource
    ) -> Iterable[Either[CreateDatabaseServiceRequest]]:
        yield Either(
            right=self.metadata.get_create_service_from_source(
                entity=DatabaseService, config=config
            )
        )

    @abstractmethod
    def get_database_names(self) -> Iterable[str]:
        """
        Prepares the database name to be sent to stage.
        Filtering happens here.
        """

    @abstractmethod
    def get_database_schema_names(self) -> Iterable[str]:
        """
        Prepares the database schema name to be sent to stage.
        Filtering happens here.
        """

    @abstractmethod
    def get_tables_name_and_type(self) -> Optional[Iterable[Tuple[str, str]]]:
        """
        Prepares the table name to be sent to stage.
        Filtering happens here.
        """

    @abstractmethod
    def yield_database(
        self, database_name: str
    ) -> Iterable[Either[CreateDatabaseRequest]]:
        """
        From topology.
        Prepare a database request and pass it to the sink.

        Also, update the self.inspector value to the current db.
        """

    @abstractmethod
    def yield_database_schema(
        self, schema_name: str
    ) -> Iterable[Either[CreateDatabaseSchemaRequest]]:
        """
        From topology.
        Prepare a database request and pass it to the sink.

        Also, update the self.inspector value to the current db.
        """

    @abstractmethod
    def yield_tag(
        self, schema_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        From topology. To be run for each schema
        """

    def yield_database_tag(
        self, database_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        From topology. To be run for each database
        """

    def yield_table_tags(
        self, table_name_and_type: Tuple[str, TableType]
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        From topology. To be run for each table
        """

    def yield_table_tag_details(
        self, table_name_and_type: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        From topology. To be run for each table
        """
        if self.source_config.includeTags:
            yield from self.yield_table_tags(table_name_and_type) or []

    def yield_database_schema_tag_details(
        self, schema_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        From topology. To be run for each schema
        """
        if self.source_config.includeTags:
            yield from self.yield_tag(schema_name) or []

    def yield_database_tag_details(
        self, database_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        From topology. To be run for each database
        """
        if self.source_config.includeTags:
            yield from self.yield_database_tag(database_name) or []

    @abstractmethod
    def yield_view_lineage(self) -> Iterable[Either[AddLineageRequest]]:
        """
        From topology.
        Parses view definition to get lineage information
        """

    def update_table_constraints(
        self, table_constraints: List[TableConstraint], foreign_columns: []
    ) -> List[TableConstraint]:
        """
        process the table constraints of all tables
        transform SQLAlchemy returned foreign_columns into list of TableConstraint.
        """

    @abstractmethod
    def yield_table(
        self, table_name_and_type: Tuple[str, TableType]
    ) -> Iterable[Either[CreateTableRequest]]:
        """
        From topology.
        Prepare a table request and pass it to the sink.

        Also, update the self.inspector value to the current db.
        """

    @abstractmethod
    def get_stored_procedures(self) -> Iterable[Any]:
        """List stored procedures to process"""

    @abstractmethod
    def yield_stored_procedure(
        self, stored_procedure: Any
    ) -> Iterable[Either[CreateStoredProcedureRequest]]:
        """Process the stored procedure information"""

    @abstractmethod
    def yield_procedure_lineage_and_queries(
        self,
    ) -> Iterable[Either[Union[AddLineageRequest, CreateQueryRequest]]]:
        """Extracts the lineage information from Stored Procedures"""

    def get_raw_database_schema_names(self) -> Iterable[str]:
        """
        fetch all schema names without any filtering.
        """
        yield from self.get_database_schema_names()

    def get_tag_by_fqn(self, entity_fqn: str) -> Optional[List[TagLabel]]:
        """
        Pick up the tags registered in the context
        searching by entity FQN
        """

        tag_labels = []
        for tag_and_category in self.context.tags or []:
            if tag_and_category.fqn and tag_and_category.fqn.__root__ == entity_fqn:
                tag_label = get_tag_label(
                    metadata=self.metadata,
                    tag_name=tag_and_category.tag_request.name.__root__,
                    classification_name=tag_and_category.classification_request.name.__root__,
                )
                if tag_label:
                    tag_labels.append(tag_label)
        return tag_labels or None

    def get_database_tag_labels(self, database_name: str) -> Optional[List[TagLabel]]:
        """
        Method to get schema tags
        This will only get executed if the tags context
        is properly informed
        """
        database_fqn = fqn.build(
            self.metadata,
            entity_type=Database,
            service_name=self.context.database_service,
            database_name=database_name,
        )
        return self.get_tag_by_fqn(entity_fqn=database_fqn)

    def get_schema_tag_labels(self, schema_name: str) -> Optional[List[TagLabel]]:
        """
        Method to get schema tags
        This will only get executed if the tags context
        is properly informed
        """
        schema_fqn = fqn.build(
            self.metadata,
            entity_type=DatabaseSchema,
            service_name=self.context.database_service,
            database_name=self.context.database,
            schema_name=schema_name,
        )
        return self.get_tag_by_fqn(entity_fqn=schema_fqn)

    def get_tag_labels(self, table_name: str) -> Optional[List[TagLabel]]:
        """
        This will only get executed if the tags context
        is properly informed
        """
        table_fqn = fqn.build(
            self.metadata,
            entity_type=Table,
            service_name=self.context.database_service,
            database_name=self.context.database,
            schema_name=self.context.database_schema,
            table_name=table_name,
            skip_es_search=True,
        )
        return self.get_tag_by_fqn(entity_fqn=table_fqn)

    def get_column_tag_labels(
        self, table_name: str, column: dict
    ) -> Optional[List[TagLabel]]:
        """
        This will only get executed if the tags context
        is properly informed
        """
        col_fqn = fqn.build(
            self.metadata,
            entity_type=Column,
            service_name=self.context.database_service,
            database_name=self.context.database,
            schema_name=self.context.database_schema,
            table_name=table_name,
            column_name=column["name"],
        )
        return self.get_tag_by_fqn(entity_fqn=col_fqn)

    def register_record(self, table_request: CreateTableRequest) -> None:
        """
        Mark the table record as scanned and update the database_source_state
        """
        table_fqn = fqn.build(
            self.metadata,
            entity_type=Table,
            service_name=self.context.database_service,
            database_name=self.context.database,
            schema_name=self.context.database_schema,
            table_name=table_request.name.__root__,
            skip_es_search=True,
        )

        self.database_source_state.add(table_fqn)

    def register_record_stored_proc_request(
        self, stored_proc_request: CreateStoredProcedureRequest
    ) -> None:
        """
        Mark the table record as scanned and update the database_source_state
        """
        table_fqn = fqn.build(
            self.metadata,
            entity_type=StoredProcedure,
            service_name=self.context.database_service,
            database_name=self.context.database,
            schema_name=self.context.database_schema,
            procedure_name=stored_proc_request.name.__root__,
        )

        self.stored_procedure_source_state.add(table_fqn)

    def _get_filtered_schema_names(
        self, return_fqn: bool = False, add_to_status: bool = True
    ) -> Iterable[str]:
        for schema_name in self.get_raw_database_schema_names():
            schema_fqn = fqn.build(
                self.metadata,
                entity_type=DatabaseSchema,
                service_name=self.context.database_service,
                database_name=self.context.database,
                schema_name=schema_name,
            )
            if filter_by_schema(
                self.source_config.schemaFilterPattern,
                schema_fqn if self.source_config.useFqnForFiltering else schema_name,
            ):
                if add_to_status:
                    self.status.filter(schema_fqn, "Schema Filtered Out")
                continue
            yield schema_fqn if return_fqn else schema_name

    def get_owner_ref(self, table_name: str) -> Optional[EntityReference]:
        """
        Method to process the table owners
        """
        try:
            if self.source_config.includeOwners:
                owner_name = self.inspector.get_table_owner(
                    connection=self.connection,  # pylint: disable=no-member
                    table_name=table_name,
                    schema=self.context.database_schema,
                )
                owner_ref = self.metadata.get_reference_by_name(name=owner_name)
                return owner_ref
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error processing owner for table {table_name}: {exc}")
        return None

    def mark_tables_as_deleted(self):
        """
        Use the current inspector to mark tables as deleted
        """
        if not self.context.__dict__.get("database"):
            raise ValueError(
                "No Database found in the context. We cannot run the table deletion."
            )

        if self.source_config.markDeletedTables:
            logger.info(
                f"Mark Deleted Tables set to True. Processing database [{self.context.database}]"
            )
            schema_fqn_list = self._get_filtered_schema_names(
                return_fqn=True, add_to_status=False
            )

            for schema_fqn in schema_fqn_list:
                yield from delete_entity_from_source(
                    metadata=self.metadata,
                    entity_type=Table,
                    entity_source_state=self.database_source_state,
                    mark_deleted_entity=self.source_config.markDeletedTables,
                    params={"database": schema_fqn},
                )

    def mark_stored_procedures_as_deleted(self):
        """
        Use the current inspector to mark Stored Procedures as deleted
        """
        if self.source_config.markDeletedStoredProcedures:
            logger.info(
                f"Mark Deleted Stored Procedures Processing database [{self.context.database}]"
            )

            schema_fqn_list = self._get_filtered_schema_names(
                return_fqn=True, add_to_status=False
            )

            for schema_fqn in schema_fqn_list:
                yield from delete_entity_from_source(
                    metadata=self.metadata,
                    entity_type=StoredProcedure,
                    entity_source_state=self.stored_procedure_source_state,
                    mark_deleted_entity=self.source_config.markDeletedStoredProcedures,
                    params={"databaseSchema": schema_fqn},
                )

    def yield_life_cycle_data(self, _) -> Iterable[Either[OMetaLifeCycleData]]:
        """
        Get the life cycle data of the table
        """

    def test_connection(self) -> None:
        test_connection_fn = get_test_connection_fn(self.service_connection)
        test_connection_fn(self.metadata, self.connection_obj, self.service_connection)
```

## Next Step

With the Code ready to go, we can now proceed to make a small change in the UI to be able to configure the Connector properly from there.


{%inlineCallout
  color="violet-70"
  bold="Apply the UI Changes"
  icon="MdArrowForward"
  href="/developers/contribute/developing-a-new-connector/apply-ui-changes"%}
  Learn what you need to do to be able see the Connector properly in the UI
{%/inlineCallout%}
