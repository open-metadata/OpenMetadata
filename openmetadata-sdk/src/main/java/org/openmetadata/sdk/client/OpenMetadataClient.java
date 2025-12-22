package org.openmetadata.sdk.client;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.util.UUID;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.OpenMetadataHttpClient;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.sdk.services.apiservice.APICollectionService;
import org.openmetadata.sdk.services.apiservice.APIEndpointService;
import org.openmetadata.sdk.services.bots.BotService;
import org.openmetadata.sdk.services.bulk.BulkAPI;
import org.openmetadata.sdk.services.classification.ClassificationService;
import org.openmetadata.sdk.services.classification.TagService;
import org.openmetadata.sdk.services.dataassets.ChartService;
import org.openmetadata.sdk.services.dataassets.DashboardDataModelService;
import org.openmetadata.sdk.services.dataassets.DashboardService;
import org.openmetadata.sdk.services.dataassets.MetricService;
import org.openmetadata.sdk.services.dataassets.MlModelService;
import org.openmetadata.sdk.services.dataassets.PipelineService;
import org.openmetadata.sdk.services.dataassets.QueryService;
import org.openmetadata.sdk.services.dataassets.ReportService;
import org.openmetadata.sdk.services.dataassets.SearchIndexService;
import org.openmetadata.sdk.services.dataassets.TableService;
import org.openmetadata.sdk.services.dataassets.TopicService;
import org.openmetadata.sdk.services.databases.DatabaseSchemaService;
import org.openmetadata.sdk.services.databases.DatabaseService;
import org.openmetadata.sdk.services.databases.StoredProcedureService;
import org.openmetadata.sdk.services.domains.DataProductService;
import org.openmetadata.sdk.services.domains.DomainService;
import org.openmetadata.sdk.services.events.ChangeEventService;
import org.openmetadata.sdk.services.events.EventSubscriptionService;
import org.openmetadata.sdk.services.glossary.GlossaryService;
import org.openmetadata.sdk.services.glossary.GlossaryTermService;
import org.openmetadata.sdk.services.importexport.ImportExportAPI;
import org.openmetadata.sdk.services.ingestion.IngestionPipelineService;
import org.openmetadata.sdk.services.lineage.LineageAPI;
import org.openmetadata.sdk.services.policies.PolicyService;
import org.openmetadata.sdk.services.search.SearchAPI;
import org.openmetadata.sdk.services.services.APIServiceService;
import org.openmetadata.sdk.services.services.DashboardServiceService;
import org.openmetadata.sdk.services.services.DatabaseServiceService;
import org.openmetadata.sdk.services.services.MessagingServiceService;
import org.openmetadata.sdk.services.services.MetadataServiceService;
import org.openmetadata.sdk.services.services.MlModelServiceService;
import org.openmetadata.sdk.services.services.PipelineServiceService;
import org.openmetadata.sdk.services.services.SearchServiceService;
import org.openmetadata.sdk.services.services.StorageServiceService;
import org.openmetadata.sdk.services.storages.ContainerService;
import org.openmetadata.sdk.services.teams.PersonaService;
import org.openmetadata.sdk.services.teams.RoleService;
import org.openmetadata.sdk.services.teams.TeamService;
import org.openmetadata.sdk.services.teams.UserService;
import org.openmetadata.sdk.services.tests.TestCaseService;
import org.openmetadata.sdk.services.tests.TestDefinitionService;
import org.openmetadata.sdk.services.tests.TestSuiteService;

public class OpenMetadataClient {
  private final OpenMetadataConfig config;
  private final HttpClient httpClient;
  private UUID cachedUserId = null;

  // Data Assets
  private final TableService tables;
  private final DashboardService dashboards;
  private final PipelineService pipelines;
  private final TopicService topics;
  private final QueryService queries;
  private final SearchIndexService searchIndexes;
  private final MlModelService mlModels;

  // Databases
  private final DatabaseService databases;
  private final DatabaseSchemaService databaseSchemas;
  private final StoredProcedureService storedProcedures;

  // Teams
  private final UserService users;
  private final TeamService teams;
  private final PersonaService personas;
  private final RoleService roles;

  // Policies
  private final PolicyService policies;

  // Storages
  private final ContainerService containers;

  // Glossary
  private final GlossaryService glossaries;
  private final GlossaryTermService glossaryTerms;

  // Classification
  private final ClassificationService classifications;
  private final TagService tags;

  // Bots
  private final BotService bots;

  // Additional Data Assets
  private final ChartService charts;
  private final DashboardDataModelService dashboardDataModels;
  private final MetricService metrics;
  private final ReportService reports;

  // Special APIs
  private final SearchAPI searchAPI;
  private final LineageAPI lineageAPI;
  private final BulkAPI bulkAPI;
  private final ImportExportAPI importExportAPI;

  // Domains
  private final DataProductService dataProducts;
  private final DomainService domains;

  // Events
  private final ChangeEventService changeEvents;
  private final EventSubscriptionService eventSubscriptions;

  // Tests
  private final TestCaseService testCases;
  private final TestSuiteService testSuites;
  private final TestDefinitionService testDefinitions;

