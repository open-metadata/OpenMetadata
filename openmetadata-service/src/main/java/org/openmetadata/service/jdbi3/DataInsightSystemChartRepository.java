package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.DATA_INSIGHT_CUSTOM_CHART;
import static org.openmetadata.service.Entity.INGESTION_PIPELINE;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
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
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.datainsight.system.DataInsightSystemChartResource;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.socket.messages.ChartDataStreamMessage;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class DataInsightSystemChartRepository extends EntityRepository<DataInsightCustomChart> {
  private static final Logger LOG = LoggerFactory.getLogger(DataInsightSystemChartRepository.class);

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

  public DataInsightSystemChartRepository() {
    super(
        DataInsightSystemChartResource.COLLECTION_PATH,
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
      scheduler =
          Executors.newScheduledThreadPool(
              10, Thread.ofPlatform().name("om-data-insight-scheduler-", 0).factory());
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

  // AI Automations are a Collate entity; referenced by type name so this compiles without it.
  private static final String AI_AUTOMATION = "aiAutomation";

  private static final String NO_RUNS_STATUS = "NO_RUNS";
  private static final long AUTOMATION_STATUS_WINDOW_MS = 24 * 60 * 60 * 1000L;
  // Service types AutoPilot creates automations for; the automation hangs off the service.
  private static final List<String> SERVICE_TYPES_WITH_AUTOMATIONS =
      List.of(Entity.DATABASE_SERVICE, Entity.DASHBOARD_SERVICE, Entity.MESSAGING_SERVICE);

  /**
   * Status of the AI Automations AutoPilot runs for a service, for the live agent panel.
   *
   * <p>Automations are a Collate entity, so they are reached by type name through their CONTAINS
   * relationship to the service rather than through a compile-time repository. An OSS-only
   * deployment holds no such relationships, so this returns empty there. Each automation owns its
   * ingestion pipeline the same way, and the pipeline's latest status is its latest run.
   *
   * <p>The session carries both the service type and name. A name is unique only within a type, so
   * the type is what pins the lookup to one service.
   *
   * @param serviceType the streamed service's entity type, e.g. {@code databaseService}
   * @param serviceName the streamed service's name
   */
  private List<Map> getAutomationStatus(String serviceType, String serviceName) {
    List<Map> automationStatus = new ArrayList<>();
    try {
      IngestionPipelineRepository pipelineRepository =
          (IngestionPipelineRepository) Entity.getEntityRepository(INGESTION_PIPELINE);
      for (EntityReference automation : listServiceAutomations(serviceType, serviceName)) {
        Map<String, Object> status = buildAutomationStatus(automation, pipelineRepository);
        if (status != null) {
          automationStatus.add(status);
        }
      }
    } catch (EntityNotFoundException e) {
      // The service the session streams was deleted, so it has no automations to report.
      LOG.debug(
          "AI Automations not available for {} '{}': {}", serviceType, serviceName, e.getMessage());
    } catch (Exception e) {
      LOG.error("Error fetching AI Automation status for {} '{}'", serviceType, serviceName, e);
    }
    return automationStatus;
  }

  /** The service owns its automations through a CONTAINS relationship. */
  private List<EntityReference> listServiceAutomations(String serviceType, String serviceName) {
    if (nullOrEmpty(serviceType)
        || nullOrEmpty(serviceName)
        || !SERVICE_TYPES_WITH_AUTOMATIONS.contains(serviceType)) {
      return List.of();
    }
    EntityInterface service =
        (EntityInterface) Entity.getEntityByName(serviceType, serviceName, "", Include.NON_DELETED);
    return Entity.getEntityRepository(serviceType)
        .findTo(service.getId(), serviceType, Relationship.CONTAINS, AI_AUTOMATION);
  }

  private Map<String, Object> buildAutomationStatus(
      EntityReference automation, IngestionPipelineRepository pipelineRepository) {
    try {
      List<EntityReference> pipelines =
          pipelineRepository.findTo(
              automation.getId(), AI_AUTOMATION, Relationship.CONTAINS, INGESTION_PIPELINE);
      if (pipelines.isEmpty()) {
        return null;
      }
      IngestionPipeline pipeline =
          pipelineRepository.get(
              null,
              pipelines.get(0).getId(),
              pipelineRepository.getFields("id,fullyQualifiedName"));

      Map<String, Object> status = new HashMap<>();
      status.put("appId", automation.getId().toString());
      status.put("appName", automation.getName());
      status.put("displayName", automation.getDisplayName());
      status.put("type", AI_AUTOMATION);

      ResultList<PipelineStatus> statuses =
          pipelineRepository.listExternalAppStatus(
              pipeline.getFullyQualifiedName(),
              System.currentTimeMillis() - AUTOMATION_STATUS_WINDOW_MS,
              System.currentTimeMillis());
      if (statuses == null || statuses.getData() == null || statuses.getData().isEmpty()) {
        status.put("status", NO_RUNS_STATUS);
        return status;
      }
      PipelineStatus latest = statuses.getData().get(0);
      status.put("status", toAppRunStatus(latest.getPipelineState()));
      status.put("runId", latest.getRunId());
      status.put("startTime", latest.getStartDate());
      status.put("endTime", latest.getEndDate());
      status.put("timestamp", latest.getTimestamp());
      return status;
    } catch (Exception e) {
      LOG.warn("Error building status for automation {}: {}", automation.getName(), e.getMessage());
      return null;
    }
  }

  /** The live panel reads AppRunRecord statuses, so map the pipeline state onto that vocabulary. */
  private static String toAppRunStatus(PipelineStatusType state) {
    if (state == null) {
      return NO_RUNS_STATUS;
    }
    return switch (state) {
      case SUCCESS, PARTIAL_SUCCESS -> AppRunRecord.Status.SUCCESS.value();
      case FAILED -> AppRunRecord.Status.FAILED.value();
      case RUNNING -> AppRunRecord.Status.RUNNING.value();
      case QUEUED -> AppRunRecord.Status.PENDING.value();
      case STOPPED -> AppRunRecord.Status.STOPPED.value();
    };
  }

  /**
   * Fetch ingestion pipeline status for a specific service
   *
   * @param serviceName Service name to search for
   * @return List of pipeline statuses for the service
   */
  private List<Map> getIngestionPipelineStatus(String serviceName) {
    List<Map> combinedStatus = new ArrayList<>();
    final int pageSize = 100;
    final int maxResults = 5000;

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

      // Search for ingestion pipelines by service name using search
      SearchClient searchClient = Entity.getSearchRepository().getSearchClient();
      if (searchClient != null) {
        try {
          // Search for ingestion pipelines with the service name, paging through all results.
          for (int from = 0; from < maxResults; from += pageSize) {
            var response =
                searchClient.searchByField(
                    "service.name.keyword", serviceName, INGESTION_PIPELINE, false, from, pageSize);

            if (response == null || response.getStatus() != 200) {
              break;
            }

            String responseBody =
                (String) ((OutboundJaxrsResponse) response).getContext().getEntity();
            List<Map> pageStatuses = parseIngestionPipelineResponse(responseBody);
            if (pageStatuses.isEmpty()) {
              break;
            }

            combinedStatus.addAll(pageStatuses);
            if (pageStatuses.size() < pageSize) {
              break;
            }
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
   * Get workflow instances for a specific entity link
   * @param entityLink Entity link to filter workflow instances
   * @param startTime Start timestamp for data range
   * @param endTime End timestamp for data range
   * @return List of workflow instances
   */
  private List<Map> getWorkflowInstances(String entityLink, long startTime, long endTime) {
    List<Map> workflowInstances = new ArrayList<>();

    try {
      if (entityLink == null || entityLink.trim().isEmpty()) {
        return workflowInstances;
      }

      // Get the workflow instance repository
      WorkflowInstanceRepository workflowInstanceRepository =
          (WorkflowInstanceRepository)
              Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE);

      if (workflowInstanceRepository == null) {
        LOG.warn("WorkflowInstanceRepository not available");
        return workflowInstances;
      }

      // Create filter for workflow instances
      ListFilter filter = new ListFilter(null);
      filter.addQueryParam("entityFQNHash", FullyQualifiedName.buildHash("AutoPilotWorkflow"));
      filter.addQueryParam("entityLink", entityLink);

      // Fetch workflow instances
      ResultList<WorkflowInstance> instances =
          workflowInstanceRepository.list(null, startTime, endTime, 100, filter, false);

      if (instances != null && instances.getData() != null) {
        for (WorkflowInstance instance : instances.getData()) {
          Map<String, Object> instanceData = new HashMap<>();
          instanceData.put("id", instance.getId().toString());
          instanceData.put("workflowDefinitionId", instance.getWorkflowDefinitionId().toString());
          instanceData.put("startedAt", instance.getStartedAt());
          instanceData.put("endedAt", instance.getEndedAt());
          instanceData.put("status", instance.getStatus().toString());
          instanceData.put("timestamp", instance.getTimestamp());
          instanceData.put("variables", instance.getVariables());
          instanceData.put("entityLink", entityLink);
          instanceData.put("type", "workflow");

          workflowInstances.add(instanceData);
        }
      }

      LOG.info(
          "Found {} workflow instances for entity link: {}", workflowInstances.size(), entityLink);

    } catch (Exception e) {
      LOG.error("Error fetching workflow instances for entity link: {}", entityLink, e);
    }

    return workflowInstances;
  }

  /**
   * Parse the search response to extract ingestion pipeline information
   * @param responseBody JSON response from search
   * @return List of pipeline statuses
   */
  private List<Map> parseIngestionPipelineResponse(String responseBody) {
    return IngestionPipelineStatusParser.parse(responseBody);
  }

  @Override
  public void setFields(
      DataInsightCustomChart entity, EntityUtil.Fields fields, RelationIncludes relationIncludes) {
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
  public void storeEntities(List<DataInsightCustomChart> entities) {
    List<String> fqns = new ArrayList<>(entities.size());
    List<String> jsons = new ArrayList<>(entities.size());
    for (DataInsightCustomChart entity : entities) {
      fqns.add(entity.getFullyQualifiedName());
      jsons.add(serializeForStorage(entity));
    }
    dao.insertMany(dao.getTableName(), dao.getNameHashColumn(), fqns, jsons);
  }

  @Override
  public void storeRelationships(DataInsightCustomChart entity) {
    // No relationships to store beyond what is stored in the super class
  }

  static String combineFilters(String existingFilter, String userFilter) {
    if (existingFilter == null || existingFilter.isEmpty() || existingFilter.equals("{}")) {
      return userFilter;
    }
    if (userFilter == null || userFilter.isEmpty() || userFilter.equals("{}")) {
      return existingFilter;
    }
    try {
      JsonObject existingJson = JsonParser.parseString(existingFilter).getAsJsonObject();
      JsonObject userJson = JsonParser.parseString(userFilter).getAsJsonObject();

      JsonObject existingQuery = existingJson.getAsJsonObject("query");
      JsonObject userQuery = userJson.getAsJsonObject("query");

      if (existingQuery == null) return userFilter;
      if (userQuery == null) return existingFilter;

      JsonArray mustArray = new JsonArray();
      mustArray.add(existingQuery);
      mustArray.add(userQuery);

      JsonObject boolObj = new JsonObject();
      boolObj.add("must", mustArray);

      JsonObject combinedQuery = new JsonObject();
      combinedQuery.add("bool", boolObj);

      JsonObject result = new JsonObject();
      result.add("query", combinedQuery);

      return result.toString();
    } catch (Exception e) {
      LOG.warn("Failed to combine filters, using user filter as fallback: {}", e.getMessage());
      return userFilter;
    }
  }

  public DataInsightCustomChartResultList getPreviewData(
      DataInsightCustomChart chart, long startTimestamp, long endTimestamp, String filter)
      throws IOException {
    if (chart.getChartDetails() != null && filter != null) {
      HashMap chartDetails = (LinkedHashMap<String, Object>) chart.getChartDetails();
      if (chartDetails.get("metrics") != null) {
        for (LinkedHashMap<String, Object> metrics :
            (List<LinkedHashMap<String, Object>>) chartDetails.get("metrics")) {
          String existingFilter = (String) metrics.get("filter");
          metrics.put("filter", combineFilters(existingFilter, filter));
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
              String existingFilter = (String) metrics.get("filter");
              metrics.put("filter", combineFilters(existingFilter, filter));
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
   * @param entityLink Entity link (can be null)
   * @return Active session if exists, null otherwise
   */
  private StreamingSession findActiveSession(
      String chartNames, String serviceName, String entityLink) {
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
        .filter(
            session -> {
              // Handle null entityLink comparison
              if (entityLink == null && session.getEntityLink() == null) {
                return true;
              }
              if (entityLink != null && session.getEntityLink() != null) {
                return entityLink.equals(session.getEntityLink());
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
      String serviceType,
      String filter,
      String entityLink,
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
    StreamingSession existingSession = findActiveSession(chartNames, serviceName, entityLink);
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
          getAutomationStatus(existingSession.getServiceType(), serviceName),
          getWorkflowInstances(
              existingSession.getEntityLink(),
              existingSession.getDataStartTime(),
              existingSession.getDataEndTime()));

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
          startStreaming(
              chartNames, serviceName, serviceType, filter, entityLink, userId, startTime, endTime);

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
      String serviceType,
      String filter,
      String entityLink,
      UUID userId,
      Long startTime,
      Long endTime) {
    String sessionId = UUID.randomUUID().toString();

    LOG.info(
        "Starting chart data streaming session {} for user {} with charts: {} and entityLink: {} (time range: {} to {})",
        sessionId,
        userId,
        chartNames,
        entityLink,
        startTime,
        endTime);

    StreamingSession session =
        new StreamingSession(
            sessionId,
            chartNames,
            serviceName,
            serviceType,
            filter,
            entityLink,
            userId,
            startTime,
            endTime);
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
        getAutomationStatus(serviceType, serviceName),
        getWorkflowInstances(entityLink, startTime, endTime));

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

      sendMessageToAllUsers(
          session, "COMPLETED", null, null, 0L, 0L, List.of(), List.of(), List.of());
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
      sendMessageToAllUsers(
          session, "COMPLETED", null, null, 0L, 0L, List.of(), List.of(), List.of());
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
          getAutomationStatus(session.getServiceType(), session.getServiceName()),
          getWorkflowInstances(
              session.getEntityLink(), session.getDataStartTime(), session.getDataEndTime()));

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

      // Fetch workflow instances for the entity link
      List<Map> workflowInstances =
          getWorkflowInstances(session.getEntityLink(), startTime, endTime);

      // Send the data to all users in the session
      sendMessageToAllUsers(
          session,
          "DATA",
          chartData,
          null,
          remainingTime,
          UPDATE_INTERVAL_MS,
          ingestionPipelineStatus,
          getAutomationStatus(session.getServiceType(), session.getServiceName()),
          workflowInstances);

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
          List.of(),
          List.of());
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
          List.of(),
          List.of());
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
      List<Map> appStatus,
      List<Map> workflowInstances) {
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
            appStatus,
            workflowInstances);

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
      List<Map> appStatus,
      List<Map> workflowInstances) {
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
          appStatus,
          workflowInstances);
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
    private final String serviceType;
    private final String filter;
    private final String entityLink;
    private final Set<UUID> userIds; // Multiple users can share the same session
    private final long startTime; // Session start time
    private final long dataStartTime; // Data range start time
    private final long dataEndTime; // Data range end time
    private ScheduledFuture<?> future;

    public StreamingSession(
        String sessionId,
        String chartNames,
        String serviceName,
        String serviceType,
        String filter,
        String entityLink,
        UUID userId,
        Long dataStartTime,
        Long dataEndTime) {
      this.sessionId = sessionId;
      this.chartNames = chartNames;
      this.serviceName = serviceName;
      this.serviceType = serviceType;
      this.filter = filter;
      this.entityLink = entityLink;
      this.userIds = ConcurrentHashMap.newKeySet(); // Thread-safe set
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

    public String getServiceType() {
      return serviceType;
    }

    public String getFilter() {
      return filter;
    }

    public String getEntityLink() {
      return entityLink;
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
