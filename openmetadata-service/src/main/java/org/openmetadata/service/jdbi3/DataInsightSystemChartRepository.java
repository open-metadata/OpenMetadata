package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.DATA_INSIGHT_CUSTOM_CHART;
import static org.openmetadata.service.Entity.INGESTION_PIPELINE;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import org.glassfish.jersey.message.internal.OutboundJaxrsResponse;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.socket.messages.ChartDataStreamMessage;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.ResultList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class DataInsightSystemChartRepository extends EntityRepository<DataInsightCustomChart> {
  private static final Logger LOG = LoggerFactory.getLogger(DataInsightSystemChartRepository.class);

  public static final String COLLECTION_PATH = "/v1/analytics/dataInsights/system/charts";
  private static final SearchClient searchClient = Entity.getSearchRepository().getSearchClient();
  public static final String TIMESTAMP_FIELD = "@timestamp";

  // Streaming constants
  private static final String CHART_DATA_STREAM_CHANNEL = "chartDataStream";
  private static final long STREAM_DURATION_MS = 10 * 60 * 1000; // 10 minutes
  private static final long UPDATE_INTERVAL_MS = 10 * 1000; // 2 seconds

  // Streaming service fields
  private ScheduledExecutorService scheduler;
  private final Map<String, StreamingSession> activeSessions;

  public static final Set<String> dataAssetTypes =
      Set.of(
          "table",
          "storedProcedure",
          "databaseSchema",
          "database",
          "chart",
          "dashboard",
          "dashboardDataModel",
          "pipeline",
          "topic",
          "container",
          "searchIndex",
          "mlmodel",
          "dataProduct",
          "glossaryTerm",
          "tag",
          "testCaseResult",
          "testCaseResolutionStatus");

  public static final String DI_SEARCH_INDEX_PREFIX = "di-data-assets";

  public static final String DI_SEARCH_INDEX = "di-data-assets-*";

  private static final Set IGNORE_OTHER_SERVICE_CHARTS =
      Set.of(
          "healthy_data_assets",
          "total_data_assets_live",
          "pipeline_status_live",
          "assets_with_pii_live",
          "assets_with_tier_live",
          "assets_with_owner_live",
          "assets_with_description_live");

  public static final String ALL_SEARCH_INDEX = "all";

  public static final String FORMULA_FUNC_REGEX =
      "\\b(count|sum|min|max|avg|unique)+\\((k='([^']*)')?,?\\s*(q='([^']*)')?\\)?";

  public static final String NUMERIC_VALIDATION_REGEX = "[\\d\\.+-\\/\\*\\(\\)\s]+";

  public DataInsightSystemChartRepository() {
    super(
        COLLECTION_PATH,
        DATA_INSIGHT_CUSTOM_CHART,
        DataInsightCustomChart.class,
        Entity.getCollectionDAO().dataInsightCustomChartDAO(),
        "",
        "");
    // Lazy initialization: do not create scheduler here
    this.activeSessions = new ConcurrentHashMap<>();
  }

  // Lazy initialization for scheduler
  private ScheduledExecutorService getScheduler() {
    if (scheduler == null) {
      scheduler = Executors.newScheduledThreadPool(10);
    }
    return scheduler;
  }

  public static String getDataInsightsIndexPrefix() {
    String clusterAlias = Entity.getSearchRepository().getClusterAlias();
    if (!(clusterAlias == null || clusterAlias.isEmpty())) {
      return String.format("%s-%s", clusterAlias, DI_SEARCH_INDEX_PREFIX);
    }
    return DI_SEARCH_INDEX_PREFIX;
  }

  public static String getDataInsightsSearchIndex() {
    String clusterAlias = Entity.getSearchRepository().getClusterAlias();
    if (!(clusterAlias == null || clusterAlias.isEmpty())) {
      return String.format("%s-%s", clusterAlias, DI_SEARCH_INDEX);
    }
    return DI_SEARCH_INDEX;
  }

  public static String getLiveSearchIndex(String index) {
    String clusterAlias = Entity.getSearchRepository().getClusterAlias();
    if (index == null) {
      index = ALL_SEARCH_INDEX;
    }
    if (!(clusterAlias == null || clusterAlias.isEmpty())) {
      return String.format("%s_%s", clusterAlias, index);
    }
    return index;
  }

  /**
   * Fetch ingestion pipeline status for a specific service
   * @param serviceName Service name to search for
   * @return List of pipeline statuses for the service
   */
  private List<Map> getIngestionPipelineStatus(String serviceName) {
    List<Map> combinedStatus = new ArrayList<>();

    try {
      if (serviceName == null || serviceName.trim().isEmpty()) {
        return combinedStatus;
      }

      // Get the ingestion pipeline repository
      IngestionPipelineRepository ingestionPipelineRepository =
          (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);

      if (ingestionPipelineRepository == null) {
        LOG.warn("IngestionPipelineRepository not available");
        return combinedStatus;
      }

      // Get current timestamp for recent pipeline status
      long currentTime = System.currentTimeMillis();
      long startTime = currentTime - (24 * 60 * 60 * 1000); // Last 24 hours
      long endTime = currentTime;

      // Search for ingestion pipelines by service name using search
      SearchClient searchClient = Entity.getSearchRepository().getSearchClient();
      if (searchClient != null) {
        try {
          // Search for ingestion pipelines with the service name
          String searchIndex = INGESTION_PIPELINE;
          var response =
              searchClient.searchByField("service.name.keyword", serviceName, searchIndex, false);

          if (response != null && response.getStatus() == 200) {
            // Parse the response to extract pipeline information
            String responseBody =
                (String) ((OutboundJaxrsResponse) response).getContext().getEntity();
            combinedStatus.addAll(parseIngestionPipelineResponse(responseBody));
          }
        } catch (Exception e) {
          LOG.error("Error searching for ingestion pipelines for service: {}", serviceName, e);
        }
      }

      // Fallback: try to get pipeline status directly if search fails
      try {
        // This would require implementing a method to get pipelines by service name
        // For now, we'll return an empty list
        LOG.info("Using fallback method for service: {}", serviceName);
      } catch (Exception e) {
        LOG.error("Error in fallback method for service: {}", serviceName, e);
      }

    } catch (Exception e) {
      LOG.error("Error fetching ingestion pipeline status for service: {}", serviceName, e);
    }

    return combinedStatus;
  }

  /**
   * Get the latest run status of the three Collate applications
   * @param serviceName The service name to filter app runs
   * @return List of app status information
   */
  private List<Map> getCollateAppStatus(String serviceName) {
    List<Map> appStatusList = new ArrayList<>();
    String[] collateAppNames = {
      "CollateAIApplication", "CollateAIQualityAgentApplication", "CollateAITierAgentApplication"
    };

    try {
      AppRepository appRepository = getAppRepository();
      if (appRepository == null) {
        return appStatusList;
      }

      UUID serviceUUID = getServiceUUID(serviceName);

      for (String appName : collateAppNames) {
        Map<String, Object> appStatus =
            getAppStatus(appName, appRepository, serviceUUID, serviceName);
        if (appStatus != null) {
          appStatusList.add(appStatus);
        }
      }

    } catch (Exception e) {
      LOG.error("Error fetching Collate app status for service {}", serviceName, e);
    }

    return appStatusList;
  }

  /**
   * Get the app repository
   */
  private AppRepository getAppRepository() {
    AppRepository appRepository = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
    if (appRepository == null) {
      LOG.warn("AppRepository not available");
    }
    return appRepository;
  }

  /**
   * Convert service name to UUID
   */
  private UUID getServiceUUID(String serviceName) {
    if (serviceName == null || serviceName.trim().isEmpty()) {
      return null;
    }

    try {
      DatabaseServiceRepository databaseServiceRepository =
          (DatabaseServiceRepository) Entity.getEntityRepository(Entity.DATABASE_SERVICE);

      if (databaseServiceRepository != null) {
        DatabaseService service =
            databaseServiceRepository.getByName(null, serviceName, EntityUtil.Fields.EMPTY_FIELDS);
        if (service != null) {
          return service.getId();
        }
      }
    } catch (Exception e) {
      LOG.debug(
          "Service {} not found or error getting service UUID: {}", serviceName, e.getMessage());
    }
    return null;
  }

  /**
   * Get app status for a specific app
   */
  private Map<String, Object> getAppStatus(
      String appName, AppRepository appRepository, UUID serviceUUID, String serviceName) {
    try {
      App app = appRepository.getByName(null, appName, appRepository.getFields("id,pipelines"));
      if (app == null) {
        return null; // App doesn't exist, ignore it completely
      }

      ResultList<AppRunRecord> appRuns = getAppRuns(app, serviceUUID);
      return createAppStatusMap(appName, app, appRuns, serviceName);

    } catch (Exception e) {
      LOG.debug("App {} not found or not available: {}", appName, e.getMessage());
      return null;
    }
  }

  /**
   * Get app runs for internal or external apps
   */
  private ResultList<AppRunRecord> getAppRuns(App app, UUID serviceUUID) {
    try {
      if (app.getAppType().equals(AppType.Internal)) {
        return getInternalAppRuns(app, serviceUUID);
      } else if (!app.getPipelines().isEmpty()) {
        return getExternalAppRuns(app, serviceUUID);
      }
    } catch (Exception e) {
      LOG.warn("Error fetching app runs for app {}: {}", app.getName(), e.getMessage());
    }
    return null;
  }

  /**
   * Get app runs for internal apps
   */
  private ResultList<AppRunRecord> getInternalAppRuns(App app, UUID serviceUUID) {
    AppRepository appRepository = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
    return appRepository.listAppRuns(app, 1, 0, serviceUUID);
  }

  /**
   * Get app runs for external apps through ingestion pipeline
   */
  private ResultList<AppRunRecord> getExternalAppRuns(App app, UUID serviceUUID) {
    EntityReference pipelineRef = app.getPipelines().get(0);
    IngestionPipelineRepository ingestionPipelineRepository =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);

    if (ingestionPipelineRepository == null) {
      return null;
    }

    IngestionPipeline ingestionPipeline =
        ingestionPipelineRepository.get(
            null,
            pipelineRef.getId(),
            ingestionPipelineRepository.getFields("id,name,fullyQualifiedName"));

    if (ingestionPipeline == null) {
      return null;
    }

    String serviceNameForExternal = getServiceNameForExternal(serviceUUID);
    ResultList<PipelineStatus> pipelineStatuses =
        ingestionPipelineRepository.listExternalAppStatus(
            ingestionPipeline.getFullyQualifiedName(),
            serviceNameForExternal,
            System.currentTimeMillis() - (24 * 60 * 60 * 1000), // Last 24 hours
            System.currentTimeMillis());

    if (pipelineStatuses != null
        && pipelineStatuses.getData() != null
        && !pipelineStatuses.getData().isEmpty()) {
      PipelineStatus latestPipelineStatus = pipelineStatuses.getData().get(0);
      AppRunRecord convertedRun = convertPipelineStatusToAppRun(app, latestPipelineStatus);

      ResultList<AppRunRecord> appRuns = new ResultList<>();
      appRuns.setData(List.of(convertedRun));
      return appRuns;
    }

    return null;
  }

  /**
   * Get service name for external app status
   */
  private String getServiceNameForExternal(UUID serviceUUID) {
    if (serviceUUID == null) {
      return null;
    }

    try {
      DatabaseServiceRepository databaseServiceRepository =
          (DatabaseServiceRepository) Entity.getEntityRepository(Entity.DATABASE_SERVICE);
      if (databaseServiceRepository != null) {
        DatabaseService service =
            databaseServiceRepository.get(null, serviceUUID, EntityUtil.Fields.EMPTY_FIELDS);
        if (service != null) {
          return service.getName();
        }
      }
    } catch (Exception e) {
      LOG.debug("Error getting service name for external app: {}", e.getMessage());
    }
    return null;
  }

  /**
   * Create app status map from app run records
   */
  private Map<String, Object> createAppStatusMap(
      String appName, App app, ResultList<AppRunRecord> appRuns, String serviceName) {
    try {
      if (appRuns != null && appRuns.getData() != null && !appRuns.getData().isEmpty()) {
        AppRunRecord latestRun = appRuns.getData().get(0);
        return createSuccessfulAppStatus(appName, app, latestRun);
      } else {
        return createNoRunsAppStatus(appName, app);
      }
    } catch (Exception e) {
      LOG.warn(
          "Error creating app status for app {} and service {}: {}",
          appName,
          serviceName,
          e.getMessage());
      return createErrorAppStatus(appName, app, e.getMessage());
    }
  }

  /**
   * Create successful app status map
   */
  private Map<String, Object> createSuccessfulAppStatus(
      String appName, App app, AppRunRecord latestRun) {
    Map<String, Object> appStatus = new HashMap<>();
    appStatus.put("appName", appName);
    appStatus.put("appId", app.getId().toString());
    appStatus.put("displayName", app.getDisplayName());
    appStatus.put("status", latestRun.getStatus());
    appStatus.put("timestamp", latestRun.getTimestamp());
    appStatus.put("runId", latestRun.getAppId().toString());
    appStatus.put("type", "app");

    // Add additional run information if available
    if (latestRun.getRunType() != null) {
      appStatus.put("runType", latestRun.getRunType());
    }
    if (latestRun.getStartTime() != null) {
      appStatus.put("startTime", latestRun.getStartTime());
    }
    if (latestRun.getEndTime() != null) {
      appStatus.put("endTime", latestRun.getEndTime());
    }

    return appStatus;
  }

  /**
   * Create no runs app status map
   */
  private Map<String, Object> createNoRunsAppStatus(String appName, App app) {
    Map<String, Object> appStatus = new HashMap<>();
    appStatus.put("appName", appName);
    appStatus.put("appId", app.getId().toString());
    appStatus.put("displayName", app.getDisplayName());
    appStatus.put("status", "NO_RUNS");
    appStatus.put("timestamp", System.currentTimeMillis());
    appStatus.put("type", "app");
    return appStatus;
  }

  /**
   * Create error app status map
   */
  private Map<String, Object> createErrorAppStatus(String appName, App app, String errorMessage) {
    Map<String, Object> appStatus = new HashMap<>();
    appStatus.put("appName", appName);
    appStatus.put("appId", app.getId().toString());
    appStatus.put("displayName", app.getDisplayName());
    appStatus.put("status", "ERROR");
    appStatus.put("error", errorMessage);
    appStatus.put("timestamp", System.currentTimeMillis());
    appStatus.put("type", "app");
    return appStatus;
  }

  /**
   * Convert pipeline status to app run record (similar to convertPipelineStatus in CollateAppsResource)
   */
  private AppRunRecord convertPipelineStatusToAppRun(App app, PipelineStatus pipelineStatus) {
    return new AppRunRecord()
        .withAppId(app.getId())
        .withAppName(app.getName())
        .withStartTime(pipelineStatus.getStartDate())
        .withExecutionTime(
            pipelineStatus.getEndDate() == null
                ? System.currentTimeMillis() - pipelineStatus.getStartDate()
                : pipelineStatus.getEndDate() - pipelineStatus.getStartDate())
        .withEndTime(pipelineStatus.getEndDate())
        .withStatus(
            switch (pipelineStatus.getPipelineState()) {
              case QUEUED -> AppRunRecord.Status.PENDING;
              case SUCCESS -> AppRunRecord.Status.SUCCESS;
              case FAILED, PARTIAL_SUCCESS -> AppRunRecord.Status.FAILED;
              case RUNNING -> AppRunRecord.Status.RUNNING;
            })
        .withConfig(pipelineStatus.getConfig());
  }

  /**
   * Parse the search response to extract ingestion pipeline information
   * @param responseBody JSON response from search
   * @return List of pipeline statuses
   */
  private List<Map> parseIngestionPipelineResponse(String responseBody) {
    try {
      // Parse the JSON response
      Map<String, Object> responseMap = JsonUtils.readValue(responseBody, Map.class);

      if (responseMap == null || !responseMap.containsKey("hits")) {
        LOG.warn("Invalid search response format");
        return List.of();
      }

      Map<String, Object> hits = (Map<String, Object>) responseMap.get("hits");
      if (hits == null || !hits.containsKey("hits")) {
        LOG.warn("No hits found in search response");
        return List.of();
      }

      List<Map<String, Object>> hitsList = (List<Map<String, Object>>) hits.get("hits");
      if (hitsList == null || hitsList.isEmpty()) {
        LOG.info("No ingestion pipelines found");
        return List.of();
      }

      List<Map> pipelineStatuses = new ArrayList<>();

      for (Map<String, Object> hit : hitsList) {
        Map<String, Object> source = (Map<String, Object>) hit.get("_source");
        if (source == null) {
          continue;
        }

        // Extract required information
        String id = (String) source.get("id");
        String name = (String) source.get("name");
        String displayName = (String) source.get("displayName");
        String fqn = (String) source.get("fullyQualifiedName");
        String pipelineType = (String) source.get("pipelineType");
        String provider = (String) source.get("provider");

        // Get pipeline state from pipelineStatuses
        String pipelineState = "unknown";
        Map<String, Object> pipelineStatusesMap =
            (Map<String, Object>) source.get("pipelineStatuses");
        if (pipelineStatusesMap != null) {
          pipelineState = (String) pipelineStatusesMap.get("pipelineState");
          if (pipelineState == null) {
            pipelineState = "unknown";
          }
        }

        // Add metadata with the required information
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("id", id);
        metadata.put("name", name);
        metadata.put("displayName", displayName);
        metadata.put("fullyQualifiedName", fqn);
        metadata.put("pipelineType", pipelineType);
        metadata.put("provider", provider);
        metadata.put("status", pipelineState);

        pipelineStatuses.add(metadata);

        LOG.info(
            "Found pipeline: {} ({}), Type: {}, Status: {}, Provider: {}",
            displayName,
            fqn,
            pipelineType,
            pipelineState,
            provider);
      }

      LOG.info("Parsed {} ingestion pipelines for service", pipelineStatuses.size());
      return pipelineStatuses;

    } catch (Exception e) {
      LOG.error("Error parsing ingestion pipeline response", e);
      return List.of();
    }
  }

  @Override
  public void setFields(DataInsightCustomChart entity, EntityUtil.Fields fields) {
    /* Nothing to do */
  }

  @Override
  public void clearFields(DataInsightCustomChart entity, EntityUtil.Fields fields) {
    /* Nothing to do */
  }

  @Override
  public void prepare(DataInsightCustomChart entity, boolean update) {
    /* Nothing to do */
  }

  @Override
  public void storeEntity(DataInsightCustomChart entity, boolean update) {
    store(entity, update);
  }

  @Override
  public void storeRelationships(DataInsightCustomChart entity) {
    // No relationships to store beyond what is stored in the super class
  }

  public DataInsightCustomChartResultList getPreviewData(
      DataInsightCustomChart chart, long startTimestamp, long endTimestamp, String filter)
      throws IOException {
    if (chart.getChartDetails() != null && filter != null) {
      HashMap chartDetails = (LinkedHashMap<String, Object>) chart.getChartDetails();
      if (chartDetails.get("metrics") != null) {
        for (LinkedHashMap<String, Object> metrics :
            (List<LinkedHashMap<String, Object>>) chartDetails.get("metrics")) {
          metrics.put("filter", filter);
        }
      }
    }
    return getPreviewData(chart, startTimestamp, endTimestamp);
  }

  public DataInsightCustomChartResultList getPreviewData(
      DataInsightCustomChart chart, long startTimestamp, long endTimestamp) throws IOException {
    return searchClient.buildDIChart(chart, startTimestamp, endTimestamp);
  }

  public Map<String, DataInsightCustomChartResultList> listChartData(
      String chartNames,
      long startTimestamp,
      long endTimestamp,
      String filter,
      boolean live,
      String serviceName)
      throws IOException {
    HashMap<String, DataInsightCustomChartResultList> result = new HashMap<>();
    if (chartNames == null) {
      return result;
    }

    for (String chartName : chartNames.split(",")) {
      DataInsightCustomChart chart =
          Entity.getEntityByName(DATA_INSIGHT_CUSTOM_CHART, chartName, "", Include.NON_DELETED);

      if (chart != null) {
        if (chart.getChartDetails() != null && filter != null) {
          HashMap chartDetails = (LinkedHashMap<String, Object>) chart.getChartDetails();
          if (chartDetails.get("metrics") != null) {
            for (LinkedHashMap<String, Object> metrics :
                (List<LinkedHashMap<String, Object>>) chartDetails.get("metrics")) {
              metrics.put("filter", filter);
            }
          }
        }
        if (IGNORE_OTHER_SERVICE_CHARTS.contains(chart.getName()) && serviceName != null) {
          HashMap chartDetails = (HashMap) chart.getChartDetails();
          chartDetails.put("includeXAxisFiled", serviceName.toLowerCase());
        }
        DataInsightCustomChartResultList data =
            searchClient.buildDIChart(chart, startTimestamp, endTimestamp, live);
        result.put(chartName, data);
      }
    }
    return result;
  }

  /**
   * Check if there's already an active streaming session for the same criteria
   * @param chartNames Chart names being requested
   * @param serviceName Service name (can be null)
   * @return Active session if exists, null otherwise
   */
  private StreamingSession findActiveSession(String chartNames, String serviceName) {
    return activeSessions.values().stream()
        .filter(session -> session.getChartNames().equals(chartNames))
        .filter(
            session -> {
              // Handle null serviceName comparison
              if (serviceName == null && session.getServiceName() == null) {
                return true;
              }
              if (serviceName != null && session.getServiceName() != null) {
                return serviceName.equals(session.getServiceName());
              }
              return false;
            })
        .findFirst()
        .orElse(null);
  }

  /**
   * Start streaming chart data via WebSocket
   * @param chartNames Comma-separated list of chart names
   * @param serviceName Service name for filtering
   * @param filter Additional filter
   * @param userId User ID for WebSocket messaging
   * @param startTime Start time for data range
   * @param endTime End time for data range
   * @return Map containing session details
   */
  public Map<String, Object> startChartDataStreaming(
      String chartNames,
      String serviceName,
      String filter,
      UUID userId,
      Long startTime,
      Long endTime) {

    // Validate input
    if (chartNames == null || chartNames.trim().isEmpty()) {
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", "chartNames parameter is required");
      return errorResponse;
    }

    // Check if there's already an active streaming session for the same criteria
    StreamingSession existingSession = findActiveSession(chartNames, serviceName);
    if (existingSession != null) {
      // Add this user to the existing session
      existingSession.addUser(userId);

      LOG.info(
          "Adding user {} to existing streaming session {} for charts: {} and service: {}. Total users: {}",
          userId,
          existingSession.getSessionId(),
          chartNames,
          serviceName,
          existingSession.getUserCount());

      // Send initial status message to the new user
      sendMessageToUser(
          userId,
          existingSession.getSessionId(),
          "JOINED",
          serviceName,
          null,
          null,
          existingSession.getRemainingTime(),
          UPDATE_INTERVAL_MS,
          getIngestionPipelineStatus(serviceName),
          getCollateAppStatus(serviceName));

      // Calculate remaining time for existing session
      long remainingTime = existingSession.getRemainingTime();

      Map<String, Object> response = new HashMap<>();
      response.put("sessionId", existingSession.getSessionId());
      response.put("status", "joined_existing");
      response.put(
          "message",
          "Joined existing streaming session. Listen to 'chartDataStream' WebSocket channel.");
      response.put("remainingDuration", remainingTime > 0 ? remainingTime + " ms" : "0 ms");
      response.put("startTime", existingSession.getDataStartTime());
      response.put("endTime", existingSession.getDataEndTime());
      response.put("totalUsers", existingSession.getUserCount());
      response.put("serviceName", existingSession.getServiceName());

      return response;
    }

    // Set default time range if not provided (last 24 hours)
    if (startTime == null || endTime == null) {
      long currentTime = System.currentTimeMillis();
      if (endTime == null) {
        endTime = currentTime;
      }
      if (startTime == null) {
        startTime = currentTime - (24 * 60 * 60 * 1000); // 24 hours ago
      }
    }

    // Validate time range
    if (startTime >= endTime) {
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", "startTime must be less than endTime");
      return errorResponse;
    }

    try {
      String sessionId =
          startStreaming(chartNames, serviceName, filter, userId, startTime, endTime);

      Map<String, Object> response = new HashMap<>();
      response.put("sessionId", sessionId);
      response.put("status", "started");
      response.put(
          "message",
          "Chart data streaming started. Listen to 'chartDataStream' WebSocket channel.");
      response.put("duration", "10 minutes");
      response.put("updateInterval", "2 seconds");
      response.put("startTime", startTime);
      response.put("endTime", endTime);
      response.put("totalUsers", 1);
      response.put("serviceName", serviceName);

      return response;

    } catch (Exception e) {
      LOG.error("Error starting chart data streaming", e);
      Map<String, Object> errorResponse = new HashMap<>();
      errorResponse.put("error", "Failed to start streaming: " + e.getMessage());
      return errorResponse;
    }
  }

  /**
   * Start a streaming session
   */
  public String startStreaming(
      String chartNames,
      String serviceName,
      String filter,
      UUID userId,
      Long startTime,
      Long endTime) {
    String sessionId = UUID.randomUUID().toString();

    LOG.info(
        "Starting chart data streaming session {} for user {} with charts: {} (time range: {} to {})",
        sessionId,
        userId,
        chartNames,
        startTime,
        endTime);

    StreamingSession session =
        new StreamingSession(
            sessionId, chartNames, serviceName, filter, userId, startTime, endTime);
    activeSessions.put(sessionId, session);

    // Send initial status message to all users in the session
    sendMessageToAllUsers(
        session,
        "STARTED",
        null,
        null,
        STREAM_DURATION_MS,
        UPDATE_INTERVAL_MS,
        getIngestionPipelineStatus(serviceName),
        getCollateAppStatus(serviceName));

    // Schedule the streaming task
    ScheduledFuture<?> future =
        getScheduler()
            .scheduleAtFixedRate(
                () -> streamChartData(session), 0, UPDATE_INTERVAL_MS, TimeUnit.MILLISECONDS);

    session.setFuture(future);

    // Schedule session cleanup after 10 minutes
    getScheduler()
        .schedule(() -> stopStreaming(sessionId), STREAM_DURATION_MS, TimeUnit.MILLISECONDS);

    return sessionId;
  }

  /**
   * Stop a streaming session
   */
  public void stopStreaming(String sessionId) {
    StreamingSession session = activeSessions.get(sessionId);
    if (session != null) {
      LOG.info(
          "Stopping chart data streaming session {} with {} users",
          sessionId,
          session.getUserCount());

      if (session.getFuture() != null) {
        session.getFuture().cancel(true);
      }

      sendMessageToAllUsers(session, "COMPLETED", null, null, 0L, 0L, List.of(), List.of());
      activeSessions.remove(sessionId);
    }
  }

  /**
   * Stop a streaming session with user validation
   * @param sessionId Session ID to stop
   * @param userId User ID requesting the stop
   * @return Map containing response details
   */
  public Map<String, Object> stopChartDataStreaming(String sessionId, UUID userId) {
    Map<String, Object> response = new HashMap<>();

    StreamingSession session = activeSessions.get(sessionId);
    if (session == null) {
      response.put("error", "Streaming session not found");
      response.put("notFound", true);
      return response;
    }

    // Check if the user is part of this session
    if (!session.getUserIds().contains(userId)) {
      response.put("error", "User is not authorized to stop this streaming session");
      return response;
    }

    LOG.info(
        "User {} stopping chart data streaming session {} with {} users",
        userId,
        sessionId,
        session.getUserCount());

    // Remove the user from the session
    session.removeUser(userId);

    // If no users left, stop the entire session
    if (session.getUserCount() == 0) {
      if (session.getFuture() != null) {
        session.getFuture().cancel(true);
      }
      sendMessageToAllUsers(session, "COMPLETED", null, null, 0L, 0L, List.of(), List.of());
      activeSessions.remove(sessionId);

      response.put("status", "stopped");
      response.put("message", "Streaming session stopped successfully");
      response.put("sessionId", sessionId);
    } else {
      // Send message to remaining users that one user left
      sendMessageToAllUsers(
          session,
          "USER_LEFT",
          null,
          null,
          session.getRemainingTime(),
          UPDATE_INTERVAL_MS,
          getIngestionPipelineStatus(session.getServiceName()),
          getCollateAppStatus(session.getServiceName()));

      response.put("status", "user_removed");
      response.put("message", "User removed from streaming session");
      response.put("sessionId", sessionId);
      response.put("remainingUsers", session.getUserCount());
      response.put("serviceName", session.getServiceName());
    }

    return response;
  }

  /**
   * Stream chart data for a session
   */
  private void streamChartData(StreamingSession session) {
    try {
      long remainingTime = session.getRemainingTime();

      if (remainingTime <= 0) {
        stopStreaming(session.getSessionId());
        return;
      }

      // Use the user-provided time range
      long startTime = session.getDataStartTime();
      long endTime = session.getDataEndTime();

      // Fetch chart data using the existing repository method
      Map<String, DataInsightCustomChartResultList> chartData =
          listChartData(
              session.getChartNames(),
              startTime,
              endTime,
              session.getFilter(),
              true,
              session.getServiceName());

      // Fetch ingestion pipeline status for the service
      List<Map> ingestionPipelineStatus = getIngestionPipelineStatus(session.getServiceName());

      // Send the data to all users in the session
      sendMessageToAllUsers(
          session,
          "DATA",
          chartData,
          null,
          remainingTime,
          UPDATE_INTERVAL_MS,
          ingestionPipelineStatus,
          getCollateAppStatus(session.getServiceName()));

    } catch (IOException e) {
      LOG.error("Error streaming chart data for session {}", session.getSessionId(), e);
      sendMessageToAllUsers(
          session,
          "FAILED",
          null,
          "Error fetching chart data: " + e.getMessage(),
          0L,
          0L,
          List.of(),
          getCollateAppStatus(session.getServiceName()));
      stopStreaming(session.getSessionId());
    } catch (Exception e) {
      LOG.error("Unexpected error in streaming session {}", session.getSessionId(), e);
      sendMessageToAllUsers(
          session,
          "FAILED",
          null,
          "Unexpected error: " + e.getMessage(),
          0L,
          0L,
          List.of(),
          getCollateAppStatus(session.getServiceName()));
      stopStreaming(session.getSessionId());
    }
  }

  /**
   * Send WebSocket message to a specific user
   */
  private void sendMessageToUser(
      UUID userId,
      String sessionId,
      String status,
      String serviceName,
      Map<String, DataInsightCustomChartResultList> data,
      String error,
      Long remainingTime,
      Long nextUpdate,
      List<Map> ingestionPipelineStatus,
      List<Map> appStatus) {
    ChartDataStreamMessage message =
        new ChartDataStreamMessage(
            sessionId,
            status,
            serviceName,
            System.currentTimeMillis(),
            data,
            error,
            remainingTime,
            nextUpdate,
            ingestionPipelineStatus,
            appStatus);

    String messageJson = JsonUtils.pojoToJson(message);

    if (WebSocketManager.getInstance() != null) {
      WebSocketManager.getInstance().sendToOne(userId, CHART_DATA_STREAM_CHANNEL, messageJson);
    }
  }

  /**
   * Send WebSocket message to all users in a session
   */
  private void sendMessageToAllUsers(
      StreamingSession session,
      String status,
      Map<String, DataInsightCustomChartResultList> data,
      String error,
      Long remainingTime,
      Long nextUpdate,
      List<Map> ingestionPipelineStatus,
      List<Map> appStatus) {
    for (UUID userId : session.getUserIds()) {
      sendMessageToUser(
          userId,
          session.getSessionId(),
          status,
          session.getServiceName(),
          data,
          error,
          remainingTime,
          nextUpdate,
          ingestionPipelineStatus,
          appStatus);
    }
  }

  /**
   * Shutdown streaming service
   */
  public void shutdown() {
    LOG.info("Shutting down chart data streaming service");
    activeSessions
        .values()
        .forEach(
            session -> {
              if (session.getFuture() != null) {
                session.getFuture().cancel(true);
              }
            });
    activeSessions.clear();
    if (scheduler != null) {
      scheduler.shutdown();
    }
  }

  /**
   * Inner class to represent a streaming session with multiple users
   */
  private static class StreamingSession {
    private final String sessionId;
    private final String chartNames;
    private final String serviceName;
    private final String filter;
    private final Set<UUID> userIds; // Multiple users can share the same session
    private final long startTime; // Session start time
    private final long dataStartTime; // Data range start time
    private final long dataEndTime; // Data range end time
    private ScheduledFuture<?> future;

    public StreamingSession(
        String sessionId,
        String chartNames,
        String serviceName,
        String filter,
        UUID userId,
        Long dataStartTime,
        Long dataEndTime) {
      this.sessionId = sessionId;
      this.chartNames = chartNames;
      this.serviceName = serviceName;
      this.filter = filter;
      this.userIds = new ConcurrentHashMap().newKeySet(); // Thread-safe set
      this.userIds.add(userId);
      this.startTime = System.currentTimeMillis(); // Session start time
      this.dataStartTime = dataStartTime; // Data range start time
      this.dataEndTime = dataEndTime; // Data range end time
    }

    public void addUser(UUID userId) {
      this.userIds.add(userId);
    }

    public void removeUser(UUID userId) {
      this.userIds.remove(userId);
    }

    public long getRemainingTime() {
      long currentTime = System.currentTimeMillis();
      long elapsed = currentTime - this.startTime;
      return STREAM_DURATION_MS - elapsed;
    }

    // Getters
    public String getSessionId() {
      return sessionId;
    }

    public String getChartNames() {
      return chartNames;
    }

    public String getServiceName() {
      return serviceName;
    }

    public String getFilter() {
      return filter;
    }

    public Set<UUID> getUserIds() {
      return userIds;
    }

    public int getUserCount() {
      return userIds.size();
    }

    public long getStartTime() {
      return startTime;
    }

    public long getDataStartTime() {
      return dataStartTime;
    }

    public long getDataEndTime() {
      return dataEndTime;
    }

    public ScheduledFuture<?> getFuture() {
      return future;
    }

    public void setFuture(ScheduledFuture<?> future) {
      this.future = future;
    }
  }
}
