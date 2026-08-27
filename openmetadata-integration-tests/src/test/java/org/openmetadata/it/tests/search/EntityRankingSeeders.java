package org.openmetadata.it.tests.search;

import java.net.URI;
import java.util.List;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.tests.search.EntitySeeder.Placement;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateAPICollection;
import org.openmetadata.schema.api.data.CreateAPIEndpoint;
import org.openmetadata.schema.api.data.CreateChart;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.api.data.CreateDashboardDataModel.DashboardServiceType;
import org.openmetadata.schema.api.data.CreateDirectory;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.data.CreateMlModel;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.data.CreateQuery;
import org.openmetadata.schema.api.data.CreateSearchIndex;
import org.openmetadata.schema.api.data.CreateStoredProcedure;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.api.data.StoredProcedureCode;
import org.openmetadata.schema.api.services.CreateApiService;
import org.openmetadata.schema.api.services.CreateDashboardService;
import org.openmetadata.schema.api.services.CreateDriveService;
import org.openmetadata.schema.api.services.CreateDriveService.DriveServiceType;
import org.openmetadata.schema.api.services.CreateMessagingService;
import org.openmetadata.schema.api.services.CreateMessagingService.MessagingServiceType;
import org.openmetadata.schema.api.services.CreateMlModelService;
import org.openmetadata.schema.api.services.CreatePipelineService;
import org.openmetadata.schema.api.services.CreatePipelineService.PipelineServiceType;
import org.openmetadata.schema.api.services.CreateSearchService;
import org.openmetadata.schema.api.services.CreateStorageService;
import org.openmetadata.schema.entity.services.ApiService;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.SearchService;
import org.openmetadata.schema.security.credentials.AWSCredentials;
import org.openmetadata.schema.services.connections.dashboard.CustomDashboardConnection;
import org.openmetadata.schema.services.connections.dashboard.CustomDashboardConnection.CustomDashboardType;
import org.openmetadata.schema.services.connections.dashboard.LookerConnection;
import org.openmetadata.schema.services.connections.drive.GoogleDriveConnection;
import org.openmetadata.schema.services.connections.messaging.KafkaConnection;
import org.openmetadata.schema.services.connections.mlmodel.SklearnConnection;
import org.openmetadata.schema.services.connections.pipeline.AirflowConnection;
import org.openmetadata.schema.services.connections.storage.S3Connection;
import org.openmetadata.schema.type.APISchema;
import org.openmetadata.schema.type.ChartType;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContainerDataModel;
import org.openmetadata.schema.type.DashboardConnection;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.schema.type.DriveConnection;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.MessagingConnection;
import org.openmetadata.schema.type.MlFeature;
import org.openmetadata.schema.type.MlFeatureDataType;
import org.openmetadata.schema.type.MlModelConnection;
import org.openmetadata.schema.type.PipelineConnection;
import org.openmetadata.schema.type.SchemaType;
import org.openmetadata.schema.type.SearchIndexDataType;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.type.StorageConnection;
import org.openmetadata.schema.type.StoredProcedureLanguage;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.Task;
import org.openmetadata.sdk.client.OpenMetadataClient;

/** Registry of one {@link EntitySeeder} per searchable asset type. */
final class EntityRankingSeeders {

  private EntityRankingSeeders() {}

  static List<EntitySeeder> all() {
    return List.of(
        new TableSeeder(),
        new DashboardSeeder(),
        new TopicSeeder(),
        new PipelineSeeder(),
        new MlModelSeeder(),
        new ContainerSeeder(),
        new DashboardDataModelSeeder(),
        new QuerySeeder(),
        new StoredProcedureSeeder(),
        new SearchIndexSeeder(),
        new GlossaryTermSeeder(),
        new MetricSeeder(),
        new ApiEndpointSeeder(),
        new DirectorySeeder());
  }

  static final class TableSeeder implements EntitySeeder {
    @Override
    public String entityType() {
      return "table";
    }

    @Override
    public String index() {
      return "table_search_index";
    }

    @Override
    public boolean hasDistinctive() {
      return true; // columns.name
    }

    @Override
    public String setup(OpenMetadataClient client, TestNamespace ns) {
      return RankingSupport.createSchemaFqn(ns);
    }

