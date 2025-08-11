package org.openmetadata.service.resources.query;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.UUID;
import org.openmetadata.schema.entity.data.CreateQueryCostRecord;
import org.openmetadata.schema.entity.data.QueryCostRecord;
import org.openmetadata.schema.entity.data.QueryCostSearchResult;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.QueryCostRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityTimeSeriesResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

@Path("/v1/queryCostRecord")
@Tag(
    name = "Query Cost Record Manager",
    description = "APIs to query cost records from usage workflow.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "QueriesCost")
public class QueryCostResource
    extends EntityTimeSeriesResource<QueryCostRecord, QueryCostRepository> {

  public static final String COLLECTION_PATH = "v1/queryCostRecord";

  private final QueryCostRecordMapper mapper = new QueryCostRecordMapper();

  public QueryCostResource(Authorizer authorizer) {
    super(Entity.QUERY_COST_RECORD, authorizer);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getQueryCostRecord",
      summary = "Get query cost record by id",
      description = "Get query cost record by id",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The query cost record",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = QueryCostRecord.class)))
      })
  public QueryCostRecord get(
      @Context SecurityContext securityContext,
      @Parameter(description = "Get query cost record by id", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID testCaseResolutionStatusId) {
    QueryCostRecord costRecord = repository.getById(testCaseResolutionStatusId);
    OperationContext queryCostOperationContext =
        new OperationContext(Entity.QUERY, MetadataOperation.VIEW_ALL);
    ResourceContextInterface queryResourceContext =
        new ResourceContext<>(Entity.QUERY, costRecord.getQueryReference().getId(), null);
    authorizer.authorize(securityContext, queryCostOperationContext, queryResourceContext);
    return costRecord;
  }

  @POST
  @Operation(
      operationId = "createQueryCostRecord",
      summary = "Create query cost record",
      description = "Create query cost record",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Create query cost record",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CreateQueryCostRecord.class)))
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateQueryCostRecord createQueryCostRecord) {
    OperationContext operationContext =
        new OperationContext(Entity.QUERY, MetadataOperation.EDIT_QUERIES);
    ResourceContextInterface queryResourceContext =
        new ResourceContext<>(
            Entity.QUERY, createQueryCostRecord.getQueryReference().getId(), null);
    authorizer.authorize(securityContext, operationContext, queryResourceContext);
    QueryCostRecord queryCostRecord =
        mapper.createToEntity(createQueryCostRecord, securityContext.getUserPrincipal().getName());
    return create(queryCostRecord, queryCostRecord.getQueryReference().getFullyQualifiedName());
  }

  @GET
  @Path("/service/{serviceName}")
  @Operation(
      operationId = "getQueryCostByService",
      summary = "Get Query Cost By Service",
      description = "Get Query Cost By Service",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Create query cost record",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CreateQueryCostRecord.class)))
      })
  public QueryCostSearchResult getQueryCostAggData(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("serviceName") String serviceName)
      throws IOException {
    OperationContext operationContext =
        new OperationContext(Entity.QUERY, MetadataOperation.VIEW_QUERIES);
    ListFilter filter = new ListFilter(null);
    ResourceContext resourceContext = filter.getResourceContext(Entity.QUERY);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return repository.getQueryCostAggData(serviceName);
  }
}
