package org.openmetadata.service.resources.services.metadata;

import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.validation.Valid;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.PUT;
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
import org.openmetadata.schema.api.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.api.services.CreateSystemService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.SystemConnection;
import org.openmetadata.schema.entity.services.SystemService;
import org.openmetadata.schema.services.connections.metadata.ElasticSearchConnection;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.SystemServiceRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.services.ServiceEntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/services/systemServices")
@Api(value = "system service collection", tags = "SystemServices -> system service collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "systemServices", order = 1)
public class SystemServiceResource
    extends ServiceEntityResource<SystemService, SystemServiceRepository, SystemConnection> {
  public static final String COLLECTION_PATH = "v1/services/systemServices/";
  static final String FIELDS = "pipelines,owner";

  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    registerSystemServices(config);
  }

  private void registerSystemServices(OpenMetadataApplicationConfig config) throws IOException {
    SystemConnection esSystemConnection =
        new SystemConnection().withConfig(getElasticSearchConnection(config.getElasticSearchConfiguration()));
    List<SystemService> servicesList = dao.getEntitiesFromSeedData(".*json/data/systemService/.*\\.json$");
    servicesList.forEach(
        (service) -> {
          try {
            // populate values for the System Service
            service.setConnection(esSystemConnection);
            dao.initializeEntity(service);
          } catch (IOException e) {
            LOG.error("[SystemService] Failed to initialize a System Service {}", service.getFullyQualifiedName(), e);
          }
        });
  }

  @Override
  public SystemService addHref(UriInfo uriInfo, SystemService service) {
    service.setHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, service.getId()));
    Entity.withHref(uriInfo, service.getOwner());
    Entity.withHref(uriInfo, service.getPipelines());
    return service;
  }

  public SystemServiceResource(CollectionDAO dao, Authorizer authorizer) {
    super(SystemService.class, new SystemServiceRepository(dao), authorizer, ServiceType.METADATA);
  }

  public static class SystemServiceList extends ResultList<SystemService> {
    @SuppressWarnings("unused") /* Required for tests */
    public SystemServiceList() {}
  }

  @GET
  @Operation(
      operationId = "listSystemServices",
      summary = "List system services",
      tags = "systemService",
      description = "Get a list of system services.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of system service instances",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SystemServiceResource.SystemServiceList.class)))
      })
  public ResultList<SystemService> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @DefaultValue("10") @Min(0) @Max(1000000) @QueryParam("limit") int limitParam,
      @Parameter(description = "Returns list of system services before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of system services after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    RestUtil.validateCursors(before, after);
    EntityUtil.Fields fields = getFields(fieldsParam);
    ResultList<SystemService> systemServices;

    ListFilter filter = new ListFilter(include);
    if (before != null) {
      systemServices = dao.listBefore(uriInfo, fields, filter, limitParam, before);
    } else {
      systemServices = dao.listAfter(uriInfo, fields, filter, limitParam, after);
    }
    return addHref(uriInfo, decryptOrNullify(securityContext, systemServices));
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getSystemServiceByID",
      summary = "Get a system service",
      tags = "systemService",
      description = "Get a system service by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "system service instance",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = SystemService.class))),
        @ApiResponse(responseCode = "404", description = "system service for instance {id} is not found")
      })
  public SystemService get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    SystemService systemService = getInternal(uriInfo, securityContext, id, fieldsParam, include);
    return decryptOrNullify(securityContext, systemService);
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getSystemServiceByFQN",
      summary = "Get system service by name",
      tags = "systemService",
      description = "Get a system service by the service `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "system service instance",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = SystemService.class))),
        @ApiResponse(responseCode = "404", description = "system service for instance {id} is not found")
      })
  public SystemService getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("name") String name,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    SystemService systemService = getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
    return decryptOrNullify(securityContext, systemService);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllSystemServiceVersion",
      summary = "List system service versions",
      tags = "systemService",
      description = "Get a list of all the versions of a system service identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of system service versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "system service Id", schema = @Schema(type = "string")) @PathParam("id") UUID id)
      throws IOException {
    EntityHistory entityHistory = super.listVersionsInternal(securityContext, id);

    List<Object> versions =
        entityHistory.getVersions().stream()
            .map(
                json -> {
                  try {
                    SystemService systemService = JsonUtils.readValue((String) json, SystemService.class);
                    return JsonUtils.pojoToJson(decryptOrNullify(securityContext, systemService));
                  } catch (IOException e) {
                    return json;
                  }
                })
            .collect(Collectors.toList());
    entityHistory.setVersions(versions);
    return entityHistory;
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificSystemServiceVersion",
      summary = "Get a version of the system service",
      tags = "systemService",
      description = "Get a version of the system service by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "system service",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = SystemService.class))),
        @ApiResponse(
            responseCode = "404",
            description = "system service for instance {id} and version " + "{version} is not found")
      })
  public SystemService getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "system service Id", schema = @Schema(type = "string")) @PathParam("id") UUID id,
      @Parameter(
              description = "system service version number in the form `major`" + ".`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    SystemService systemService = super.getVersionInternal(securityContext, id, version);
    return decryptOrNullify(securityContext, systemService);
  }

  @POST
  @Operation(
      operationId = "createSystemService",
      summary = "Create system service",
      tags = "systemService",
      description = "Create a new system service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "system service instance",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = SystemService.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateSystemService create)
      throws IOException {
    SystemService service = getSystemService(create, securityContext.getUserPrincipal().getName());
    Response response = create(uriInfo, securityContext, service);
    decryptOrNullify(securityContext, (SystemService) response.getEntity());
    return response;
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateSystemService",
      summary = "Update system service",
      tags = "systemService",
      description = "Update an existing or create a new system service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "system service instance",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = SystemService.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateSystemService update)
      throws IOException {
    SystemService service = getSystemService(update, securityContext.getUserPrincipal().getName());
    Response response = createOrUpdate(uriInfo, securityContext, service);
    decryptOrNullify(securityContext, (SystemService) response.getEntity());
    return response;
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteSystemService",
      summary = "Delete a system service",
      tags = "systemService",
      description = "Delete a system services. If some service belong the service, it can't be " + "deleted.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "SystemService service for instance {id} " + "is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Recursively delete this entity and it's children. (Default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the system service", schema = @Schema(type = "string")) @PathParam("id") UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  private SystemService getSystemService(CreateSystemService create, String user) throws IOException {
    return copy(new SystemService(), create, user)
        .withServiceType(create.getServiceType())
        .withConnection(create.getConnection());
  }

  @Override
  protected SystemService nullifyConnection(SystemService service) {
    return service.withConnection(null);
  }

  @Override
  protected String extractServiceType(SystemService service) {
    return service.getServiceType().value();
  }

  private ElasticSearchConnection getElasticSearchConnection(ElasticSearchConfiguration config) {
    return new ElasticSearchConnection()
        .withType(ElasticSearchConnection.EsType.ELASTIC_SEARCH)
        .withHost(config.getHost())
        .withPort(config.getPort())
        .withScheme(config.getScheme())
        .withUsername(config.getUsername())
        .withPassword(config.getPassword());
  }
}