    @Override
    public String seed(
        OpenMetadataClient client,
        TestNamespace ns,
        String parent,
        String token,
        Placement placement,
        boolean tier1) {
      CreateTable create =
          new CreateTable()
              .withName(EntitySeeder.nameFor(ns, token, placement))
              .withDatabaseSchema(parent)
              .withDisplayName(EntitySeeder.displayNameFor(ns, token, placement))
              .withDescription(EntitySeeder.descriptionFor(ns, token, placement))
              .withColumns(
                  List.of(
                      new Column()
                          .withName(EntitySeeder.distinctiveFor(ns, token, placement))
                          .withDataType(ColumnDataType.VARCHAR)
                          .withDataLength(64)));
      List<TagLabel> tags = EntitySeeder.tierTags(tier1);
      if (tags != null) {
        create.withTags(tags);
      }
      return client.tables().create(create).getName();
    }
  }

  static final class DashboardSeeder implements EntitySeeder {
    @Override
    public String entityType() {
      return "dashboard";
    }

    @Override
    public String index() {
      return "dashboard_search_index";
    }

    @Override
    public boolean hasDistinctive() {
      return true; // charts.name (chart created + attached via withCharts)
    }

    @Override
    public String setup(OpenMetadataClient client, TestNamespace ns) {
      DashboardConnection connection =
          new DashboardConnection()
              .withConfig(
                  new CustomDashboardConnection().withType(CustomDashboardType.CUSTOM_DASHBOARD));
      CreateDashboardService createService =
          new CreateDashboardService()
              .withName(ns.prefix("dash_svc_" + ns.shortPrefix()))
              .withServiceType(DashboardServiceType.CustomDashboard)
              .withConnection(connection);
      return client.dashboardServices().create(createService).getFullyQualifiedName();
    }

    @Override
    public String seed(
        OpenMetadataClient client,
        TestNamespace ns,
        String parent,
        String token,
        Placement placement,
        boolean tier1) {
      CreateDashboard create =
          new CreateDashboard()
              .withName(EntitySeeder.nameFor(ns, token, placement))
              .withService(parent)
              .withDisplayName(EntitySeeder.displayNameFor(ns, token, placement))
              .withDescription(EntitySeeder.descriptionFor(ns, token, placement));
      if (placement == Placement.DISTINCTIVE) {
        create.withCharts(List.of(createChart(client, ns, parent, token, placement)));
      }
      List<TagLabel> tags = EntitySeeder.tierTags(tier1);
      if (tags != null) {
        create.withTags(tags);
      }
      return client.dashboards().create(create).getName();
    }

    private String createChart(
        OpenMetadataClient client,
        TestNamespace ns,
        String service,
        String token,
        Placement placement) {
      CreateChart createChart =
          new CreateChart()
              .withName(EntitySeeder.distinctiveFor(ns, token, placement))
              .withService(service)
              .withChartType(ChartType.Other);
      return client.charts().create(createChart).getFullyQualifiedName();
    }
  }

  static final class TopicSeeder implements EntitySeeder {
    @Override
    public String entityType() {
      return "topic";
    }

    @Override
    public String index() {
      return "topic_search_index";
    }

    @Override
    public boolean hasDistinctive() {
      return true; // messageSchema.schemaFields.name
    }

    @Override
    public String setup(OpenMetadataClient client, TestNamespace ns) {
      KafkaConnection kafkaConn = new KafkaConnection().withBootstrapServers("localhost:9092");
      CreateMessagingService service =
          new CreateMessagingService()
              .withName(ns.prefix("msg-svc-" + ns.shortPrefix()))
              .withServiceType(MessagingServiceType.Kafka)
              .withConnection(new MessagingConnection().withConfig(kafkaConn));
      return client.messagingServices().create(service).getFullyQualifiedName();
    }

    @Override
    public String seed(
        OpenMetadataClient client,
        TestNamespace ns,
        String parent,
        String token,
        Placement placement,
        boolean tier1) {
      MessageSchema schema =
          new MessageSchema()
              .withSchemaType(SchemaType.JSON)
              .withSchemaFields(
                  List.of(
                      new Field()
                          .withName(EntitySeeder.distinctiveFor(ns, token, placement))
                          .withDataType(FieldDataType.STRING)));
      CreateTopic create =
          new CreateTopic()
              .withName(EntitySeeder.nameFor(ns, token, placement))
              .withService(parent)
              .withPartitions(1)
              .withDisplayName(EntitySeeder.displayNameFor(ns, token, placement))
              .withDescription(EntitySeeder.descriptionFor(ns, token, placement))
              .withMessageSchema(schema);
      List<TagLabel> tags = EntitySeeder.tierTags(tier1);
      if (tags != null) {
        create.withTags(tags);
      }
      return client.topics().create(create).getName();
    }
  }

