package org.openmetadata.service.resources.elasticSearch;

import static org.openmetadata.service.Entity.DASHBOARD;
import static org.openmetadata.service.Entity.GLOSSARY_TERM;
import static org.openmetadata.service.Entity.MLMODEL;
import static org.openmetadata.service.Entity.PIPELINE;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.Entity.TAG;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.Entity.TOPIC;
import static org.openmetadata.service.Entity.USER;

import com.fasterxml.jackson.core.JsonProcessingException;
import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.BiConsumer;
import javax.validation.Valid;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.ws.rs.Consumes;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.action.ActionListener;
import org.elasticsearch.action.bulk.BackoffPolicy;
import org.elasticsearch.action.bulk.BulkProcessor;
import org.elasticsearch.action.bulk.BulkRequest;
import org.elasticsearch.action.bulk.BulkResponse;
import org.elasticsearch.action.update.UpdateRequest;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.common.unit.TimeValue;
import org.elasticsearch.common.xcontent.XContentType;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.CreateEventPublisherJob;
import org.openmetadata.schema.api.CreateEventPublisherJob.RunMode;
import org.openmetadata.schema.api.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.settings.EventPublisherJob;
import org.openmetadata.schema.settings.FailureDetails;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.elasticsearch.ElasticSearchIndexDefinition;
import org.openmetadata.service.elasticsearch.ElasticSearchIndexFactory;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.ConfigurationHolder;
import org.openmetadata.service.util.ElasticSearchClientUtils;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;

