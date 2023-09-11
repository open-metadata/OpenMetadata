package org.openmetadata.service.resources.system;

import com.fasterxml.jackson.core.JsonProcessingException;
import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.io.IOException;
import java.util.Objects;
import java.util.UUID;
import javax.validation.Valid;
import javax.ws.rs.*;
import javax.ws.rs.core.*;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.UsageDetails;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.TestTransactionRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.RestUtil;

@Path("/v1/system/testtransactions")
@Tag(name = "System", description = "APIs related to System configuration and settings.")
@Hidden
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "system")
@Slf4j
public class TestTransactionResource {
  public static final String COLLECTION_PATH = "/v1/util";
  private final TestTransactionRepository testTransactionRepository;
  private OpenMetadataApplicationConfig applicationConfig;

  public TestTransactionResource(CollectionDAO dao, Authorizer authorizer) {
    Objects.requireNonNull(dao, "SystemRepository must not be null");
    this.testTransactionRepository = new TestTransactionRepository(dao);
  }

  @SuppressWarnings("unused") // Method used for reflection
  public void initialize(OpenMetadataApplicationConfig config) {
    this.applicationConfig = config;
  }

  @PUT
  @Path("/createwithtransactions")
  @Operation(
      operationId = "createOrUpdate",
      summary = "Update setting",
      description = "Update existing settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Response.class)))
      })
  public Response createOrUpdateTableWithTransaction(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTable create)
      throws IOException {
    Table table = getTable(create);
    table = testTransactionRepository.createOrUpdateTableWithTransaction(table);
    return new RestUtil.PutResponse<>(Response.Status.CREATED, table, RestUtil.ENTITY_CREATED).toResponse();
  }

  @PUT
  @Path("/createwithunitofwork")
  @Operation(
      operationId = "createOrUpdate",
      summary = "Update setting",
      description = "Update existing settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Response.class)))
      })
  public Response createOrUpdateTableWithJdbi(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateTable create)
      throws IOException {
    Table table = getTable(create);
    table = testTransactionRepository.createOrUpdateTableWithTransaction(table);
    return new RestUtil.PutResponse<>(Response.Status.CREATED, table, RestUtil.ENTITY_CREATED).toResponse();
  }

  @PUT
  @Transaction
  @Path("/updatewithtransaction")
  @Operation(
      operationId = "createOrUpdate",
      summary = "Update setting",
      description = "Update existing settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = CreateTable.class)))
      })
  public Table updatewithtransaction(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateTable create,
      @QueryParam("dailyCount") Integer dailyCount)
      throws JsonProcessingException {
    Table table = getTable(create);
    table = testTransactionRepository.updateTableWithTransaction(table);
    testTransactionRepository.updateUsageStatsWithTransaction(table, dailyCount);
    return table;
  }

  @PUT
  @Path("/updatewithjdbi")
  @Operation(
      operationId = "createOrUpdate",
      summary = "Update setting",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class)))
      })
  public Table updatewithjdbi(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid Table create,
      @QueryParam("dailyCount") Integer dailyCount)
      throws JsonProcessingException {
    Table table = testTransactionRepository.updateTableWithTransaction(create);
    testTransactionRepository.updateUsageStatsWithTransaction(table, dailyCount);
    return table;
  }

  @PUT
  @Transaction
  @Path("/updatewithtransactionwitherror")
  @Operation(
      operationId = "createOrUpdate",
      summary = "Update setting",
      description = "Update existing settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = CreateTable.class)))
      })
  public Table updatewithtransactionwitherror(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid Table create,
      @QueryParam("dailyCount") Integer dailyCount)
      throws JsonProcessingException {
    Table table = testTransactionRepository.updateTableWithTransaction(create);
    testTransactionRepository.updateUsageStatsWithTransactionWithError(table, dailyCount);
    return table;
  }

  @PUT
  @Path("/updatewithjdbiwitherror")
  @Operation(
      operationId = "createOrUpdate",
      summary = "Update setting",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class)))
      })
  public Table updatewithjdbiwitherror(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid Table create,
      @QueryParam("dailyCount") Integer dailyCount)
      throws JsonProcessingException {
    Table table = testTransactionRepository.updateTableWithTransaction(create);
    testTransactionRepository.updateUsageStatsWithTransactionWithError(table, dailyCount);
    return table;
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getTableByID",
      summary = "Get a table by Id",
      description = "Get a table by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "table",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class))),
        @ApiResponse(responseCode = "404", description = "Table for instance {id} is not found")
      })
  public Table get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "table Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return testTransactionRepository.getTable(id);
  }

  @GET
  @Path("/{id}/usage")
  @Operation(
      operationId = "getTableByID",
      summary = "Get a table by Id",
      description = "Get a table by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "table",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class))),
        @ApiResponse(responseCode = "404", description = "Table for instance {id} is not found")
      })
  public UsageDetails getUsage(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "table Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return testTransactionRepository.getUsage(id);
  }

  public Table getTable(CreateTable create) {
    String fullyQualifiedName = String.format("test_service.db_name.schema_name.%s", create.getName());
    return new Table()
        .withId(UUID.randomUUID())
        .withName(create.getName())
        .withDisplayName(create.getDisplayName())
        .withFullyQualifiedName(fullyQualifiedName)
        .withColumns(create.getColumns())
        .withUpdatedAt(System.currentTimeMillis())
        .withUpdatedBy("test");
  }
}