  static final class PipelineSeeder implements EntitySeeder {
    @Override
    public String entityType() {
      return "pipeline";
    }

    @Override
    public String index() {
      return "pipeline_search_index";
    }

    @Override
    public boolean hasDistinctive() {
      return true; // tasks.name
    }

    @Override
    public String setup(OpenMetadataClient client, TestNamespace ns) {
      AirflowConnection airflow =
          new AirflowConnection().withHostPort(URI.create("http://localhost:8080"));
      CreatePipelineService service =
          new CreatePipelineService()
              .withName(ns.prefix("pipelineService_" + ns.uniqueShortId()))
              .withServiceType(PipelineServiceType.Airflow)
              .withConnection(new PipelineConnection().withConfig(airflow))
              .withDescription("Test Airflow service");
      return client.pipelineServices().create(service).getFullyQualifiedName();
    }

    @Override
    public String seed(
        OpenMetadataClient client,
        TestNamespace ns,
        String parent,
        String token,
        Placement placement,
        boolean tier1) {
      CreatePipeline create =
          new CreatePipeline()
              .withName(EntitySeeder.nameFor(ns, token, placement))
              .withService(parent)
              .withDisplayName(EntitySeeder.displayNameFor(ns, token, placement))
              .withDescription(EntitySeeder.descriptionFor(ns, token, placement))
              .withTasks(
                  List.of(new Task().withName(EntitySeeder.distinctiveFor(ns, token, placement))));
      List<TagLabel> tags = EntitySeeder.tierTags(tier1);
      if (tags != null) {
        create.withTags(tags);
      }
      return client.pipelines().create(create).getName();
    }
  }

  static final class MlModelSeeder implements EntitySeeder {
    @Override
    public String entityType() {
      return "mlmodel";
    }

    @Override
    public String index() {
      return "mlmodel_search_index";
    }

    @Override
    public boolean hasDistinctive() {
      return true; // mlFeatures.name
    }

    @Override
    public String setup(OpenMetadataClient client, TestNamespace ns) {
      SklearnConnection config =
          new SklearnConnection().withType(SklearnConnection.SklearnType.SKLEARN);
      CreateMlModelService service =
          new CreateMlModelService()
              .withName(ns.prefix("mlsvc-" + ns.uniqueShortId()))
              .withServiceType(CreateMlModelService.MlModelServiceType.Sklearn)
              .withConnection(new MlModelConnection().withConfig(config));
      return client.mlModelServices().create(service).getFullyQualifiedName();
    }

    @Override
    public String seed(
        OpenMetadataClient client,
        TestNamespace ns,
        String parent,
        String token,
        Placement placement,
        boolean tier1) {
      CreateMlModel create =
          new CreateMlModel()
              .withName(EntitySeeder.nameFor(ns, token, placement))
              .withService(parent)
              .withAlgorithm("regression")
              .withDisplayName(EntitySeeder.displayNameFor(ns, token, placement))
              .withDescription(EntitySeeder.descriptionFor(ns, token, placement))
              .withMlFeatures(
                  List.of(
                      new MlFeature()
                          .withName(EntitySeeder.distinctiveFor(ns, token, placement))
                          .withDataType(MlFeatureDataType.Numerical)));
      List<TagLabel> tags = EntitySeeder.tierTags(tier1);
      if (tags != null) {
        create.withTags(tags);
      }
      return client.mlModels().create(create).getName();
    }
  }

  static final class ContainerSeeder implements EntitySeeder {
    @Override
    public String entityType() {
      return "container";
    }

    @Override
    public String index() {
      return "container_search_index";
    }

    @Override
    public boolean hasDistinctive() {
      return true; // dataModel.columns.name
    }