  // API Services
  private final APICollectionService apiCollections;
  private final APIEndpointService apiEndpoints;

  // Service Management
  private final DashboardServiceService dashboardServices;
  private final DatabaseServiceService databaseServices;
  private final MessagingServiceService messagingServices;
  private final MetadataServiceService metadataServices;
  private final MlModelServiceService mlModelServices;
  private final PipelineServiceService pipelineServices;
  private final SearchServiceService searchServices;
  private final StorageServiceService storageServices;
  private final APIServiceService apiServices;

  // Ingestion
  private final IngestionPipelineService ingestionPipelines;

  public OpenMetadataClient(OpenMetadataConfig config) {
    this.config = config;
    this.httpClient = new OpenMetadataHttpClient(config);

    // Initialize data asset services
    this.tables = new TableService(httpClient);
    this.dashboards = new DashboardService(httpClient);
    this.pipelines = new PipelineService(httpClient);
    this.topics = new TopicService(httpClient);
    this.queries = new QueryService(httpClient);
    this.searchIndexes = new SearchIndexService(httpClient);
    this.mlModels = new MlModelService(httpClient);

    // Initialize database services
    this.databases = new DatabaseService(httpClient);
    this.databaseSchemas = new DatabaseSchemaService(httpClient);
    this.storedProcedures = new StoredProcedureService(httpClient);

    // Initialize team services
    this.users = new UserService(httpClient);
    this.teams = new TeamService(httpClient);
    this.personas = new PersonaService(httpClient);
    this.roles = new RoleService(httpClient);

    // Initialize policy services
    this.policies = new PolicyService(httpClient);

    // Initialize storage services
    this.containers = new ContainerService(httpClient);

    // Initialize glossary services
    this.glossaries = new GlossaryService(httpClient);
    this.glossaryTerms = new GlossaryTermService(httpClient);

    // Initialize classification services
    this.classifications = new ClassificationService(httpClient);
    this.tags = new TagService(httpClient);

    // Initialize bot service
    this.bots = new BotService(httpClient);

    // Initialize additional data asset services
    this.charts = new ChartService(httpClient);
    this.dashboardDataModels = new DashboardDataModelService(httpClient);
    this.metrics = new MetricService(httpClient);
    this.reports = new ReportService(httpClient);

    // Initialize special APIs
    this.searchAPI = new SearchAPI(httpClient);
    this.lineageAPI = new LineageAPI(httpClient);
    this.bulkAPI = new BulkAPI(httpClient);
    this.importExportAPI = new ImportExportAPI(httpClient);

    // Initialize domain services
    this.dataProducts = new DataProductService(httpClient);
    this.domains = new DomainService(httpClient);

    // Initialize event services
    this.changeEvents = new ChangeEventService(httpClient);
    this.eventSubscriptions = new EventSubscriptionService(httpClient);

    // Initialize test services
    this.testCases = new TestCaseService(httpClient);
    this.testSuites = new TestSuiteService(httpClient);
    this.testDefinitions = new TestDefinitionService(httpClient);

    // Initialize API services
    this.apiCollections = new APICollectionService(httpClient);
    this.apiEndpoints = new APIEndpointService(httpClient);

    // Initialize service management
    this.dashboardServices = new DashboardServiceService(httpClient);
    this.databaseServices = new DatabaseServiceService(httpClient);
    this.messagingServices = new MessagingServiceService(httpClient);
    this.metadataServices = new MetadataServiceService(httpClient);
    this.mlModelServices = new MlModelServiceService(httpClient);
    this.pipelineServices = new PipelineServiceService(httpClient);
    this.searchServices = new SearchServiceService(httpClient);
    this.storageServices = new StorageServiceService(httpClient);
    this.apiServices = new APIServiceService(httpClient);

    // Initialize ingestion services
    this.ingestionPipelines = new IngestionPipelineService(httpClient);
  }

  public OpenMetadataConfig getConfig() {
    return config;
  }

  public HttpClient getHttpClient() {
    return httpClient;
  }

  // Data Asset Service Getters
  public TableService tables() {
    return tables;
  }

  public DashboardService dashboards() {
    return dashboards;
  }

  public PipelineService pipelines() {
    return pipelines;
  }

  public TopicService topics() {
    return topics;
  }

  public QueryService queries() {
    return queries;
  }

  public SearchIndexService searchIndexes() {
    return searchIndexes;
  }

  public MlModelService mlModels() {
    return mlModels;
  }

  // Database Service Getters
  public DatabaseService databases() {
    return databases;
  }

  public DatabaseSchemaService databaseSchemas() {
    return databaseSchemas;
  }

  public StoredProcedureService storedProcedures() {
    return storedProcedures;
  }

  // Team Service Getters
  public UserService users() {
    return users;
  }

  public TeamService teams() {
    return teams;
  }

  public RoleService roles() {
    return roles;
  }

  public PolicyService policies() {
    return policies;
  }

  public PersonaService personas() {
    return personas;
  }

  // Storage Service Getters
  public ContainerService containers() {
    return containers;
  }

