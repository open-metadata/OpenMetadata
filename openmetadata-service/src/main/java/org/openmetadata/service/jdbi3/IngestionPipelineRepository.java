/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.EventType.ENTITY_FIELDS_CHANGED;
import static org.openmetadata.schema.type.EventType.ENTITY_UPDATED;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.INGESTION_PIPELINE;

import com.google.common.annotations.VisibleForTesting;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import jakarta.ws.rs.sse.Sse;
import jakarta.ws.rs.sse.SseEventSink;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.json.JSONObject;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.api.configuration.LogStorageConfiguration;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.entity.applications.configuration.ApplicationConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.OperationMetricsBatch;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.entity.services.ingestionPipelines.ProgressUpdate;
import org.openmetadata.schema.entity.services.ingestionPipelines.ProgressUpdateType;
import org.openmetadata.schema.metadataIngestion.ApplicationPipeline;
import org.openmetadata.schema.metadataIngestion.LogLevels;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.sdk.exception.IngestionRunnerUnavailableException;
import org.openmetadata.sdk.exception.PipelineServiceClientException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.cache.ListCountCache;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.logstorage.DefaultLogStorage;
import org.openmetadata.service.logstorage.LogStorageInterface;
import org.openmetadata.service.monitoring.IngestionProgressTracker;
import org.openmetadata.service.monitoring.IngestionProgressTracker.ProgressState;
import org.openmetadata.service.monitoring.ServiceProgressStreamer;
import org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineResource;
import org.openmetadata.service.resources.services.ingestionpipelines.ProgressSseManager;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Repository(name = "IngestionPipelineRepository")
public class IngestionPipelineRepository extends EntityRepository<IngestionPipeline> {

  private static final String UPDATE_FIELDS =
      "sourceConfig,airflowConfig,loggerLevel,enabled,deployed,processingEngine";
  private static final String PATCH_FIELDS =
      "sourceConfig,airflowConfig,loggerLevel,enabled,deployed,processingEngine";

  private static final String PIPELINE_STATUS_JSON_SCHEMA = "ingestionPipelineStatus";
  public static final String PIPELINE_STATUS_EXTENSION = "ingestionPipeline.pipelineStatus";
  private static final String RUN_ID_EXTENSION_KEY = "runId";
  private static final int DEFAULT_RECENT_RUN_LIMIT = 5;
  private static final int DEFAULT_QUEUED_STATUS_TIMEOUT_SECONDS = 3600;
  @Setter private PipelineServiceClientInterface pipelineServiceClient;
  @Setter @Getter private LogStorageInterface logStorage;
  @Setter @Getter private LogStorageConfiguration logStorageConfiguration;
  @Setter @Getter private IngestionProgressTracker progressTracker;

  // HTTP/2 metrics tracking
  private static long http2RequestCount = 0;
  private static long http1RequestCount = 0;
  private static long activeStreams = 0;

  @Getter private final OpenMetadataApplicationConfig openMetadataApplicationConfig;

  public IngestionPipelineRepository(OpenMetadataApplicationConfig config) {
    super(
        IngestionPipelineResource.COLLECTION_PATH,
        Entity.INGESTION_PIPELINE,
        IngestionPipeline.class,
        Entity.getCollectionDAO().ingestionPipelineDAO(),
        PATCH_FIELDS,
        UPDATE_FIELDS);
    this.supportsSearch = true;
    this.openMetadataApplicationConfig = config;
  }

  private static final String SORT_ORDER_DESC = "desc";

  /** SQL tokens for one scan direction, so the keyset queries never assemble them ad hoc. */
  private record SortDirection(String order, String reverseOrder, String forward, String backward) {
    static SortDirection of(boolean ascending) {
      return ascending
          ? new SortDirection("ASC", "DESC", ">", "<")
          : new SortDirection("DESC", "ASC", "<", ">");
    }
  }

  /**
   * When the filter carries {@code sortField=displayName}, list forward ordered by the value the
   * UI's Name column renders ({@code displayName ?? name}) instead of the raw {@code name}, keeping
   * keyset pagination. Otherwise the default name-ordered listing applies.
   *
   * <p>Overriding this seam — rather than forking the resource's {@code listInternal} — keeps
   * authorization, the domain filter and cursor validation shared with the normal list, so the two
   * orderings cannot drift (collate#3919).
   */
  @Override
  public ResultList<IngestionPipeline> listAfter(
      UriInfo uriInfo, Fields fields, ListFilter filter, int limitParam, String after) {
    ResultList<IngestionPipeline> result;
    if (nullOrEmpty(filter.getSortField())) {
      result = super.listAfter(uriInfo, fields, filter, limitParam, after);
    } else {
      result = forwardDisplayNamePage(uriInfo, fields, filter, limitParam, after);
    }
    return result;
  }

  @Override
  public ResultList<IngestionPipeline> listBefore(
      UriInfo uriInfo, Fields fields, ListFilter filter, int limitParam, String before) {
    ResultList<IngestionPipeline> result;
    if (nullOrEmpty(filter.getSortField())) {
      result = super.listBefore(uriInfo, fields, filter, limitParam, before);
    } else {
      result = beforeDisplayNamePage(uriInfo, fields, filter, limitParam, before);
    }
    return result;
  }

  private boolean isAscending(ListFilter filter) {
    return !SORT_ORDER_DESC.equalsIgnoreCase(filter.getSortOrder());
  }

  /** First page (no {@code after}) or a forward page from an {@code after} cursor. */
  private ResultList<IngestionPipeline> forwardDisplayNamePage(
      UriInfo uriInfo, Fields fields, ListFilter filter, int limitParam, String after) {
    int total = ListCountCache.getOrCompute(entityType, filter, () -> dao.listCount(filter));
    List<IngestionPipeline> entities = new ArrayList<>();
    String beforeCursor = null;
    String afterCursor = null;
    if (limitParam > 0) {
      SortDirection direction = SortDirection.of(isAscending(filter));
      entities =
          hydrateByDisplayName(
              forwardJsons(filter, direction, limitParam, after), fields, uriInfo, filter);
      beforeCursor = forwardBeforeCursor(after, entities);
      if (entities.size() > limitParam) {
        entities.remove(limitParam);
        afterCursor = displayNameCursorValue(entities.get(limitParam - 1));
      }
    }
    return getResultList(entities, beforeCursor, afterCursor, total);
  }

  private List<String> forwardJsons(
      ListFilter filter, SortDirection direction, int limitParam, String after) {
    // getCondition registers derived bind params on the filter and the serviceType variant is a
    // join the plain ListFilter condition cannot express, so resolve the scope once.
    String condition = ingestionPipelineDAO().displayNameSortCondition(filter);
    String displayExpr = ingestionPipelineDAO().displayNameSortExpression();
    List<String> jsons;
    if (nullOrEmpty(after)) {
      jsons =
          ingestionPipelineDAO()
              .listByDisplayName(
                  filter.getQueryParams(),
                  condition,
                  displayExpr,
                  direction.order(),
                  limitParam + 1);
    } else {
      DisplayNameCursor cursor = parseDisplayNameCursor(after);
      jsons =
          ingestionPipelineDAO()
              .listAfterByDisplayName(
                  filter.getQueryParams(),
                  condition,
                  displayExpr,
                  direction.order(),
                  direction.forward(),
                  limitParam + 1,
                  cursor.displayName(),
                  cursor.id());
    }
    return jsons;
  }