    @Override
    public String setup(OpenMetadataClient client, TestNamespace ns) {
      AWSCredentials awsCreds = new AWSCredentials().withAwsRegion("us-east-1");
      S3Connection s3Conn = new S3Connection().withAwsConfig(awsCreds);
      CreateStorageService service =
          new CreateStorageService()
              .withName(ns.prefix("search_storage_svc"))
              .withServiceType(CreateStorageService.StorageServiceType.S3)
              .withConnection(new StorageConnection().withConfig(s3Conn));
      return client.storageServices().create(service).getFullyQualifiedName();
    }

    @Override
    public String seed(
        OpenMetadataClient client,
        TestNamespace ns,
        String parent,
        String token,
        Placement placement,
        boolean tier1) {
      CreateContainer create =
          new CreateContainer()
              .withName(EntitySeeder.nameFor(ns, token, placement))
              .withService(parent)
              .withDisplayName(EntitySeeder.displayNameFor(ns, token, placement))
              .withDescription(EntitySeeder.descriptionFor(ns, token, placement))
              .withDataModel(
                  new ContainerDataModel()
                      .withColumns(
                          List.of(
                              new Column()
                                  .withName(EntitySeeder.distinctiveFor(ns, token, placement))
                                  .withDataType(ColumnDataType.VARCHAR)
                                  .withDataLength(64))));
      List<TagLabel> tags = EntitySeeder.tierTags(tier1);
      if (tags != null) {
        create.withTags(tags);
      }
      return client.containers().create(create).getName();
    }
  }

  static final class DashboardDataModelSeeder implements EntitySeeder {
    @Override
    public String entityType() {
      return "dashboardDataModel";
    }

    @Override
    public String index() {
      return "dashboard_data_model_search_index";
    }

    @Override
    public boolean hasDistinctive() {
      return true; // columns.name
    }

    @Override
    public String setup(OpenMetadataClient client, TestNamespace ns) {
      LookerConnection lookerConn =
          new LookerConnection()
              .withHostPort(URI.create("http://localhost:9999"))
              .withClientId("test-client");
      CreateDashboardService request =
          new CreateDashboardService()
              .withName(ns.prefix("lookerService-" + ns.uniqueShortId()))
              .withServiceType(DashboardServiceType.Looker)
              .withConnection(new DashboardConnection().withConfig(lookerConn))
              .withDescription("Test Looker service");
      DashboardService service = client.dashboardServices().create(request);
      return service.getFullyQualifiedName();
    }

    @Override
    public String seed(
        OpenMetadataClient client,
        TestNamespace ns,
        String parent,
        String token,
        Placement placement,
        boolean tier1) {
      CreateDashboardDataModel create =
          new CreateDashboardDataModel()
              .withName(EntitySeeder.nameFor(ns, token, placement))
              .withService(parent)
              .withDisplayName(EntitySeeder.displayNameFor(ns, token, placement))
              .withDescription(EntitySeeder.descriptionFor(ns, token, placement))
              .withDataModelType(DataModelType.LookMlView)
              .withColumns(
                  List.of(
                      new Column()
                          .withName(EntitySeeder.distinctiveFor(ns, token, placement))
                          .withDataType(ColumnDataType.VARCHAR)
                          .withDataLength(64)));
      List<TagLabel> tags = EntitySeeder.tierTags(tier1);
      if (tags != null) {
        create.withTags(tags);
      }
      return client.dashboardDataModels().create(create).getName();
    }
  }

  static final class QuerySeeder implements EntitySeeder {
    @Override
    public String entityType() {
      return "query";
    }

    @Override
    public String index() {
      return "query_search_index";
    }

    @Override
    public boolean hasDistinctive() {
      return false; // queryText/SQL not matched by the default query-index search;
      // ranking still covers name/displayName/description/tier
    }

    @Override
    public String setup(OpenMetadataClient client, TestNamespace ns) {
      return DatabaseServiceTestFactory.createPostgres(ns).getFullyQualifiedName();
    }

    @Override
    public String seed(
        OpenMetadataClient client,
        TestNamespace ns,
        String parent,
        String token,
        Placement placement,
        boolean tier1) {
      CreateQuery create =
          new CreateQuery()
              .withName(EntitySeeder.nameFor(ns, token, placement))
              .withDisplayName(EntitySeeder.displayNameFor(ns, token, placement))
              .withDescription(EntitySeeder.descriptionFor(ns, token, placement))
              .withService(parent)
              .withQuery("SELECT " + EntitySeeder.distinctiveFor(ns, token, placement) + " FROM t");
      List<TagLabel> tags = EntitySeeder.tierTags(tier1);
      if (tags != null) {
        create.withTags(tags);
      }
      return client.queries().create(create).getName();
    }
  }