@Path("/v1/indexResource")
@Api(value = "Elastic Search Collection", tags = "Elastic Search Collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "indexResource")
@Slf4j
public class BuildSearchIndexResource {
  public static final String ELASTIC_SEARCH_EXTENSION = "service.eventPublisher";
  public static final String ELASTIC_SEARCH_ENTITY_FQN = "eventPublisher:ElasticSearch";
  private final RestHighLevelClient client;
  private final ElasticSearchIndexDefinition elasticSearchIndexDefinition;
  private final CollectionDAO dao;
  private final Authorizer authorizer;
  private final BulkProcessorListener elasticSearchBulkProcessorListener;
  private final BulkProcessor bulkProcessor;
  private final ExecutorService threadScheduler = Executors.newFixedThreadPool(2);

  public BuildSearchIndexResource(CollectionDAO dao, Authorizer authorizer) {
    this.client =
        ElasticSearchClientUtils.createElasticSearchClient(
            ConfigurationHolder.getInstance()
                .getConfig(
                    ConfigurationHolder.ConfigurationType.ELASTICSEARCHCONFIG, ElasticSearchConfiguration.class));
    this.dao = dao;
    this.authorizer = authorizer;
    this.elasticSearchIndexDefinition = new ElasticSearchIndexDefinition(client);
    this.elasticSearchBulkProcessorListener = new BulkProcessorListener(dao);
    BiConsumer<BulkRequest, ActionListener<BulkResponse>> bulkConsumer =
        (request, bulkListener) -> client.bulkAsync(request, RequestOptions.DEFAULT, bulkListener);
    // Setup a bulk Processor
    BulkProcessor.Builder builder =
        BulkProcessor.builder(bulkConsumer, elasticSearchBulkProcessorListener, "es-reindex");
    builder.setBulkActions(100);
    builder.setConcurrentRequests(2);
    builder.setFlushInterval(TimeValue.timeValueSeconds(60L));
    builder.setBackoffPolicy(BackoffPolicy.constantBackoff(TimeValue.timeValueSeconds(1L), 3));
    this.bulkProcessor = builder.build();
  }

  @POST
  @Path("/reindex")
  @Operation(
      operationId = "reindexEntities",
      summary = "Reindex Entities",
      tags = "indexResource",
      description = "Reindex Elastic Search Entities",
      responses = {
        @ApiResponse(responseCode = "200", description = "Success"),
        @ApiResponse(responseCode = "404", description = "Bot for instance {id} is not found")
      })
  public Response reindexAllEntities(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateEventPublisherJob createRequest)
      throws IOException {
    // Only admins  can issue a reindex request
    authorizer.authorizeAdmin(securityContext, false);
    String startedBy = securityContext.getUserPrincipal().getName();
    return startReindexing(uriInfo, startedBy, createRequest);
  }

  @GET
  @Path("/reindex/status")
  @Operation(
      operationId = "getReindexAllLastJobStatus",
      summary = "Get Last Run Reindex All Job Status",
      tags = "indexResource",
      description = "Reindex All job last status",
      responses = {
        @ApiResponse(responseCode = "200", description = "Success"),
        @ApiResponse(responseCode = "404", description = "Bot for instance {id} is not found")
      })
  public Response reindexAllJobLastStatus(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Limit the number users returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(0)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam)
      throws IOException {
    // Only admins  can issue a reindex request
    authorizer.authorizeAdmin(securityContext, false);
    // Check if there is a running job for reindex for requested entity
    List<String> records =
        dao.entityExtensionTimeSeriesDao()
            .getLastLatestExtension(ELASTIC_SEARCH_ENTITY_FQN, ELASTIC_SEARCH_EXTENSION, limitParam);
    if (records != null) {
      return Response.status(Response.Status.OK)
          .entity(JsonUtils.readObjects(records, EventPublisherJob.class))
          .build();
    }
    return Response.status(Response.Status.NOT_FOUND).entity("No Last Run.").build();
  }

  private synchronized Response startReindexing(
      UriInfo uriInfo, String startedBy, CreateEventPublisherJob createRequest) throws IOException {
    String reindexJobString =
        dao.entityExtensionTimeSeriesDao().getLatestExtension(ELASTIC_SEARCH_ENTITY_FQN, ELASTIC_SEARCH_EXTENSION);
    EventPublisherJob reindexJob = JsonUtils.readValue(reindexJobString, EventPublisherJob.class);
    if (reindexJob != null
        && ((System.currentTimeMillis() - reindexJob.getTimestamp() > 3600000)
            || reindexJob.getStatus() == EventPublisherJob.Status.SUCCESS)) {
      return Response.status(Response.Status.FORBIDDEN)
          .entity("Reindexing is Running Already. Cannot issue new request.")
          .build();
    } else {
      // create a new Job
      Long startTime = Date.from(LocalDateTime.now().atZone(ZoneId.systemDefault()).toInstant()).getTime();
      EventPublisherJob newJob =
          new EventPublisherJob()
              .withName(createRequest.getName())
              .withPublisherType(createRequest.getPublisherType())
              .withRunMode(createRequest.getRunMode())
              .withStatus(EventPublisherJob.Status.RUNNING)
              .withTimestamp(startTime)
              .withStartedBy(startedBy)
              .withStartTime(startTime)
              .withEntities(createRequest.getEntities());

      dao.entityExtensionTimeSeriesDao()
          .insert(
              ELASTIC_SEARCH_ENTITY_FQN, ELASTIC_SEARCH_EXTENSION, "eventPublisherJob", JsonUtils.pojoToJson(newJob));

      // Update Listener for only Batch
      if (createRequest.getRunMode() == RunMode.BATCH) {
        elasticSearchBulkProcessorListener.setRequestIssuer(startedBy);
        elasticSearchBulkProcessorListener.setCreateRequest(createRequest);
        elasticSearchBulkProcessorListener.setEntityFQN(ELASTIC_SEARCH_ENTITY_FQN);
        elasticSearchBulkProcessorListener.setStartTime(startTime);
        elasticSearchBulkProcessorListener.resetCounters();
      }

      // Start Full Reindexing
      threadScheduler.submit(
          () -> {
            try {
              if (createRequest.getEntities().contains("all")) {
                updateEntity(uriInfo, TABLE, createRequest);
                updateEntity(uriInfo, TOPIC, createRequest);
                updateEntity(uriInfo, DASHBOARD, createRequest);
                updateEntity(uriInfo, PIPELINE, createRequest);
                updateEntity(uriInfo, USER, createRequest);
                updateEntity(uriInfo, TEAM, createRequest);
                updateEntity(uriInfo, GLOSSARY_TERM, createRequest);
                updateEntity(uriInfo, MLMODEL, createRequest);
                updateEntity(uriInfo, TAG, createRequest);
              } else {
                for (String entityName : createRequest.getEntities()) {
                  updateEntity(uriInfo, entityName, createRequest);
                }
              }
            } catch (IOException e) {
              throw new RuntimeException(e);
            }
          });
      return Response.status(Response.Status.OK).entity("Reindexing Started").build();
    }
  }

  private synchronized void updateEntity(UriInfo uriInfo, String entityType, CreateEventPublisherJob createRequest)
      throws IOException {
    elasticSearchBulkProcessorListener.allowTotalRequestUpdate();

    ElasticSearchIndexDefinition.ElasticSearchIndexType indexType =
        elasticSearchIndexDefinition.getIndexMappingByEntityType(entityType);

    if (createRequest.getRecreateIndex()) {
      // Delete index
      elasticSearchIndexDefinition.deleteIndex(indexType);
      // Create index
      elasticSearchIndexDefinition.createIndex(indexType);
    }

    // Start fetching a list of Entities and pushing them to ES
    EntityRepository<EntityInterface> entityRepository = Entity.getEntityRepository(entityType);
    List<String> allowedFields = entityRepository.getAllowedFields();
    String fields = String.join(",", allowedFields);
    ResultList<EntityInterface> result;
    String after = null;
    do {
      result =
          entityRepository.listAfter(
              uriInfo,
              new EntityUtil.Fields(allowedFields, fields),
              new ListFilter(Include.ALL),
              createRequest.getBatchSize(),
              after);
      if (createRequest.getRunMode() == RunMode.BATCH) {
        elasticSearchBulkProcessorListener.addRequests(result.getPaging().getTotal());
        updateElasticSearchForEntityBatch(entityType, result.getData());
      } else {
        updateElasticSearchForEntityStream(entityType, result.getData());
      }
      after = result.getPaging().getAfter();
    } while (after != null);

    if (createRequest.getRunMode() == RunMode.STREAM) {
      String reindexJobString =
          dao.entityExtensionTimeSeriesDao().getLatestExtension(ELASTIC_SEARCH_ENTITY_FQN, ELASTIC_SEARCH_EXTENSION);
      EventPublisherJob latestJob = JsonUtils.readValue(reindexJobString, EventPublisherJob.class);
      long lastUpdateTime = latestJob.getTimestamp();
      Long time = Date.from(LocalDateTime.now().atZone(ZoneId.systemDefault()).toInstant()).getTime();
      latestJob.setTimestamp(time);
      latestJob.setEndTime(time);
      if (latestJob.getFailureDetails() != null) {
        latestJob.setStatus(EventPublisherJob.Status.FAILED);
      } else {
        latestJob.setStatus(EventPublisherJob.Status.SUCCESS);
      }
      dao.entityExtensionTimeSeriesDao()
          .update(ELASTIC_SEARCH_ENTITY_FQN, ELASTIC_SEARCH_EXTENSION, JsonUtils.pojoToJson(latestJob), lastUpdateTime);
    }
  }

  private synchronized void updateElasticSearchForEntityBatch(String entityType, List<EntityInterface> entities)
      throws IOException {
    for (EntityInterface entity : entities) {
      if (entityType.equals(TABLE)) {
        ((Table) entity).getColumns().forEach(table -> table.setProfile(null));
      }
      bulkProcessor.add(getUpdateRequest(entityType, entity));
    }
  }

  private synchronized void updateElasticSearchForEntityStream(String entityType, List<EntityInterface> entities)
      throws IOException {
    String reindexJobString =
        dao.entityExtensionTimeSeriesDao().getLatestExtension(ELASTIC_SEARCH_ENTITY_FQN, ELASTIC_SEARCH_EXTENSION);
    EventPublisherJob latestJob = JsonUtils.readValue(reindexJobString, EventPublisherJob.class);
    Long lastUpdateTime = latestJob.getTimestamp();
    for (EntityInterface entity : entities) {
      if (entityType.equals(TABLE)) {
        ((Table) entity).getColumns().forEach(table -> table.setProfile(null));
      }
      FailureDetails failureDetails = null;
      Long time = Date.from(LocalDateTime.now().atZone(ZoneId.systemDefault()).toInstant()).getTime();
      try {
        client.update(getUpdateRequest(entityType, entity), RequestOptions.DEFAULT);
      } catch (IOException ex) {
        failureDetails = new FailureDetails().withLastFailedAt(time).withLastFailedReason(ex.getMessage());
        latestJob.setFailureDetails(failureDetails);
      }
      latestJob.setTimestamp(time);
      dao.entityExtensionTimeSeriesDao()
          .update(ELASTIC_SEARCH_ENTITY_FQN, ELASTIC_SEARCH_EXTENSION, JsonUtils.pojoToJson(latestJob), lastUpdateTime);
      lastUpdateTime = time;
    }
  }

  private UpdateRequest getUpdateRequest(String entityType, EntityInterface entity) throws JsonProcessingException {
    UpdateRequest updateRequest =
        new UpdateRequest(
            elasticSearchIndexDefinition.getIndexMappingByEntityType(entityType).indexName, entity.getId().toString());
    updateRequest.doc(
        JsonUtils.pojoToJson(
            Objects.requireNonNull(ElasticSearchIndexFactory.buildIndex(entityType, entity)).buildESDoc()),
        XContentType.JSON);
    updateRequest.docAsUpsert(true);
    return updateRequest;
  }
}