  /** Backward page from a {@code before} cursor; the DAO walks reverse then re-sorts the page. */
  private ResultList<IngestionPipeline> beforeDisplayNamePage(
      UriInfo uriInfo, Fields fields, ListFilter filter, int limitParam, String before) {
    int total = ListCountCache.getOrCompute(entityType, filter, () -> dao.listCount(filter));
    List<IngestionPipeline> entities = new ArrayList<>();
    String beforeCursor = null;
    String afterCursor = null;
    if (limitParam > 0) {
      SortDirection direction = SortDirection.of(isAscending(filter));
      entities =
          hydrateByDisplayName(
              beforeJsons(filter, direction, limitParam, before), fields, uriInfo, filter);
      if (entities.size() > limitParam) {
        entities.remove(0);
        beforeCursor = displayNameCursorValue(entities.get(0));
      }
      // Empty page = cursor valid but every earlier row was deleted concurrently. Echo the caller's
      // cursor rather than null, which reads as end-of-pagination. Mirrors listBefore.
      afterCursor =
          entities.isEmpty()
              ? RestUtil.decodeCursor(before)
              : displayNameCursorValue(entities.get(entities.size() - 1));
    }
    return getResultList(entities, beforeCursor, afterCursor, total);
  }

  private List<String> beforeJsons(
      ListFilter filter, SortDirection direction, int limitParam, String before) {
    String condition = ingestionPipelineDAO().displayNameSortCondition(filter);
    String displayExpr = ingestionPipelineDAO().displayNameSortExpression();
    DisplayNameCursor cursor = parseDisplayNameCursor(before);
    return ingestionPipelineDAO()
        .listBeforeByDisplayName(
            filter.getQueryParams(),
            condition,
            displayExpr,
            direction.order(),
            direction.reverseOrder(),
            direction.backward(),
            limitParam + 1,
            cursor.displayName(),
            cursor.id());
  }

  private CollectionDAO.IngestionPipelineDAO ingestionPipelineDAO() {
    return Entity.getCollectionDAO().ingestionPipelineDAO();
  }

  /**
   * {@link ResultList} base64-encodes whatever cursor it is handed, so both branches have to yield
   * the decoded form: {@link #displayNameCursorValue} produces raw JSON, and the echoed cursor
   * arrived off the wire already encoded.
   */
  @VisibleForTesting
  String forwardBeforeCursor(String after, List<IngestionPipeline> entities) {
    String beforeCursor = null;
    if (!nullOrEmpty(after)) {
      beforeCursor =
          entities.isEmpty()
              ? RestUtil.decodeCursor(after)
              : displayNameCursorValue(entities.get(0));
    }
    return beforeCursor;
  }

  private List<IngestionPipeline> hydrateByDisplayName(
      List<String> jsons, Fields fields, UriInfo uriInfo, ListFilter filter) {
    List<IngestionPipeline> entities = JsonUtils.readObjects(jsons, IngestionPipeline.class);
    setFieldsInBulk(fields, entities, filter);
    entities.forEach(entity -> withHref(uriInfo, entity));
    return entities;
  }

  @VisibleForTesting
  DisplayNameCursor parseDisplayNameCursor(String cursor) {
    Map<String, String> cursorMap = parseCursorMap(RestUtil.decodeCursor(cursor));
    String displayName = cursorMap.get("displayNameSort");
    String id = cursorMap.get("id");
    if (displayName == null || id == null || id.isBlank()) {
      throw new BadRequestException("Invalid cursor for sortField pagination");
    }
    return new DisplayNameCursor(displayName, id);
  }

  /**
   * Reproduces the ORDER BY expression — {@code COALESCE(NULLIF(displayName,''), name)} — as the
   * cursor's sort key. The value is carried verbatim (no truncation and not case-folded), so it
   * matches the un-truncated SQL expression exactly and comparison stays inside the database.
   */
  @VisibleForTesting
  String displayNameCursorValue(IngestionPipeline pipeline) {
    String displayName = pipeline.getDisplayName();
    String sortKey = nullOrEmpty(displayName) ? pipeline.getName() : displayName;
    return JsonUtils.pojoToJson(
        Map.of(
            "displayNameSort", sortKey == null ? "" : sortKey, "id", pipeline.getId().toString()));
  }

  @VisibleForTesting
  record DisplayNameCursor(String displayName, String id) {}

  @Override
  public void setFullyQualifiedName(IngestionPipeline ingestionPipeline) {
    if (ingestionPipeline.getService() == null) {
      // Service might not be set when listing with minimal fields
      EntityReference service = getContainer(ingestionPipeline.getId());
      ingestionPipeline.withService(service);
    }
    ingestionPipeline.setFullyQualifiedName(
        FullyQualifiedName.add(
            ingestionPipeline.getService().getFullyQualifiedName(), ingestionPipeline.getName()));
  }

  @Override
  public void setFields(
      IngestionPipeline ingestionPipeline, Fields fields, RelationIncludes relationIncludes) {
    if (ingestionPipeline.getService() == null) {
      ingestionPipeline.withService(getContainer(ingestionPipeline.getId()));
    }
    ingestionPipeline.setPipelineStatuses(
        fields.contains("pipelineStatuses")
            ? getRecentPipelineStatuses(ingestionPipeline.getFullyQualifiedName())
            : ingestionPipeline.getPipelineStatuses());

    if (ingestionPipeline.getSourceConfig() != null
        && ingestionPipeline.getSourceConfig().getConfig() != null) {
      JSONObject sourceConfigJson =
          new JSONObject(JsonUtils.pojoToJson(ingestionPipeline.getSourceConfig().getConfig()));
      Optional.ofNullable(sourceConfigJson.optJSONObject("appConfig"))
          .map(appConfig -> appConfig.optString("type", null))
          .ifPresent(ingestionPipeline::setApplicationType);
    }
  }

  @Override
  public void setInheritedFields(IngestionPipeline ingestionPipeline, Fields fields) {
    EntityReference serviceRef = ingestionPipeline.getService();
    if (serviceRef == null) {
      return;
    }
    try {
      EntityInterface parent = Entity.getEntity(serviceRef, "owners,domains", ALL);
      inheritOwners(ingestionPipeline, fields, parent);
      inheritDomains(ingestionPipeline, fields, parent);
    } catch (EntityNotFoundException e) {
      LOG.debug(
          "Parent service {} not found for ingestion pipeline {}; skipping owner/domain inheritance",
          serviceRef.getFullyQualifiedName(),
          ingestionPipeline.getFullyQualifiedName());
    }
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<IngestionPipeline> entities) {
    if (entities == null || entities.isEmpty()) {
      return;
    }
    // Bulk fetch and set default fields (service) for all pipelines first
    fetchAndSetDefaultFields(entities, fields);

    // Then call parent's implementation which handles standard fields
    super.setFieldsInBulk(fields, entities);
  }

  private void fetchAndSetDefaultFields(List<IngestionPipeline> pipelines, Fields fields) {
    if (pipelines == null || pipelines.isEmpty()) {
      return;
    }

    // Batch fetch service references for all pipelines
    Map<UUID, EntityReference> serviceRefs = batchFetchServices(pipelines);

    // Batch fetch recent pipeline statuses if requested
    Map<String, List<PipelineStatus>> statusMap = Map.of();
    if (fields.contains("pipelineStatuses")) {
      statusMap = batchFetchRecentPipelineStatuses(pipelines);
    }

    for (IngestionPipeline pipeline : pipelines) {
      if (fields.contains("pipelineStatuses")) {
        String fqnHash = FullyQualifiedName.buildHash(pipeline.getFullyQualifiedName());
        pipeline.setPipelineStatuses(statusMap.get(fqnHash));
      }
      EntityReference serviceRef = serviceRefs.get(pipeline.getId());
      if (serviceRef != null) {
        pipeline.withService(serviceRef);
      } else {
        LOG.warn(
            "Service not found in batch fetch for pipeline: {} (id: {}). Fetching individually.",
            pipeline.getName(),
            pipeline.getId());
        EntityReference service = getContainer(pipeline.getId());
        if (service != null) {
          pipeline.withService(service);
        } else {
          LOG.error(
              "No service found for ingestion pipeline: {} (id: {})",
              pipeline.getName(),
              pipeline.getId());
        }
      }
    }
  }