  static final class StoredProcedureSeeder implements EntitySeeder {
    @Override
    public String entityType() {
      return "storedProcedure";
    }

    @Override
    public String index() {
      return "stored_procedure_search_index";
    }

    @Override
    public String setup(OpenMetadataClient client, TestNamespace ns) {
      return RankingSupport.createSchemaFqn(ns);
    }

    @Override
    public String seed(
        OpenMetadataClient client,
        TestNamespace ns,
        String parent,
        String token,
        Placement placement,
        boolean tier1) {
      CreateStoredProcedure create =
          new CreateStoredProcedure()
              .withName(EntitySeeder.nameFor(ns, token, placement))
              .withDatabaseSchema(parent)
              .withDisplayName(EntitySeeder.displayNameFor(ns, token, placement))
              .withDescription(EntitySeeder.descriptionFor(ns, token, placement))
              .withStoredProcedureCode(
                  new StoredProcedureCode()
                      .withLanguage(StoredProcedureLanguage.SQL)
                      .withCode("SELECT 1;"));
      List<TagLabel> tags = EntitySeeder.tierTags(tier1);
      if (tags != null) {
        create.withTags(tags);
      }
      return client.storedProcedures().create(create).getName();
    }
  }

  static final class SearchIndexSeeder implements EntitySeeder {
    @Override
    public String entityType() {
      return "searchIndex";
    }

    @Override
    public String index() {
      return "search_entity_search_index";
    }

    @Override
    public String setup(OpenMetadataClient client, TestNamespace ns) {
      CreateSearchService service =
          new CreateSearchService()
              .withName(ns.prefix("search-svc-" + ns.uniqueShortId()))
              .withServiceType(CreateSearchService.SearchServiceType.ElasticSearch);
      SearchService created = client.searchServices().create(service);
      return created.getFullyQualifiedName();
    }

    @Override
    public String seed(
        OpenMetadataClient client,
        TestNamespace ns,
        String parent,
        String token,
        Placement placement,
        boolean tier1) {
      CreateSearchIndex create =
          new CreateSearchIndex()
              .withName(EntitySeeder.nameFor(ns, token, placement))
              .withService(parent)
              .withDisplayName(EntitySeeder.displayNameFor(ns, token, placement))
              .withDescription(EntitySeeder.descriptionFor(ns, token, placement))
              .withFields(
                  List.of(
                      new SearchIndexField()
                          .withName(EntitySeeder.tokenFreeValue(ns))
                          .withDataType(SearchIndexDataType.TEXT)));
      List<TagLabel> tags = EntitySeeder.tierTags(tier1);
      if (tags != null) {
        create.withTags(tags);
      }
      return client.searchIndexes().create(create).getName();
    }
  }

  static final class GlossaryTermSeeder implements EntitySeeder {
    @Override
    public String entityType() {
      return "glossaryTerm";
    }

    @Override
    public String index() {
      return "glossary_term_search_index";
    }

    @Override
    public boolean hasDistinctive() {
      return true; // synonyms[]
    }

    @Override
    public String setup(OpenMetadataClient client, TestNamespace ns) {
      CreateGlossary glossary =
          new CreateGlossary()
              .withName(ns.prefix("glossary-" + ns.uniqueShortId()))
              .withDescription("ranking suite glossary " + ns.shortPrefix());
      return client.glossaries().create(glossary).getFullyQualifiedName();
    }

    @Override
    public String seed(
        OpenMetadataClient client,
        TestNamespace ns,
        String parent,
        String token,
        Placement placement,
        boolean tier1) {
      CreateGlossaryTerm create =
          new CreateGlossaryTerm()
              .withGlossary(parent)
              .withName(EntitySeeder.nameFor(ns, token, placement))
              .withDisplayName(EntitySeeder.displayNameFor(ns, token, placement))
              .withDescription(EntitySeeder.descriptionFor(ns, token, placement))
              .withSynonyms(List.of(EntitySeeder.distinctiveFor(ns, token, placement)));
      List<TagLabel> tags = EntitySeeder.tierTags(tier1);
      if (tags != null) {
        create.withTags(tags);
      }
      return client.glossaryTerms().create(create).getName();
    }
  }

