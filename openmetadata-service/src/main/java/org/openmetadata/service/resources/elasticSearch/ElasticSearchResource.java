package org.openmetadata.service.resources.elasticSearch;

import static org.openmetadata.service.Entity.DASHBOARD;
import static org.openmetadata.service.Entity.GLOSSARY_TERM;
import static org.openmetadata.service.Entity.PIPELINE;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.Entity.TOPIC;
import static org.openmetadata.service.Entity.USER;

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
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.ws.rs.Consumes;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
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
import org.elasticsearch.action.bulk.BulkItemResponse;
import org.elasticsearch.action.bulk.BulkProcessor;
import org.elasticsearch.action.bulk.BulkRequest;
import org.elasticsearch.action.bulk.BulkResponse;
import org.elasticsearch.action.update.UpdateRequest;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.common.unit.TimeValue;
import org.elasticsearch.common.xcontent.XContentType;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.settings.EventPublisherJob;
import org.openmetadata.schema.settings.FailureDetails;
import org.openmetadata.schema.settings.Stats;
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

@Path("/v1/elasticSearch")
@Api(value = "Elastic Search Collection", tags = "Elastic Search Collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "elasticSearch")
@Slf4j
public class ElasticSearchResource {
  public static final String ELASTIC_SEARCH_EXTENSION = "service.eventPublisher";
  public static final String ELASTIC_ENTITY_FQN = "elasticSearchReindex:%s";
  private final RestHighLevelClient client;
  private final ElasticSearchIndexDefinition elasticSearchIndexDefinition;
  private final CollectionDAO dao;
  private final Authorizer authorizer;
  private final BulkProcessorListener elasticSearchBulkProcessorListener;
  private final BulkProcessor bulkProcessor;
  private final ExecutorService threadScheduler = Executors.newFixedThreadPool(2);

  public ElasticSearchResource(CollectionDAO dao, Authorizer authorizer) {
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
  @Path("/reindexAll")
  @Operation(
      operationId = "reindexAllEntities",
      summary = "Reindex all Entities",
      tags = "elasticSearch",
      description = "Reindex Elastic Search All Entities",
      responses = {
        @ApiResponse(responseCode = "200", description = "Success"),
        @ApiResponse(responseCode = "404", description = "Bot for instance {id} is not found")
      })
  public Response reindexAllEntities(@Context UriInfo uriInfo, @Context SecurityContext securityContext)
      throws IOException {
    // Only admins  can issue a reindex request
    authorizer.authorizeAdmin(securityContext, false);
    // Check if there is a running job for reindex for requested entity
    String entityFqn = String.format(ELASTIC_ENTITY_FQN, "full");
    String startedBy = securityContext.getUserPrincipal().getName();
    return startFullReindexing(startedBy, entityFqn, uriInfo);
  }

  @GET
  @Path("/reindexAll/status")
  @Operation(
      operationId = "getReindexAllLastJobStatus",
      summary = "Get Last Run Reindex All Job Status",
      tags = "elasticSearch",
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
            .getLastLatestExtension(String.format(ELASTIC_ENTITY_FQN, "full"), ELASTIC_SEARCH_EXTENSION, limitParam);
    if (records != null) {
      return Response.status(Response.Status.OK).entity(records).build();
    }
    return Response.status(Response.Status.NOT_FOUND).entity("No Last Run.").build();
  }

  @GET
  @Path("/reindex/{entityName}/status")
  @Operation(
      operationId = "reindexEntityLastStatus",
      summary = "Reindex status for entity",
      tags = "elasticSearch",
      description = "Reindex Elastic Search by Entity status",
      responses = {
        @ApiResponse(responseCode = "200", description = "Success"),
        @ApiResponse(responseCode = "404", description = "Bot for instance {id} is not found")
      })
  public Response reindexEntityLastStatus(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("entityName") String entityName,
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
    String entityFqn = String.format(ELASTIC_ENTITY_FQN, entityName);
    List<String> records =
        dao.entityExtensionTimeSeriesDao().getLastLatestExtension(entityFqn, ELASTIC_SEARCH_EXTENSION, limitParam);
    if (records != null) {
      return Response.status(Response.Status.OK).entity(records).build();
    }
    return Response.status(Response.Status.NOT_FOUND).entity("No Last Run.").build();
  }

  @POST
  @Path("/reindex/{entityName}")
  @Operation(
      operationId = "reindexEntity",
      summary = "Reindex a specific Entity",
      tags = "elasticSearch",
      description = "Reindex Elastic Search by Entity",
      responses = {
        @ApiResponse(responseCode = "200", description = "Success"),
        @ApiResponse(responseCode = "404", description = "Bot for instance {id} is not found")
      })
  public Response reindexEntity(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @PathParam("entityName") String entityName)
      throws IOException {
    authorizer.authorizeAdmin(securityContext, false);
    // Check if there is a running job for reindex for requested entity
    String entityFqn = String.format(ELASTIC_ENTITY_FQN, entityName);
    return startReindexingForEntity(securityContext.getUserPrincipal().getName(), entityName, entityFqn, uriInfo);
  }

  private synchronized Response startReindexingForEntity(
      String startedBy, String entityType, String entityFQN, UriInfo uriInfo) throws IOException {
    String fullReindexing = dao.entityExtensionTimeSeriesDao().getLatestExtension(entityFQN, ELASTIC_SEARCH_EXTENSION);
    EventPublisherJob fullReindexjob = JsonUtils.readValue(fullReindexing, EventPublisherJob.class);
    if (fullReindexjob != null && fullReindexjob.getStatus() == EventPublisherJob.Status.RUNNING) {
      return Response.status(Response.Status.FORBIDDEN)
          .entity("Full Reindexing is Running. Cannot issue new request.")
          .build();
    } else {
      String elasticSearchJob =
          dao.entityExtensionTimeSeriesDao().getLatestExtension(entityFQN, ELASTIC_SEARCH_EXTENSION);
      EventPublisherJob eventPublisherJob = JsonUtils.readValue(elasticSearchJob, EventPublisherJob.class);
      if (eventPublisherJob != null && eventPublisherJob.getStatus() == EventPublisherJob.Status.RUNNING) {
        return Response.status(Response.Status.FORBIDDEN)
            .entity("Reindexing is already in Process for the entity. Cannot issue new request.")
            .build();
      } else {
        // create a new Job
        Long startTime = Date.from(LocalDateTime.now().atZone(ZoneId.systemDefault()).toInstant()).getTime();

        EventPublisherJob newJob =
            new EventPublisherJob()
                .withName(String.format("ElasticSearchReindexJob:%s", entityFQN))
                .withPublisherType(EventPublisherJob.PublisherType.ELASTIC_SEARCH)
                .withRunMode(EventPublisherJob.RunMode.BATCH)
                .withStatus(EventPublisherJob.Status.RUNNING)
                .withTimestamp(startTime)
                .withStats(new Stats().withFailed(0).withSuccess(0).withTotal(0))
                .withStartTime(startTime)
                .withStartedBy(startedBy);

        dao.entityExtensionTimeSeriesDao()
            .insert(entityFQN, ELASTIC_SEARCH_EXTENSION, "eventPublisherJob", JsonUtils.pojoToJson(newJob));

        // Update Listener
        elasticSearchBulkProcessorListener.setRequestIssuer(startedBy);
        elasticSearchBulkProcessorListener.setEntityFQN(entityFQN);
        elasticSearchBulkProcessorListener.setStartTime(startTime);
        elasticSearchBulkProcessorListener.resetCounters();

        // Start Entity Reindexing
        threadScheduler.submit(
            () -> {
              try {
                updateEntity(uriInfo, entityType);
              } catch (IOException e) {
                throw new RuntimeException(e);
              }
            });
        return Response.status(Response.Status.OK).entity("Reindexing Started for entity.").build();
      }
    }
  }

  private synchronized Response startFullReindexing(String startedBy, String entityFQN, UriInfo uriInfo)
      throws IOException {
    String fullReindexing = dao.entityExtensionTimeSeriesDao().getLatestExtension(entityFQN, ELASTIC_SEARCH_EXTENSION);
    EventPublisherJob fullReindexjob = JsonUtils.readValue(fullReindexing, EventPublisherJob.class);
    if (fullReindexjob != null && fullReindexjob.getStatus() == EventPublisherJob.Status.RUNNING) {
      return Response.status(Response.Status.FORBIDDEN)
          .entity("Full Reindexing is Running. Cannot issue new request.")
          .build();
    } else {
      // create a new Job
      Long startTime = Date.from(LocalDateTime.now().atZone(ZoneId.systemDefault()).toInstant()).getTime();
      EventPublisherJob newJob =
          new EventPublisherJob()
              .withName(String.format("ElasticSearchReindexJob:%s", entityFQN))
              .withPublisherType(EventPublisherJob.PublisherType.ELASTIC_SEARCH)
              .withRunMode(EventPublisherJob.RunMode.BATCH)
              .withStatus(EventPublisherJob.Status.RUNNING)
              .withTimestamp(startTime)
              .withStats(new Stats().withFailed(0).withSuccess(0).withTotal(0))
              .withStartedBy(startedBy)
              .withStartTime(startTime);

      dao.entityExtensionTimeSeriesDao()
          .insert(entityFQN, ELASTIC_SEARCH_EXTENSION, "eventPublisherJob", JsonUtils.pojoToJson(newJob));

      // Update Listener
      elasticSearchBulkProcessorListener.setRequestIssuer(startedBy);
      elasticSearchBulkProcessorListener.setEntityFQN(entityFQN);
      elasticSearchBulkProcessorListener.setStartTime(startTime);
      elasticSearchBulkProcessorListener.resetCounters();

      // Start Full Reindexing
      threadScheduler.submit(
          () -> {
            try {
              updateEntity(uriInfo, TABLE);
              updateEntity(uriInfo, TOPIC);
              updateEntity(uriInfo, DASHBOARD);
              updateEntity(uriInfo, PIPELINE);
              updateEntity(uriInfo, USER);
              updateEntity(uriInfo, TEAM);
              updateEntity(uriInfo, GLOSSARY_TERM);
            } catch (IOException e) {
              throw new RuntimeException(e);
            }
          });
      return Response.status(Response.Status.OK).entity("Full Reindexing Started").build();
    }
  }

  private synchronized void updateEntity(UriInfo uriInfo, String entityType) throws IOException {
    elasticSearchBulkProcessorListener.allowTotalRequestUpdate();

    ElasticSearchIndexDefinition.ElasticSearchIndexType indexType =
        elasticSearchIndexDefinition.getIndexMappingByEntityType(entityType);
    // Delete index
    elasticSearchIndexDefinition.deleteIndex(indexType);
    // Create index
    elasticSearchIndexDefinition.createIndex(indexType);
    // Start fetching a list of Entities and pushing them to ES
    EntityRepository<EntityInterface> entityRepository = Entity.getEntityRepository(entityType);
    List<String> allowedFields = entityRepository.getAllowedFields();
    String fields = String.join(",", allowedFields);
    ResultList<EntityInterface> result;
    String after = null;
    do {
      result =
          entityRepository.listAfter(
              uriInfo, new EntityUtil.Fields(allowedFields, fields), new ListFilter(Include.ALL), 20, after);
      System.out.println("Read Entities : " + result.getData().size());
      elasticSearchBulkProcessorListener.addRequests(result.getPaging().getTotal());
      updateElasticSearchForEntity(entityType, result.getData());
      after = result.getPaging().getAfter();
    } while (after != null);
  }

  private synchronized void updateElasticSearchForEntity(String entityType, List<EntityInterface> entities)
      throws IOException {
    for (EntityInterface entity : entities) {
      if (entityType.equals(TABLE)) {
        ((Table) entity).getColumns().forEach(table -> table.setProfile(null));
      }
      UpdateRequest updateRequest =
          new UpdateRequest(
              elasticSearchIndexDefinition.getIndexMappingByEntityType(entityType).indexName,
              entity.getId().toString());
      updateRequest.doc(
          JsonUtils.pojoToJson(
              Objects.requireNonNull(ElasticSearchIndexFactory.buildIndex(entityType, entity)).buildESDoc()),
          XContentType.JSON);
      updateRequest.docAsUpsert(true);
      bulkProcessor.add(updateRequest);
    }
  }

  static class BulkProcessorListener implements BulkProcessor.Listener {
    private volatile boolean updateTotalRequest = true;
    private volatile int totalSuccessCount = 0;
    private volatile int totalFailedCount = 0;
    private volatile int totalRequests = 0;
    private String requestIssuer = "anonymous";
    private String entityFQN;
    private final CollectionDAO dao;
    private Long startTime;
    private Long originalStartTime;

    public BulkProcessorListener(CollectionDAO dao) {
      this.dao = dao;
    }

    @Override
    public void beforeBulk(long executionId, BulkRequest bulkRequest) {
      int numberOfActions = bulkRequest.numberOfActions();
      LOG.info("Executing bulk [{}] with {} requests", executionId, numberOfActions);
    }

    @Override
    public void afterBulk(long executionId, BulkRequest bulkRequest, BulkResponse bulkResponse) {
      try {
        int failedCount = 0;
        int successCount;
        FailureDetails failureDetails = null;
        for (BulkItemResponse bulkItemResponse : bulkResponse) {
          if (bulkItemResponse.isFailed()) {
            BulkItemResponse.Failure failure = bulkItemResponse.getFailure();
            failureDetails = new FailureDetails();
            failureDetails.setLastFailedAt(
                Date.from(LocalDateTime.now().atZone(ZoneId.systemDefault()).toInstant()).getTime());
            failureDetails.setLastFailedReason(
                String.format("ID [%s]. Reason : %s", failure.getId(), failure.getMessage()));
            failedCount++;
          }
        }
        successCount = bulkResponse.getItems().length - failedCount;
        updateFailedAndSuccess(failedCount, successCount);

        System.out.println("TOTAL : " + totalRequests + " SUCCESS : " + successCount + " FAILEWD : " + failedCount);
        // update stats in DB
        Long time = Date.from(LocalDateTime.now().atZone(ZoneId.systemDefault()).toInstant()).getTime();
        EventPublisherJob updateJob =
            new EventPublisherJob()
                .withName(String.format("ElasticSearchReindexJob:%s", entityFQN))
                .withPublisherType(EventPublisherJob.PublisherType.ELASTIC_SEARCH)
                .withRunMode(EventPublisherJob.RunMode.BATCH)
                .withStatus(EventPublisherJob.Status.RUNNING)
                .withTimestamp(time)
                .withStats(
                    new Stats().withFailed(totalFailedCount).withSuccess(totalSuccessCount).withTotal(totalRequests))
                .withStartedBy(requestIssuer)
                .withFailureDetails(failureDetails)
                .withStartTime(originalStartTime);
        if (totalRequests == totalFailedCount + totalSuccessCount) {
          updateJob.setStatus(EventPublisherJob.Status.SUCCESS);
          updateJob.setEndTime(time);
        }
        dao.entityExtensionTimeSeriesDao()
            .update(entityFQN, ELASTIC_SEARCH_EXTENSION, JsonUtils.pojoToJson(updateJob), startTime);
        startTime = time;
      } catch (IOException e) {
        throw new RuntimeException(e);
      }
    }

    @Override
    public void afterBulk(long executionId, BulkRequest bulkRequest, Throwable throwable) {
      LOG.error("Failed to execute bulk", throwable);
      updateFailedAndSuccess(bulkRequest.numberOfActions(), 0);
    }

    public String getEntityFQN() {
      return entityFQN;
    }

    public void setRequestIssuer(String adminName) {
      this.requestIssuer = adminName;
    }

    public void setEntityFQN(String entityFQN) {
      this.entityFQN = entityFQN;
    }

    public synchronized void addRequests(int count) {
      if (updateTotalRequest) {
        totalRequests += count;
      }
      updateTotalRequest = false;
    }

    public synchronized void allowTotalRequestUpdate() {
      updateTotalRequest = true;
    }

    public synchronized void resetCounters() {
      totalRequests = 0;
      totalFailedCount = 0;
      totalSuccessCount = 0;
      updateTotalRequest = true;
    }

    public synchronized void updateFailedAndSuccess(int failedCount, int successCount) {
      totalFailedCount += failedCount;
      totalSuccessCount += successCount;
    }

    public void setStartTime(Long time) {
      this.startTime = time;
      this.originalStartTime = time;
    }
  }
}