  private Map<String, List<PipelineStatus>> batchFetchRecentPipelineStatuses(
      List<IngestionPipeline> pipelines) {
    List<String> fqnHashes =
        pipelines.stream()
            .map(p -> FullyQualifiedName.buildHash(p.getFullyQualifiedName()))
            .toList();
    Map<String, List<String>> jsonMap =
        getLatestExtensionsFromTimeSeriesBatch(
            fqnHashes, PIPELINE_STATUS_EXTENSION, DEFAULT_RECENT_RUN_LIMIT);
    Map<String, List<PipelineStatus>> result = new HashMap<>();
    for (Map.Entry<String, List<String>> entry : jsonMap.entrySet()) {
      result.put(entry.getKey(), toPipelineStatuses(entry.getValue()));
    }
    return result;
  }

  public List<PipelineStatus> getRecentPipelineStatuses(String ingestionPipelineFQN) {
    String fqnHash = FullyQualifiedName.buildHash(ingestionPipelineFQN);
    Map<String, List<String>> jsonMap =
        getLatestExtensionsFromTimeSeriesBatch(
            List.of(fqnHash), PIPELINE_STATUS_EXTENSION, DEFAULT_RECENT_RUN_LIMIT);
    return toPipelineStatuses(jsonMap.getOrDefault(fqnHash, List.of()));
  }

  /**
   * The single conversion point for the `pipelineStatuses` entity field, which both the single-entity
   * and the bulk read go through, so the stale-queued cutoff has to be applied here as well as in
   * {@link #listPipelineStatus} or the Agents page would keep showing a run that never started.
   */
  private List<PipelineStatus> toPipelineStatuses(List<String> jsonValues) {
    List<PipelineStatus> pipelineStatusList =
        jsonValues.stream()
            .map(json -> JsonUtils.readValue(json, PipelineStatus.class))
            .filter(Objects::nonNull)
            .toList();
    return dropStaleQueuedStatuses(pipelineStatusList);
  }

  public static PipelineStatus latestPipelineStatus(IngestionPipeline ingestionPipeline) {
    List<PipelineStatus> statuses = ingestionPipeline.getPipelineStatuses();
    return nullOrEmpty(statuses) ? null : statuses.getFirst();
  }

  private Map<UUID, EntityReference> batchFetchServices(List<IngestionPipeline> pipelines) {
    Map<UUID, EntityReference> serviceMap = new HashMap<>();
    if (pipelines == null || pipelines.isEmpty()) {
      return serviceMap;
    }

    // Single batch query to get all services for all pipelines
    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
            .relationshipDAO()
            .findFromBatch(entityListToStrings(pipelines), Relationship.CONTAINS.ordinal());

    for (CollectionDAO.EntityRelationshipObject record : records) {
      UUID pipelineId = UUID.fromString(record.getToId());
      EntityReference serviceRef =
          Entity.getEntityReferenceById(
              record.getFromEntity(), UUID.fromString(record.getFromId()), Include.NON_DELETED);
      serviceMap.put(pipelineId, serviceRef);
    }

    return serviceMap;
  }

  @Override
  public void clearFields(IngestionPipeline ingestionPipeline, Fields fields) {
    /* Nothing to do */
  }

  @Override
  public void prepare(IngestionPipeline ingestionPipeline, boolean update) {
    var service = getCachedParentOrLoad(ingestionPipeline.getService(), "", Include.NON_DELETED);
    ingestionPipeline.setService(service.getEntityReference());
  }

  @Override
  protected IngestionPipeline restorePatchSecrets(
      IngestionPipeline original, IngestionPipeline updated) {
    EntityMaskerFactory.getEntityMasker().unmaskIngestionPipeline(updated, original);
    return updated;
  }

  protected boolean requiresRedeployment(IngestionPipeline original, IngestionPipeline updated) {
    if (hasScheduleChanged(original, updated)) {
      LOG.debug("Pipeline '{}' requires redeployment: schedule changed", updated.getName());
      return true;
    }

    if (!Objects.equals(original.getEnabled(), updated.getEnabled())) {
      LOG.debug(
          "Pipeline '{}' requires redeployment: enabled changed from {} to {}",
          updated.getName(),
          original.getEnabled(),
          updated.getEnabled());
      return true;
    }

    if (hasSourceConfigChanged(original, updated)) {
      LOG.debug("Pipeline '{}' requires redeployment: sourceConfig changed", updated.getName());
      return true;
    }

    if (!Objects.equals(original.getLoggerLevel(), updated.getLoggerLevel())) {
      LOG.debug(
          "Pipeline '{}' requires redeployment: loggerLevel changed from {} to {}",
          updated.getName(),
          original.getLoggerLevel(),
          updated.getLoggerLevel());
      return true;
    }

    return false;
  }

  boolean hasScheduleChanged(IngestionPipeline original, IngestionPipeline updated) {
    String originalSchedule =
        original.getAirflowConfig() != null
            ? original.getAirflowConfig().getScheduleInterval()
            : null;
    String updatedSchedule =
        updated.getAirflowConfig() != null
            ? updated.getAirflowConfig().getScheduleInterval()
            : null;
    return !Objects.equals(originalSchedule, updatedSchedule);
  }

  boolean hasSourceConfigChanged(IngestionPipeline original, IngestionPipeline updated) {
    if (original.getSourceConfig() == null && updated.getSourceConfig() == null) {
      return false;
    }
    if (original.getSourceConfig() == null || updated.getSourceConfig() == null) {
      return true;
    }
    String originalJson = JsonUtils.pojoToJson(original.getSourceConfig());
    String updatedJson = JsonUtils.pojoToJson(updated.getSourceConfig());
    return !originalJson.equals(updatedJson);
  }

  protected void deployPipelineBeforeUpdate(IngestionPipeline ingestionPipeline) {
    IngestionPipeline decrypted = buildIngestionPipelineDecrypted(ingestionPipeline);

    // Restore service reference lost during JSON round-trip (service is a relationship,
    // not stored in the entity JSON). Fall back to fetching from the relationships table.
    if (decrypted.getService() == null) {
      EntityReference serviceRef =
          ingestionPipeline.getService() != null
              ? ingestionPipeline.getService()
              : getContainer(ingestionPipeline.getId());
      if (serviceRef == null) {
        throw new IllegalStateException(
            String.format(
                "Cannot deploy pipeline '%s': no service reference found. "
                    + "The pipeline may have a broken service relationship.",
                ingestionPipeline.getName()));
      }
      decrypted.setService(serviceRef);
    }

    OpenMetadataConnection openMetadataServerConnection =
        new org.openmetadata.service.util.OpenMetadataConnectionBuilder(
                openMetadataApplicationConfig, decrypted)
            .build();
    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
    decrypted.setOpenMetadataServerConnection(
        secretsManager.encryptOpenMetadataConnection(openMetadataServerConnection, false));

    ServiceEntityInterface service =
        Entity.getEntity(decrypted.getService(), "", Include.NON_DELETED);

    PipelineServiceClientResponse deployResponse = deployIngestionPipeline(decrypted, service);

    if (deployResponse.getCode() != 200) {
      String errorContext = extractErrorContext(deployResponse.getReason());
      throw new PipelineServiceClientException(
          String.format("Deployment failed: %s. Changes not saved.", errorContext));
    }

    LOG.info(
        "Pipeline '{}' deployed successfully to {} with response: {}",
        decrypted.getName(),
        deployResponse.getPlatform(),
        deployResponse.getReason());
  }

  String extractErrorContext(String message) {
    if (message == null || message.isEmpty()) {
      return "runner unavailable";
    }

    if (message.contains("WebSocket is inactive") || message.contains("WebSocket")) {
      return "runner not connected";
    }

    if (message.contains("Connection refused")) {
      return "connection refused";
    }

    if (message.contains("timeout") || message.contains("timed out")) {
      return "connection timeout";
    }

    if (message.contains("Failed to delete CRON")) {
      return "cannot update workflow";
    }

    if (message.length() > 50) {
      return "deployment error";
    }

    return message;
  }