  // Glossary Service Getters
  public GlossaryService glossaries() {
    return glossaries;
  }

  public GlossaryTermService glossaryTerms() {
    return glossaryTerms;
  }

  // Classification Service Getters
  public ClassificationService classifications() {
    return classifications;
  }

  public TagService tags() {
    return tags;
  }

  // Bot Service Getter
  public BotService bots() {
    return bots;
  }

  // Additional Data Asset Service Getters
  public ChartService charts() {
    return charts;
  }

  public DashboardDataModelService dashboardDataModels() {
    return dashboardDataModels;
  }

  public MetricService metrics() {
    return metrics;
  }

  public ReportService reports() {
    return reports;
  }

  // Special API Getters
  public SearchAPI search() {
    return searchAPI;
  }

  public LineageAPI lineage() {
    return lineageAPI;
  }

  public BulkAPI bulk() {
    return bulkAPI;
  }

  public ImportExportAPI importExport() {
    return importExportAPI;
  }

  // Domain Service Getters
  public DataProductService dataProducts() {
    return dataProducts;
  }

  public DomainService domains() {
    return domains;
  }

  // Event Service Getters
  public ChangeEventService changeEvents() {
    return changeEvents;
  }

  public EventSubscriptionService eventSubscriptions() {
    return eventSubscriptions;
  }

  // Test Service Getters
  public TestCaseService testCases() {
    return testCases;
  }

  public TestSuiteService testSuites() {
    return testSuites;
  }

  public TestDefinitionService testDefinitions() {
    return testDefinitions;
  }

  // API Service Getters
  public APICollectionService apiCollections() {
    return apiCollections;
  }

  public APIEndpointService apiEndpoints() {
    return apiEndpoints;
  }

  // Service Management Getters
  public DashboardServiceService dashboardServices() {
    return dashboardServices;
  }

  public DatabaseServiceService databaseServices() {
    return databaseServices;
  }

  public MessagingServiceService messagingServices() {
    return messagingServices;
  }

  public MetadataServiceService metadataServices() {
    return metadataServices;
  }

  public MlModelServiceService mlModelServices() {
    return mlModelServices;
  }

  public PipelineServiceService pipelineServices() {
    return pipelineServices;
  }

  public SearchServiceService searchServices() {
    return searchServices;
  }

  public StorageServiceService storageServices() {
    return storageServices;
  }

  public APIServiceService apiServices() {
    return apiServices;
  }

  // Ingestion Service Getters
  public IngestionPipelineService ingestionPipelines() {
    return ingestionPipelines;
  }

  /**
   * Get the current user ID by determining it from the authentication token.
   * In test mode with email auth, fetches the user by username.
   * For production JWT tokens, would need to decode or call a /users/me endpoint.
   */
  public UUID getCurrentUserId() {
    // Try to determine user from authentication
    String auth = config.getAccessToken();
    if (auth == null) {
      return null;
    }

    try {
      // Check if it's an email (test mode)
      if (auth.contains("@")) {
        // The auth is an email, fetch the user by name
        String username = auth.split("@")[0];
        var user = users().getByName(username);
        if (user != null && user.getId() != null) {
          return user.getId();
        }
      } else if (auth.startsWith("ey")) {
        // Looks like a JWT token (starts with base64 encoded '{"')
        // For JWT, we would need to decode it, but for now we fetch current user from API
        // This would require a /users/me endpoint or similar
        // For now, return null and let WebSocket be unavailable for JWT auth
        return null;
      }
    } catch (Exception e) {
      // Ignore - WebSocket will not be available
    }

    return null;
  }

  /**
   * Get the WebSocket URL for async operations.
   * Derives from the server URL, replacing http with ws.
   */
  public String getWebSocketUrl() {
    String serverUrl = config.getServerUrl();
    if (serverUrl != null) {
      // Convert http(s)://host:port/api to ws(s)://host:port
      return serverUrl.replace("https://", "wss://").replace("http://", "ws://");
    }
    return null;
  }

  /**
   * Get the server URL.
   */
  public String getServerUrl() {
    return config.getServerUrl();
  }

  /**
   * Get the user ID of the logged-in user.
   * This is fetched on-demand from the server and cached.
   * Only called when WebSocket functionality is needed.
   */
  public UUID getUserId() {
    if (cachedUserId != null) {
      return cachedUserId;
    }

    try {
      // Fetch logged-in user info from the server
      String response =
          httpClient.executeForString(
              HttpMethod.GET,
              "/users/loggedInUser",
              null,
              RequestOptions.builder().queryParam("fields", "profile").build());

      // Parse the response to get the user ID
      JsonObject jsonResponse = JsonParser.parseString(response).getAsJsonObject();

      if (jsonResponse.has("id")) {
        String userIdStr = jsonResponse.get("id").getAsString();
        cachedUserId = UUID.fromString(userIdStr);
        return cachedUserId;
      }
    } catch (Exception e) {
      // Log but don't fail - WebSocket features will gracefully degrade
      // Return null if we can't get the user ID
    }

    return null;
  }
}
