package org.openmetadata.service.resources.elasticsearch;

import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.io.IOException;
import javax.validation.Valid;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.client.RestHighLevelClient;
import org.openmetadata.schema.api.CreateEventPublisherJob;
import org.openmetadata.schema.api.CreateEventPublisherJob.RunMode;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.settings.EventPublisherJob;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.elasticsearch.ElasticSearchIndexDefinition;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.ElasticSearchClientUtils;
import org.openmetadata.service.util.ElasticSearchIndexUtil;
import org.openmetadata.service.util.JsonUtils;

@Path("/v1/indexResource")
@Api(value = "Elastic Search Collection", tags = "Elastic Search Collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "indexResource")
@Slf4j
public class BuildSearchIndexResource {
  public static final String ELASTIC_SEARCH_EXTENSION = "service.eventPublisher";
  public static final String ELASTIC_SEARCH_ENTITY_FQN_STREAM = "eventPublisher:ElasticSearch:STREAM";
  public static final String ELASTIC_SEARCH_ENTITY_FQN_BATCH = "eventPublisher:ElasticSearch:BATCH";
  private final CollectionDAO dao;
  private final Authorizer authorizer;
  private final UserRepository userRepository;
  private ElasticSearchIndexUtil elasticSearchIndexUtil;

  public BuildSearchIndexResource(CollectionDAO dao, Authorizer authorizer) {
    this.dao = dao;
    this.userRepository = new UserRepository(dao);
    this.authorizer = authorizer;
  }

  public void initialize(OpenMetadataApplicationConfig config) {
    if (config.getElasticSearchConfiguration() != null) {
      RestHighLevelClient client =
          ElasticSearchClientUtils.createElasticSearchClient(config.getElasticSearchConfiguration());
      ElasticSearchIndexDefinition elasticSearchIndexDefinition = new ElasticSearchIndexDefinition(client, dao);
      this.elasticSearchIndexUtil =
          new ElasticSearchIndexUtil(
              dao,
              client,
              elasticSearchIndexDefinition,
              config.getElasticSearchConfiguration().getSearchIndexMappingLanguage().value());
    }
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
    authorizer.authorizeAdmin(securityContext);
    User user =
        userRepository.getByName(null, securityContext.getUserPrincipal().getName(), userRepository.getFields("id"));
    if (createRequest.getRunMode() == RunMode.BATCH) {
      return elasticSearchIndexUtil.startReindexingBatchMode(uriInfo, user.getId(), createRequest);
    } else {
      return Response.status(Response.Status.BAD_REQUEST).entity("Invalid Run Mode").build();
    }
  }

  @GET
  @Path("/reindex/status/{runMode}")
  @Operation(
      operationId = "getReindexAllLastJobStatus",
      summary = "Get Last Run Reindex All Job Status",
      tags = "indexResource",
      description = "Reindex All job last status",
      responses = {
        @ApiResponse(responseCode = "200", description = "Success"),
        @ApiResponse(responseCode = "404", description = "Run model {runMode} is not found")
      })
  public Response reindexAllJobLastStatus(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @PathParam("runMode") String runMode)
      throws IOException {
    // Only admins  can issue a reindex request
    authorizer.authorizeAdmin(securityContext);
    // Check if there is a running job for reindex for requested entity
    String record;
    if (runMode.equals(RunMode.BATCH.toString())) {
      record =
          dao.entityExtensionTimeSeriesDao()
              .getLatestExtension(ELASTIC_SEARCH_ENTITY_FQN_BATCH, ELASTIC_SEARCH_EXTENSION);
    } else if (runMode.equals(RunMode.STREAM.toString())) {
      record =
          dao.entityExtensionTimeSeriesDao()
              .getLatestExtension(ELASTIC_SEARCH_ENTITY_FQN_STREAM, ELASTIC_SEARCH_EXTENSION);
    } else {
      return Response.status(Response.Status.BAD_REQUEST).entity("Invalid Run Mode").build();
    }
    if (record != null) {
      return Response.status(Response.Status.OK).entity(JsonUtils.readValue(record, EventPublisherJob.class)).build();
    }
    return Response.status(Response.Status.NOT_FOUND).entity("No Last Run.").build();
  }
}