  @Transaction
  public IngestionPipeline deletePipelineStatus(UUID ingestionPipelineId) {
    // Validate the request content
    IngestionPipeline ingestionPipeline = find(ingestionPipelineId, Include.NON_DELETED);
    daoCollection
        .entityExtensionTimeSeriesDao()
        .delete(ingestionPipeline.getFullyQualifiedName(), PIPELINE_STATUS_EXTENSION);
    setFieldsInternal(ingestionPipeline, Fields.EMPTY_FIELDS);
    return ingestionPipeline;
  }

  @Override
  protected List<String> getFieldsStrippedFromStorageJson() {
    return List.of(
        "service", "openMetadataServerConnection", "processingEngine", "pipelineStatuses");
  }

  @Override
  public void storeEntity(IngestionPipeline ingestionPipeline, boolean update) {
    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();

    if (secretsManager != null) {
      secretsManager.encryptIngestionPipeline(ingestionPipeline);
    }
    store(ingestionPipeline, update);
  }

  @Override
  public void storeEntities(List<IngestionPipeline> entities) {
    List<String> fqns = new ArrayList<>(entities.size());
    List<String> jsons = new ArrayList<>(entities.size());
    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();

    for (IngestionPipeline ingestionPipeline : entities) {
      if (secretsManager != null) {
        secretsManager.encryptIngestionPipeline(ingestionPipeline);
      }

      fqns.add(ingestionPipeline.getFullyQualifiedName());
      jsons.add(serializeForStorage(ingestionPipeline));
    }

    dao.insertMany(dao.getTableName(), dao.getNameHashColumn(), fqns, jsons);
  }

  @Override
  protected void clearEntitySpecificRelationshipsForMany(List<IngestionPipeline> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(IngestionPipeline::getId).toList();
    deleteToMany(ids, entityType, Relationship.CONTAINS, null);
    deleteFromMany(ids, entityType, Relationship.USES, null);
  }

  @Override
  public void storeRelationships(IngestionPipeline ingestionPipeline) {
    addServiceRelationship(ingestionPipeline, ingestionPipeline.getService());
    if (ingestionPipeline.getIngestionRunner() != null) {
      addRelationship(
          ingestionPipeline.getId(),
          ingestionPipeline.getIngestionRunner().getId(),
          entityType,
          ingestionPipeline.getIngestionRunner().getType(),
          Relationship.USES);
    }

    if (ingestionPipeline.getProcessingEngine() != null) {
      addRelationship(
          ingestionPipeline.getId(),
          ingestionPipeline.getProcessingEngine().getId(),
          entityType,
          ingestionPipeline.getProcessingEngine().getType(),
          Relationship.USES);
    }
  }

  @Override
  public EntityRepository<IngestionPipeline>.EntityUpdater getUpdater(
      IngestionPipeline original,
      IngestionPipeline updated,
      Operation operation,
      ChangeSource changeSource) {
    return new IngestionPipelineUpdater(original, updated, operation);
  }

  /**
   * Removing the DAG from the orchestrator is irreversible, so it must only happen when the entity
   * itself is going away for good. A soft delete is reversible and {@code restoreEntity} has no way
   * to redeploy, so tearing the runner down there left a restored pipeline with no backing DAG —
   * and, with {@code allowUnavailableRunner=false}, failed the whole soft delete outright whenever
   * the runner happened to be down. The accepted trade-off is that nothing pauses the DAG either,
   * so a soft-deleted pipeline keeps running on schedule and recording statuses until it is
   * restored or hard-deleted; pausing it would need a restore-time redeploy hook that does not
   * exist yet.
   *
   * <p>The teardown stays here rather than moving to {@link #entitySpecificCleanup} (where the
   * pipeline's time series went) because it is a blocking remote call that must not run inside the
   * real transaction {@code cleanup()} opens, and because {@code forceDelete} threads
   * {@code allowUnavailableRunner} through the overload below and reads back the skip flag.
   */
  @Override
  protected void postDelete(IngestionPipeline entity, boolean hardDelete) {
    postDelete(entity, hardDelete, false);
  }

  /**
   * Variant of {@link #postDelete(IngestionPipeline, boolean)} for {@code forceDelete}: tolerates an
   * unreachable ingestion runner when {@code allowUnavailableRunner} is set and reports back whether
   * the runner cleanup was skipped, so the caller can warn about the DAG left behind.
   */
  private boolean postDelete(
      IngestionPipeline entity, boolean hardDelete, boolean allowUnavailableRunner) {
    super.postDelete(entity, hardDelete);
    boolean wasRunnerCleanupSkipped = false;
    if (hardDelete) {
      wasRunnerCleanupSkipped = deleteDeployedPipeline(entity, allowUnavailableRunner);
    }
    return wasRunnerCleanupSkipped;
  }

  /**
   * Pipeline run history is destroyed only on hard delete: {@code entitySpecificCleanup} is reached
   * exclusively from {@code cleanup()}, which the delete path runs on the hard-delete branch only.
   */
  @Override
  protected void entitySpecificCleanup(IngestionPipeline entity) {
    deletePipelineStatuses(entity);
  }

  protected boolean deleteDeployedPipeline(
      IngestionPipeline entity, boolean allowUnavailableRunner) {
    boolean wasRunnerCleanupSkipped = false;
    if (pipelineServiceClient != null) {
      try {
        pipelineServiceClient.deletePipeline(entity);
      } catch (IngestionRunnerUnavailableException exception) {
        if (allowUnavailableRunner) {
          wasRunnerCleanupSkipped = true;
        } else {
          throw exception;
        }
      }
    } else {
      LOG.debug(
          "Skipping pipeline service delete for '{}' because pipeline service client is not configured.",
          entity.getFullyQualifiedName());
    }
    return wasRunnerCleanupSkipped;
  }

  private void deletePipelineStatuses(IngestionPipeline entity) {
    daoCollection
        .entityExtensionTimeSeriesDao()
        .delete(entity.getFullyQualifiedName(), PIPELINE_STATUS_EXTENSION);
  }

  @Transaction
  public ForcedDeleteResult forceDelete(String deletedBy, UUID id) {
    RestUtil.DeleteResponse<IngestionPipeline> response =
        deleteInternal(deletedBy, id, false, true);
    boolean wasRunnerCleanupSkipped = postDelete(response.entity(), true, true);
    deleteFromSearch(response.entity(), true);
    if (wasRunnerCleanupSkipped) {
      LOG.warn(
          "Force delete skipped ingestion runner cleanup [user={}, pipelineFqn={}, pipelineId={}]",
          deletedBy,
          response.entity().getFullyQualifiedName(),
          id);
    }
    return new ForcedDeleteResult(response, wasRunnerCleanupSkipped);
  }

  public record ForcedDeleteResult(
      RestUtil.DeleteResponse<IngestionPipeline> response, boolean wasRunnerCleanupSkipped) {}

  @Override
  protected EntityReference getParentReference(IngestionPipeline entity) {
    return entity.getService();
  }

  @Override
  public EntityInterface getParentEntity(IngestionPipeline entity, String fields) {
    if (entity.getService() == null) {
      // Try to load the service if it's not set
      LOG.warn(
          "Service not set for ingestion pipeline: {} (id: {}). Loading it now.",
          entity.getName(),
          entity.getId());
      EntityReference service = getContainer(entity.getId());
      if (service != null) {
        entity.withService(service);
        return Entity.getEntity(service, fields, Include.ALL);
      } else {
        LOG.error(
            "No service found for ingestion pipeline: {} (id: {})",
            entity.getName(),
            entity.getId());
        return null;
      }
    }
    return Entity.getEntity(entity.getService(), fields, Include.ALL);
  }