  static final class MetricSeeder implements EntitySeeder {
    @Override
    public String entityType() {
      return "metric";
    }

    @Override
    public String index() {
      return "metric_search_index";
    }

    @Override
    public String setup(OpenMetadataClient client, TestNamespace ns) {
      // Metric is a top-level entity with no parent service; seed() ignores this value.
      return ns.prefix("metrics");
    }

    @Override
    public String seed(
        OpenMetadataClient client,
        TestNamespace ns,
        String parent,
        String token,
        Placement placement,
        boolean tier1) {
      CreateMetric create =
          new CreateMetric()
              .withName(EntitySeeder.nameFor(ns, token, placement))
              .withDisplayName(EntitySeeder.displayNameFor(ns, token, placement))
              .withDescription(EntitySeeder.descriptionFor(ns, token, placement));
      List<TagLabel> tags = EntitySeeder.tierTags(tier1);
      if (tags != null) {
        create.withTags(tags);
      }
      return client.metrics().create(create).getName();
    }
  }

  static final class ApiEndpointSeeder implements EntitySeeder {
    @Override
    public String entityType() {
      return "apiEndpoint";
    }

    @Override
    public String index() {
      return "api_endpoint_search_index";
    }

    @Override
    public boolean hasDistinctive() {
      return true; // requestSchema.schemaFields.name
    }

    @Override
    public String setup(OpenMetadataClient client, TestNamespace ns) {
      CreateApiService service =
          new CreateApiService()
              .withName(ns.prefix("apiService_" + ns.uniqueShortId()))
              .withServiceType(CreateApiService.ApiServiceType.Rest);
      ApiService created = client.apiServices().create(service);
      CreateAPICollection collection =
          new CreateAPICollection()
              .withName(ns.prefix("apiCollection_" + ns.uniqueShortId()))
              .withService(created.getFullyQualifiedName());
      return client.apiCollections().create(collection).getFullyQualifiedName();
    }

    @Override
    public String seed(
        OpenMetadataClient client,
        TestNamespace ns,
        String parent,
        String token,
        Placement placement,
        boolean tier1) {
      CreateAPIEndpoint create =
          new CreateAPIEndpoint()
              .withName(EntitySeeder.nameFor(ns, token, placement))
              .withApiCollection(parent)
              .withDisplayName(EntitySeeder.displayNameFor(ns, token, placement))
              .withDescription(EntitySeeder.descriptionFor(ns, token, placement))
              .withRequestSchema(
                  new APISchema()
                      .withSchemaFields(
                          List.of(
                              new Field()
                                  .withName(EntitySeeder.distinctiveFor(ns, token, placement))
                                  .withDataType(FieldDataType.STRING))));
      List<TagLabel> tags = EntitySeeder.tierTags(tier1);
      if (tags != null) {
        create.withTags(tags);
      }
      return client.apiEndpoints().create(create).getName();
    }
  }

  static final class DirectorySeeder implements EntitySeeder {
    @Override
    public String entityType() {
      return "directory";
    }

    @Override
    public String index() {
      return "directory_search_index";
    }

    @Override
    public boolean hasDistinctive() {
      return true; // path
    }

    @Override
    public String setup(OpenMetadataClient client, TestNamespace ns) {
      CreateDriveService service =
          new CreateDriveService()
              .withName(ns.prefix("drive-" + ns.uniqueShortId()))
              .withServiceType(DriveServiceType.GoogleDrive)
              .withConnection(new DriveConnection().withConfig(new GoogleDriveConnection()));
      return client.driveServices().create(service).getFullyQualifiedName();
    }

    @Override
    public String seed(
        OpenMetadataClient client,
        TestNamespace ns,
        String parent,
        String token,
        Placement placement,
        boolean tier1) {
      CreateDirectory create =
          new CreateDirectory()
              .withName(EntitySeeder.nameFor(ns, token, placement))
              .withService(parent)
              .withDisplayName(EntitySeeder.displayNameFor(ns, token, placement))
              .withDescription(EntitySeeder.descriptionFor(ns, token, placement))
              .withPath("/" + EntitySeeder.distinctiveFor(ns, token, placement));
      List<TagLabel> tags = EntitySeeder.tierTags(tier1);
      if (tags != null) {
        create.withTags(tags);
      }
      return client.directories().create(create).getName();
    }
  }
}