  protected ChangeEvent getChangeEvent(
      EntityInterface updated, ChangeDescription change, String entityType, Double prevVersion) {
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEntity(updated)
        .withChangeDescription(change)
        .withEventType(ENTITY_UPDATED)
        .withEntityType(entityType)
        .withEntityId(updated.getId())
        .withEntityFullyQualifiedName(updated.getFullyQualifiedName())
        .withUserName(updated.getUpdatedBy())
        .withTimestamp(System.currentTimeMillis())
        .withCurrentVersion(updated.getVersion())
        .withPreviousVersion(prevVersion);
  }

  private ChangeDescription addPipelineStatusChangeDescription(
      Double version, Object newValue, Object oldValue) {
    FieldChange fieldChange =
        new FieldChange().withName("pipelineStatus").withNewValue(newValue).withOldValue(oldValue);
    ChangeDescription change = new ChangeDescription().withPreviousVersion(version);
    change.getFieldsUpdated().add(fieldChange);
    return change;
  }

  public RestUtil.PutResponse<?> addPipelineStatus(
      UriInfo uriInfo, String fqn, PipelineStatus pipelineStatus) {
    // updateEntityIndex below can rebuild the whole search document from this entity, so load
    // every field it indexes; anything missing here gets wiped from the index on each run.
    IngestionPipeline ingestionPipeline =
        getByName(uriInfo, fqn, getFields("service,owners,domains,followers"));
    PipelineStatus storedPipelineStatus =
        JsonUtils.readValue(
            daoCollection
                .entityExtensionTimeSeriesDao()
                .getLatestExtensionByKey(
                    RUN_ID_EXTENSION_KEY,
                    pipelineStatus.getRunId(),
                    ingestionPipeline.getFullyQualifiedName(),
                    PIPELINE_STATUS_EXTENSION),
            PipelineStatus.class);
    if (storedPipelineStatus != null) {
      daoCollection
          .entityExtensionTimeSeriesDao()
          .updateExtensionByKey(
              RUN_ID_EXTENSION_KEY,
              pipelineStatus.getRunId(),
              ingestionPipeline.getFullyQualifiedName(),
              PIPELINE_STATUS_EXTENSION,
              JsonUtils.pojoToJson(pipelineStatus));
    } else {
      daoCollection
          .entityExtensionTimeSeriesDao()
          .insert(
              ingestionPipeline.getFullyQualifiedName(),
              PIPELINE_STATUS_EXTENSION,
              PIPELINE_STATUS_JSON_SCHEMA,
              JsonUtils.pojoToJson(pipelineStatus));
    }
    ChangeDescription change =
        addPipelineStatusChangeDescription(
            ingestionPipeline.getVersion(), pipelineStatus, storedPipelineStatus);
    ingestionPipeline.setPipelineStatuses(
        getRecentPipelineStatuses(ingestionPipeline.getFullyQualifiedName()));
    ingestionPipeline.setChangeDescription(change);

    // Ensure entity reference is set before firing lifecycle event
    setFullyQualifiedName(ingestionPipeline);

    // Update ES Indexes
    searchRepository.updateEntityIndex(ingestionPipeline);

    // Fire lifecycle event for handlers (e.g., TestSuitePipelineStatusHandler)
    EntityLifecycleEventDispatcher.getInstance().onEntityUpdated(ingestionPipeline, change, null);

    ChangeEvent changeEvent =
        getChangeEvent(
            withHref(uriInfo, ingestionPipeline),
            change,
            entityType,
            ingestionPipeline.getVersion());

    return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, ENTITY_FIELDS_CHANGED);
  }

  public ResultList<PipelineStatus> listPipelineStatus(
      String ingestionPipelineFQN, Long startTs, Long endTs) {
    return listPipelineStatus(ingestionPipelineFQN, startTs, endTs, null);
  }

  public ResultList<PipelineStatus> listPipelineStatus(
      String ingestionPipelineFQN, Long startTs, Long endTs, Integer limit) {
    IngestionPipeline ingestionPipeline =
        getByName(null, ingestionPipelineFQN, getFields("service"));
    Integer effectiveLimit = resolvePipelineStatusLimit(startTs, endTs, limit);
    Long effectiveStartTs = Optional.ofNullable(startTs).orElse(Long.MIN_VALUE);
    Long effectiveEndTs = Optional.ofNullable(endTs).orElse(Long.MAX_VALUE);
    List<String> jsonResults;
    if (effectiveLimit != null) {
      jsonResults =
          getResultsFromAndToTimestampsWithLimit(
              ingestionPipeline.getFullyQualifiedName(),
              PIPELINE_STATUS_EXTENSION,
              effectiveStartTs,
              effectiveEndTs,
              EntityTimeSeriesDAO.OrderBy.DESC,
              effectiveLimit);
    } else {
      jsonResults =
          getResultsFromAndToTimestamps(
              ingestionPipeline.getFullyQualifiedName(),
              PIPELINE_STATUS_EXTENSION,
              effectiveStartTs,
              effectiveEndTs);
    }
    List<PipelineStatus> pipelineStatusList =
        dropStaleQueuedStatuses(JsonUtils.readObjects(jsonResults, PipelineStatus.class));
    List<PipelineStatus> allPipelineStatusList = new ArrayList<>();
    if (pipelineServiceClient != null) {
      allPipelineStatusList.addAll(
          pipelineServiceClient.getQueuedPipelineStatus(ingestionPipeline));
    }
    allPipelineStatusList.addAll(pipelineStatusList);
    allPipelineStatusList.sort(
        Comparator.comparing(
            PipelineStatus::getTimestamp, Comparator.nullsLast(Comparator.reverseOrder())));

    if (effectiveLimit != null && allPipelineStatusList.size() > effectiveLimit) {
      allPipelineStatusList = new ArrayList<>(allPipelineStatusList.subList(0, effectiveLimit));
    }

    return new ResultList<>(
        allPipelineStatusList,
        startTs != null ? String.valueOf(startTs) : null,
        endTs != null ? String.valueOf(endTs) : null,
        allPipelineStatusList.size());
  }

  private Integer resolvePipelineStatusLimit(Long startTs, Long endTs, Integer limit) {
    if (limit != null) {
      return limit;
    }
    return startTs == null && endTs == null ? DEFAULT_RECENT_RUN_LIMIT : null;
  }

  /**
   * Records the {@code queued} state of a run the orchestrator has just accepted, so that run
   * history can show it without polling the orchestrator. Best effort: the run is already going, so
   * failing to record its queued state must not fail the trigger.
   */
  public void recordQueuedPipelineStatus(UriInfo uriInfo, String pipelineFQN, String runId) {
    if (nullOrEmpty(runId)) {
      return;
    }
    long now = System.currentTimeMillis();
    PipelineStatus queuedStatus =
        new PipelineStatus()
            .withRunId(runId)
            .withPipelineState(PipelineStatusType.QUEUED)
            .withStartDate(now)
            .withTimestamp(now);
    try {
      addPipelineStatus(uriInfo, pipelineFQN, queuedStatus);
    } catch (RuntimeException e) {
      LOG.warn(
          "Failed to record queued status for pipeline [{}] run [{}]: {}",
          pipelineFQN,
          runId,
          e.getMessage());
    }
  }

  private List<PipelineStatus> dropStaleQueuedStatuses(List<PipelineStatus> pipelineStatusList) {
    return withoutStaleQueuedStatuses(
        pipelineStatusList, System.currentTimeMillis() - queuedStatusTimeoutMillis());
  }

  /**
   * Hides {@code queued} runs recorded before {@code cutoff}. An orchestrator can accept a run and
   * never start it, and since no worker ever reports on such a run its queued status would
   * otherwise stay pending in run history forever.
   */
  static List<PipelineStatus> withoutStaleQueuedStatuses(
      List<PipelineStatus> pipelineStatusList, long cutoff) {
    return pipelineStatusList.stream()
        .filter(pipelineStatus -> !isStaleQueued(pipelineStatus, cutoff))
        .toList();
  }

  private static boolean isStaleQueued(PipelineStatus pipelineStatus, long cutoff) {
    return PipelineStatusType.QUEUED.equals(pipelineStatus.getPipelineState())
        && pipelineStatus.getTimestamp() != null
        && pipelineStatus.getTimestamp() < cutoff;
  }

  private long queuedStatusTimeoutMillis() {
    Integer configuredTimeout =
        Optional.ofNullable(openMetadataApplicationConfig)
            .map(OpenMetadataApplicationConfig::getPipelineServiceClientConfiguration)
            .map(PipelineServiceClientConfiguration::getQueuedStatusTimeoutSeconds)
            .orElse(null);
    return TimeUnit.SECONDS.toMillis(
        configuredTimeout == null ? DEFAULT_QUEUED_STATUS_TIMEOUT_SECONDS : configuredTimeout);
  }

  /* Get the status of the external application by converting the configuration so that it can be
   * served like an App configuration */
  public ResultList<PipelineStatus> listExternalAppStatus(
      String ingestionPipelineFQN, Long startTs, Long endTs) {
    return listPipelineStatus(ingestionPipelineFQN, startTs, endTs)
        .map(
            pipelineStatus ->
                pipelineStatus.withConfig(
                    Optional.ofNullable(pipelineStatus.getConfig())
                        .map(m -> m.getOrDefault("appConfig", null))
                        .map(JsonUtils::getMap)
                        .orElse(null)));
  }

  public ResultList<PipelineStatus> listExternalAppStatus(
      String ingestionPipelineFQN, String serviceName, Long startTs, Long endTs) {
    return listPipelineStatus(ingestionPipelineFQN, startTs, endTs)
        .filter(
            pipelineStatus -> {
              Map<String, Object> metadata = pipelineStatus.getMetadata();
              if (metadata == null) {
                return false;
              }
              Map<String, Object> workflowMetadata =
                  JsonUtils.readOrConvertValue(metadata.get("workflow"), Map.class);
              String pipelineStatusService = (String) workflowMetadata.get("serviceName");
              return pipelineStatusService != null && pipelineStatusService.equals(serviceName);
            })
        .map(
            pipelineStatus ->
                pipelineStatus.withConfig(
                    Optional.ofNullable(pipelineStatus.getConfig())
                        .map(m -> m.getOrDefault("appConfig", null))
                        .map(JsonUtils::getMap)
                        .orElse(null)));
  }

  public PipelineStatus getLatestPipelineStatus(IngestionPipeline ingestionPipeline) {
    return JsonUtils.readValue(
        getLatestExtensionFromTimeSeries(
            ingestionPipeline.getFullyQualifiedName(), PIPELINE_STATUS_EXTENSION),
        PipelineStatus.class);
  }

  public PipelineStatus getPipelineStatus(String ingestionPipelineFQN, UUID pipelineStatusRunId) {
    return getPipelineStatus(ingestionPipelineFQN, pipelineStatusRunId.toString());
  }

  public PipelineStatus getPipelineStatus(String ingestionPipelineFQN, String runId) {
    IngestionPipeline ingestionPipeline = findByName(ingestionPipelineFQN, Include.NON_DELETED);
    return JsonUtils.readValue(
        daoCollection
            .entityExtensionTimeSeriesDao()
            .getExtensionByKey(
                RUN_ID_EXTENSION_KEY,
                runId,
                ingestionPipeline.getFullyQualifiedName(),
                PIPELINE_STATUS_EXTENSION),
        PipelineStatus.class);
  }

  /**
   * Upsert only the time-series record for a specific run without overwriting the pipeline-level
   * current status. Use this when stopping a specific run while other runs may still be active.
   * Inserts a new record if none exists for the runId, otherwise updates the existing one.
   */
  @Transaction
  public void updatePipelineStatusByRunId(String fqn, PipelineStatus pipelineStatus) {
    IngestionPipeline ingestionPipeline = findByName(fqn, Include.NON_DELETED);
    String pipelineFqn = ingestionPipeline.getFullyQualifiedName();
    String json = JsonUtils.pojoToJson(pipelineStatus);
    PipelineStatus storedPipelineStatus =
        JsonUtils.readValue(
            daoCollection
                .entityExtensionTimeSeriesDao()
                .getLatestExtensionByKey(
                    RUN_ID_EXTENSION_KEY,
                    pipelineStatus.getRunId(),
                    pipelineFqn,
                    PIPELINE_STATUS_EXTENSION),
            PipelineStatus.class);
    if (storedPipelineStatus != null) {
      daoCollection
          .entityExtensionTimeSeriesDao()
          .updateExtensionByKey(
              RUN_ID_EXTENSION_KEY,
              pipelineStatus.getRunId(),
              pipelineFqn,
              PIPELINE_STATUS_EXTENSION,
              json);
    } else {
      daoCollection
          .entityExtensionTimeSeriesDao()
          .insert(pipelineFqn, PIPELINE_STATUS_EXTENSION, PIPELINE_STATUS_JSON_SCHEMA, json);
    }
  }

  @Transaction
  public IngestionPipeline deletePipelineStatusByRunId(UUID ingestionPipelineId, UUID runId) {
    IngestionPipeline ingestionPipeline = find(ingestionPipelineId, Include.NON_DELETED);
    daoCollection
        .entityExtensionTimeSeriesDao()
        .deleteExtensionByKey(
            RUN_ID_EXTENSION_KEY,
            runId.toString(),
            ingestionPipeline.getFullyQualifiedName(),
            PIPELINE_STATUS_EXTENSION);
    setFieldsInternal(ingestionPipeline, Fields.EMPTY_FIELDS);
    return ingestionPipeline;
  }

  /**
   * Handles entity updated from PUT and POST operation.
   */
  public class IngestionPipelineUpdater extends EntityUpdater {

    public IngestionPipelineUpdater(
        IngestionPipeline original, IngestionPipeline updated, Operation operation) {
      super(buildIngestionPipelineDecrypted(original), updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      compareAndUpdate("processingEngine", () -> updateProcessingEngine(original, updated));
      compareAndUpdate("sourceConfig", this::updateSourceConfig);
      compareAndUpdate(
          "airflowConfig",
          () -> updateAirflowConfig(original.getAirflowConfig(), updated.getAirflowConfig()));
      compareAndUpdate(
          "loggerLevel", () -> updateLogLevel(original.getLoggerLevel(), updated.getLoggerLevel()));
      compareAndUpdate("enabled", () -> updateEnabled(original.getEnabled(), updated.getEnabled()));
      compareAndUpdate(
          "deployed", () -> updateDeployed(original.getDeployed(), updated.getDeployed()));
      compareAndUpdate(
          "raiseOnError",
          () -> updateRaiseOnError(original.getRaiseOnError(), updated.getRaiseOnError()));
      compareAndUpdate(
          "enableStreamableLogs",
          () ->
              updateEnableStreamableLogs(
                  original.getEnableStreamableLogs(), updated.getEnableStreamableLogs()));

      deployIfRequired(original, updated);
    }

    private void deployIfRequired(IngestionPipeline original, IngestionPipeline updated) {
      if (!requiresRedeployment(original, updated)) {
        return;
      }

      if (!Boolean.TRUE.equals(original.getDeployed())) {
        LOG.debug(
            "Pipeline '{}' requires redeployment but was never deployed. Skipping automatic redeployment.",
            updated.getName());
        return;
      }

      if (pipelineServiceClient == null) {
        LOG.warn(
            "Pipeline '{}' requires redeployment but pipeline service client is not configured. Skipping deployment.",
            updated.getName());
        return;
      }

      LOG.info(
          "Pipeline '{}' requires redeployment due to configuration changes. Deploying before DB update.",
          updated.getName());

      try {
        deployPipelineBeforeUpdate(updated);
        LOG.info(
            "Successfully deployed pipeline '{}'. Proceeding with DB update.", updated.getName());
      } catch (PipelineServiceClientException e) {
        LOG.error(
            "Failed to deploy pipeline '{}' before update. Aborting DB update to maintain consistency.",
            updated.getName(),
            e);
        throw e;
      } catch (Exception e) {
        LOG.error(
            "Unexpected error deploying pipeline '{}' before update. Aborting DB update.",
            updated.getName(),
            e);
        throw new PipelineServiceClientException("Deployment failed. Changes not saved.");
      }
    }

    protected void updateProcessingEngine(IngestionPipeline original, IngestionPipeline updated) {
      String entityType =
          original.getProcessingEngine() != null
              ? original.getProcessingEngine().getType()
              : updated.getProcessingEngine() != null
                  ? updated.getProcessingEngine().getType()
                  : null;
      if (entityType == null) {
        return;
      }
      updateToRelationship(
          "processingEngine",
          INGESTION_PIPELINE,
          original.getId(),
          Relationship.USES,
          entityType,
          original.getProcessingEngine(),
          updated.getProcessingEngine(),
          false);
    }

    private void updateSourceConfig() {
      JSONObject origSourceConfig =
          new JSONObject(JsonUtils.pojoToJson(original.getSourceConfig().getConfig()));
      JSONObject updatedSourceConfig =
          new JSONObject(JsonUtils.pojoToJson(updated.getSourceConfig().getConfig()));

      if (!origSourceConfig.similar(updatedSourceConfig)) {
        recordChange("sourceConfig", "old-encrypted-value", "new-encrypted-value", true);
      }
    }

    private void updateAirflowConfig(
        AirflowConfig origAirflowConfig, AirflowConfig updatedAirflowConfig) {
      if (!Objects.equals(origAirflowConfig, updatedAirflowConfig)) {
        recordChange("airflowConfig", origAirflowConfig, updatedAirflowConfig);
      }
    }

    private void updateLogLevel(LogLevels origLevel, LogLevels updatedLevel) {
      if (updatedLevel != null && !Objects.equals(origLevel, updatedLevel)) {
        recordChange("loggerLevel", origLevel, updatedLevel);
      }
    }

    private void updateEnableStreamableLogs(
        Boolean origEnableStreamableLogs, Boolean updatedEnableStreamableLogs) {
      if (updatedEnableStreamableLogs != null
          && !Objects.equals(origEnableStreamableLogs, updatedEnableStreamableLogs)) {
        recordChange("enableStreamableLogs", origEnableStreamableLogs, updatedEnableStreamableLogs);
      }
    }

    private void updateDeployed(Boolean origDeployed, Boolean updatedDeployed) {
      if (updatedDeployed != null && !Objects.equals(origDeployed, updatedDeployed)) {
        recordChange("deployed", origDeployed, updatedDeployed);
      }
    }

    private void updateRaiseOnError(Boolean origRaiseOnError, Boolean updatedRaiseOnError) {
      if (updatedRaiseOnError != null && !Objects.equals(origRaiseOnError, updatedRaiseOnError)) {
        recordChange("raiseOnError", origRaiseOnError, updatedRaiseOnError);
      }
    }

    private void updateEnabled(Boolean origEnabled, Boolean updatedEnabled) {
      if (updatedEnabled != null && !Objects.equals(origEnabled, updatedEnabled)) {
        recordChange("enabled", origEnabled, updatedEnabled);
      }
    }
  }

  protected static IngestionPipeline buildIngestionPipelineDecrypted(IngestionPipeline original) {
    IngestionPipeline decrypted =
        JsonUtils.convertValue(JsonUtils.getMap(original), IngestionPipeline.class);
    SecretsManagerFactory.getSecretsManager().decryptIngestionPipeline(decrypted);
    return decrypted;
  }

  public static void validateProfileSample(IngestionPipeline ingestionPipeline) {
    JSONObject sourceConfigJson =
        new JSONObject(JsonUtils.pojoToJson(ingestionPipeline.getSourceConfig().getConfig()));
    JSONObject profileSampleConfig = sourceConfigJson.optJSONObject("profileSampleConfig");
    if (profileSampleConfig == null) {
      return;
    }
    JSONObject config = profileSampleConfig.optJSONObject("config");
    if (config == null) {
      return;
    }
    String profileSampleType = config.optString("profileSampleType", "");
    double profileSample = config.optDouble("profileSample", Double.NaN);
    if (!profileSampleType.isEmpty() && !Double.isNaN(profileSample)) {
      EntityUtil.validateProfileSample(profileSampleType, profileSample);
    }
  }

  /**
   * Get either the pipelineType or the application Type.
   */
  public static String getPipelineWorkflowType(IngestionPipeline ingestionPipeline) {
    if (PipelineType.APPLICATION.equals(ingestionPipeline.getPipelineType())) {
      ApplicationPipeline applicationPipeline =
          JsonUtils.convertValue(
              ingestionPipeline.getSourceConfig().getConfig(), ApplicationPipeline.class);
      ApplicationConfig appConfig =
          JsonUtils.convertValue(applicationPipeline.getAppConfig(), ApplicationConfig.class);
      return (String) appConfig.getAdditionalProperties().get("type");
    } else {
      return ingestionPipeline.getPipelineType().value();
    }
  }

  // Log Storage Methods

  /**
   * Check if log storage is enabled and properly configured
   */
  public boolean isLogStorageEnabled() {
    return logStorage != null && logStorageConfiguration != null;
  }

  /**
   * Check if we're using S3 log storage (for multi-server scenarios)
   */
  public boolean isS3LogStorageEnabled() {
    return isLogStorageEnabled()
        && logStorageConfiguration.getType() == LogStorageConfiguration.Type.S_3
        && logStorageConfiguration.getBucketName() != null
        && !logStorageConfiguration.getBucketName().isEmpty();
  }

  public void appendLogs(String pipelineFQN, UUID runId, String logContent) {
    try {
      if (isLogStorageEnabled()) {
        logStorage.appendLogs(pipelineFQN, runId, logContent);
      } else {
        throw new IllegalStateException("Log storage is not configured");
      }
    } catch (Exception e) {
      LOG.error("Failed to append logs for pipeline: {}, runId: {}", pipelineFQN, runId, e);
      throw new RuntimeException("Failed to append logs", e);
    }
  }

  public void closeStream(String pipelineFQN, UUID runId) {
    if (!isLogStorageEnabled()) {
      // Closing a stream is idempotent: if log storage isn't configured there
      // is nothing to close, so we treat this as a no-op rather than an error.
      // This lets defensive callers (e.g. exit handlers, cleanup paths) call
      // close() without first having to know whether streaming was enabled.
      LOG.debug(
          "Log storage not configured; closeStream is a no-op for pipeline: {}, runId: {}",
          pipelineFQN,
          runId);
      return;
    }
    try {
      logStorage.closeStream(pipelineFQN, runId);
    } catch (Exception e) {
      LOG.error("Failed to close stream for pipeline: {}, runId: {}", pipelineFQN, runId, e);
      throw new RuntimeException("Failed to close stream", e);
    }
  }

  public Map<String, Object> getLogs(
      String pipelineFQN, UUID runId, String afterCursor, int limit) {
    try {
      if (isS3LogStorageEnabled()) {
        // S3 storage - read directly from S3 (works across servers)
        return logStorage.getLogs(pipelineFQN, runId, afterCursor, limit);
      } else if (isLogStorageEnabled()) {
        // Default storage - use existing pipeline service client
        return logStorage.getLogs(pipelineFQN, runId, afterCursor, limit);
      } else {
        // No log storage configured - fall back to traditional Airflow/Argo logs
        return getLogsFromPipelineService(pipelineFQN, afterCursor);
      }
    } catch (Exception e) {
      LOG.error("Failed to get logs for pipeline: {}, runId: {}", pipelineFQN, runId, e);
      throw new RuntimeException("Failed to get logs", e);
    }
  }

  private Map<String, Object> getLogsFromPipelineService(String pipelineFQN, String afterCursor) {
    // Fall back to traditional pipeline service logs (Airflow/Argo). Loads the service and reads
    // the task-keyed content for the same reasons as DefaultLogStorage.getLogs.
    IngestionPipeline pipeline =
        Entity.getEntityByName(Entity.INGESTION_PIPELINE, pipelineFQN, "service", Include.ALL);
    Map<String, String> logs = pipelineServiceClient.getLastIngestionLogs(pipeline, afterCursor);

    Map<String, Object> result = new HashMap<>();
    String error = logs.get(PipelineServiceClientInterface.LOGS_ERROR_KEY);
    if (error != null) {
      result.put(PipelineServiceClientInterface.LOGS_ERROR_KEY, error);
      return result;
    }
    result.put("logs", DefaultLogStorage.extractLogContent(logs));
    result.put("after", logs.get("after"));
    result.put("total", logs.getOrDefault("total", "0"));
    return result;
  }

  public List<UUID> listRuns(String pipelineFQN, int limit) {
    try {
      if (logStorage != null) {
        return logStorage.listRuns(pipelineFQN, limit);
      } else {
        List<UUID> runIds = new ArrayList<>();
        List<PipelineStatus> statuses = getQueuedPipelineStatus(pipelineFQN, limit);
        for (PipelineStatus status : statuses) {
          if (status.getRunId() != null) {
            try {
              runIds.add(UUID.fromString(status.getRunId()));
            } catch (IllegalArgumentException e) {
              // Skip invalid UUIDs
            }
          }
        }
        return runIds;
      }
    } catch (Exception e) {
      LOG.error("Failed to list runs for pipeline: {}", pipelineFQN, e);
      throw new RuntimeException("Failed to list runs", e);
    }
  }

  public synchronized void recordHttp2Request() {
    http2RequestCount++;
    activeStreams++;
  }

  public synchronized void recordHttp1Request() {
    http1RequestCount++;
  }

  public synchronized void recordStreamClosed() {
    if (activeStreams > 0) {
      activeStreams--;
    }
  }

  public Map<String, Long> getHttp2Metrics() {
    Map<String, Long> metrics = new HashMap<>();
    metrics.put("http2_requests", http2RequestCount);
    metrics.put("http1_requests", http1RequestCount);
    metrics.put("active_streams", activeStreams);
    long total = http2RequestCount + http1RequestCount;
    if (total > 0) {
      metrics.put("http2_percentage", (http2RequestCount * 100) / total);
    }
    return metrics;
  }

  private List<PipelineStatus> getQueuedPipelineStatus(String pipelineFQN, int limit) {
    try {
      IngestionPipeline pipeline = findByName(pipelineFQN, Include.NON_DELETED);
      List<PipelineStatus> statuses = pipelineServiceClient.getQueuedPipelineStatus(pipeline);
      return statuses.size() > limit ? statuses.subList(0, limit) : statuses;
    } catch (Exception e) {
      return new ArrayList<>();
    }
  }

  public boolean isProgressTrackingEnabled() {
    return progressTracker != null;
  }

  public void streamProgress(String pipelineFQN, UUID runId, SseEventSink eventSink, Sse sse) {
    Consumer<ProgressUpdate> listener = update -> emitProgressUpdate(eventSink, sse, update);
    Runnable onClose =
        () -> progressTracker.unregisterProgressListener(pipelineFQN, runId, listener);
    if (ProgressSseManager.getInstance().register(eventSink, sse, onClose)) {
      progressTracker.registerProgressListener(pipelineFQN, runId, listener);
      ProgressUpdate snapshot = getLatestProgressUpdate(pipelineFQN, runId);
      if (snapshot != null) {
        emitProgressUpdate(eventSink, sse, snapshot);
      }
    } else {
      eventSink.close();
    }
  }

  private void emitProgressUpdate(SseEventSink eventSink, Sse sse, ProgressUpdate update) {
    CompletionStage<?> event = sendProgressEvent(eventSink, sse, update);
    if (isTerminalProgressUpdate(update)) {
      event.whenComplete((result, error) -> ProgressSseManager.getInstance().close(eventSink));
    }
  }

  public void streamServiceProgress(String serviceFqn, SseEventSink eventSink, Sse sse) {
    ServiceProgressStreamer.stream(serviceFqn, eventSink, sse, progressTracker);
  }

  private ProgressUpdate getLatestProgressUpdate(String pipelineFQN, UUID runId) {
    ProgressState state = progressTracker.getProgressState(pipelineFQN, runId);
    if (state != null && state.getLatestUpdate() != null) {
      return state.getLatestUpdate();
    }
    return null;
  }

  private CompletionStage<?> sendProgressEvent(
      SseEventSink eventSink, Sse sse, ProgressUpdate update) {
    if (!eventSink.isClosed()) {
      return eventSink.send(sse.newEvent(JsonUtils.pojoToJson(update)));
    }
    return CompletableFuture.completedFuture(null);
  }

  private boolean isTerminalProgressUpdate(ProgressUpdate update) {
    return update.getUpdateType() == ProgressUpdateType.PIPELINE_COMPLETE
        || update.getUpdateType() == ProgressUpdateType.ERROR;
  }

  public RestUtil.PutResponse<?> updateProgress(
      String fqn, UUID runId, ProgressUpdate progressUpdate) {
    if (progressTracker == null) {
      LOG.debug("Progress tracking is not configured, ignoring progress update");
      return new RestUtil.PutResponse<>(Response.Status.OK, progressUpdate, ENTITY_FIELDS_CHANGED);
    }

    progressTracker.updateProgress(
        fqn, runId, progressUpdate, discoveredPipeline(fqn, progressUpdate));
    return new RestUtil.PutResponse<>(Response.Status.OK, progressUpdate, ENTITY_FIELDS_CHANGED);
  }

  /**
   * The pipeline entity to attach to the run's opening event, so the UI can discover a newly
   * created agent from the stream itself. Loaded only for the DISCOVERY update (once per run) and
   * never fails the progress update — a lookup error just omits the entity.
   */
  private IngestionPipeline discoveredPipeline(String fqn, ProgressUpdate update) {
    IngestionPipeline result = null;
    if (update.getUpdateType() == ProgressUpdateType.DISCOVERY) {
      try {
        result = getByName(null, fqn, getFields(""));
      } catch (Exception e) {
        LOG.debug(
            "Could not load ingestion pipeline {} for progress discovery: {}", fqn, e.getMessage());
      }
    }
    return result;
  }

  public RestUtil.PutResponse<?> addOperationMetrics(
      String fqn, UUID runId, OperationMetricsBatch batch) {
    if (progressTracker == null) {
      LOG.debug("Progress tracking is not configured, ignoring metrics batch");
      return new RestUtil.PutResponse<>(Response.Status.OK, batch, ENTITY_FIELDS_CHANGED);
    }

    progressTracker.addMetricsBatch(fqn, runId, batch);
    return new RestUtil.PutResponse<>(Response.Status.OK, batch, ENTITY_FIELDS_CHANGED);
  }

  public PipelineServiceClientResponse deployIngestionPipeline(
      IngestionPipeline ingestionPipeline, ServiceEntityInterface service) {
    applyStreamableLogsConfig(ingestionPipeline);
    return pipelineServiceClient.deployPipeline(ingestionPipeline, service);
  }

  // Single deploy-time hook for enableStreamableLogs, shared by every deploy path.
  // Default keeps the pipeline's own value; overrides resolve the pipeline's owning ingestion
  // runner (service / test-suite / application) and derive the flag from it.
  protected void applyStreamableLogsConfig(IngestionPipeline ingestionPipeline) {}

  public boolean isIngestionRunnerStreamableLogsEnabled(EntityReference ingestionRunner) {
    return false; // Default implementation
  }
}
