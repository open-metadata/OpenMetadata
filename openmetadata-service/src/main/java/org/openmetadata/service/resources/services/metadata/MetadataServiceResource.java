package org.openmetadata.service.resources.services.metadata;

import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.io.IOException;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.json.JsonPatch;
import javax.validation.Valid;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.DefaultValue;
import javax.ws.rs.GET;
import javax.ws.rs.PATCH;
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
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.services.CreateMetadataService;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.MetadataConnection;
import org.openmetadata.schema.entity.services.MetadataService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.services.connections.metadata.ComponentConfig;
import org.openmetadata.schema.services.connections.metadata.ElasticsSearch;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.MetadataServiceRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.services.ServiceEntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/services/metadataServices")
@Api(value = "Metadata service collection", tags = "MetadataServices -> Metadata service collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "metadataServices")
public class MetadataServiceResource
    extends ServiceEntityResource<MetadataService, MetadataServiceRepository, MetadataConnection> {
  public static final String COLLECTION_PATH = "v1/services/metadataServices/";
  public static final String FIELDS = "pipelines,owner,tags";

  public void initialize(OpenMetadataApplicationConfig config) {
    registerMetadataServices(config);
  }

  private void registerMetadataServices(OpenMetadataApplicationConfig config) {
    try {
      if (config.getElasticSearchConfiguration() != null) {
        OpenMetadataConnection openMetadataServerConnection =
            new OpenMetadataConnectionBuilder(config)
                .build()
                .withElasticsSearch(getElasticSearchConnectionSink(config.getElasticSearchConfiguration()));
        MetadataConnection metadataConnection = new MetadataConnection().withConfig(openMetadataServerConnection);
        List<MetadataService> servicesList = dao.getEntitiesFromSeedData(".*json/data/metadataService/.*\\.json$");
        servicesList.forEach(
            (service) -> {
              try {
                // populate values for the Metadata Service
                service.setConnection(metadataConnection);
                service.setAllowServiceCreation(false);
                dao.initializeEntity(service);
              } catch (IOException e) {
                LOG.error(
                    "[MetadataService] Failed to initialize a Metadata Service {}", service.getFullyQualifiedName(), e);
              }
            });
      } else {
        LOG.error("[MetadataService] Missing Elastic Search Config");
      }
    } catch (Exception ex) {
      LOG.error("[MetadataService] Error in creating Metadata Services");
    }
  }

  @Override
  public MetadataService addHref(UriInfo uriInfo, MetadataService service) {
    service.setHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, service.getId()));
    Entity.withHref(uriInfo, service.getOwner());
    Entity.withHref(uriInfo, service.getPipelines());
    return service;
  }

  public MetadataServiceResource(CollectionDAO dao, Authorizer authorizer) {
    super(MetadataService.class, new MetadataServiceRepository(dao), authorizer, ServiceType.METADATA);
  }

  public static class MetadataServiceList extends ResultList<MetadataService> {
    @SuppressWarnings("unused") /* Required for tests */
    public MetadataServiceList() {}
  }

  @GET
  @Operation(
      operationId = "listMetadataServices",
      summary = "List metadata services",
      tags = "metadataService",
      description = "Get a list of metadata services.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Metadata Service instances",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = MetadataServiceResource.MetadataServiceList.class)))
      })
  public ResultList<MetadataService> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @DefaultValue("10") @Min(0) @Max(1000000) @QueryParam("limit") int limitParam,
      @Parameter(
              description = "Returns list of metadata services before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of metadata services after this cursor", schema = @Schema(type = "string"))
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
    ResultList<MetadataService> metadataServices;

    ListFilter filter = new ListFilter(include);
    if (before != null) {
      metadataServices = dao.listBefore(uriInfo, fields, filter, limitParam, before);
    } else {
      metadataServices = dao.listAfter(uriInfo, fields, filter, limitParam, after);
    }
    return addHref(uriInfo, decryptOrNullify(securityContext, metadataServices));
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getMetadataServiceByID",
      summary = "Get a metadata service by Id",
      tags = "metadataService",
      description = "Get a Metadata Service by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Metadata Service instance",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = MetadataService.class))),
        @ApiResponse(responseCode = "404", description = "Metadata Service for instance {id} is not found")
      })
  public MetadataService get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the metadata service", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
    MetadataService metadataService = getInternal(uriInfo, securityContext, id, fieldsParam, include);
    return decryptOrNullify(securityContext, metadataService);
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getMetadataServiceByFQN",
      summary = "Get a metadata service by name",
      tags = "metadataService",
      description = "Get a Metadata Service by the service `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Metadata Service instance",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = MetadataService.class))),
        @ApiResponse(responseCode = "404", description = "Metadata Service for instance {name} is not found")
      })
  public MetadataService getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the metadata service", schema = @Schema(type = "string")) @PathParam("name")
          String name,
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
    MetadataService metadataService = getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
    return decryptOrNullify(securityContext, metadataService);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllMetadataServiceVersion",
      summary = "List metadata service versions",
      tags = "metadataService",
      description = "Get a list of all the versions of a Metadata Service identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Metadata Service versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the metadata service", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    EntityHistory entityHistory = super.listVersionsInternal(securityContext, id);

    List<Object> versions =
        entityHistory.getVersions().stream()
            .map(
                json -> {
                  try {
                    MetadataService MetadataService = JsonUtils.readValue((String) json, MetadataService.class);
                    return JsonUtils.pojoToJson(decryptOrNullify(securityContext, MetadataService));
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
      operationId = "getSpecificMetadataServiceVersion",
      summary = "Get a version of the metadata service",
      tags = "metadataService",
      description = "Get a version of the Metadata Service by given `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Metadata Service",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = MetadataService.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Metadata Service for instance {id} and version " + "{version} is not found")
      })
  public MetadataService getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the metadata service", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "Metadata Service version number in the form `major`" + ".`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    MetadataService metadataService = super.getVersionInternal(securityContext, id, version);
    return decryptOrNullify(securityContext, metadataService);
  }

  @POST
  @Operation(
      operationId = "createMetadataService",
      summary = "Create metadata service",
      tags = "metadataService",
      description = "Create a new Metadata Service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Metadata Service instance",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = MetadataService.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateMetadataService create)
      throws IOException {
    MetadataService service = getMetadataService(create, securityContext.getUserPrincipal().getName());
    Response response = create(uriInfo, securityContext, service);
    decryptOrNullify(securityContext, (MetadataService) response.getEntity());
    return response;
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateMetadataService",
      summary = "Update metadata service",
      tags = "metadataService",
      description = "Update an existing or create a new Metadata Service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Metadata Service instance",
            content =
                @Content(mediaType = "application/json", schema = @Schema(implementation = MetadataService.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateMetadataService update)
      throws IOException {
    MetadataService service = getMetadataService(update, securityContext.getUserPrincipal().getName());
    Response response = createOrUpdate(uriInfo, securityContext, service);
    decryptOrNullify(securityContext, (MetadataService) response.getEntity());
    return response;
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchMetadataService",
      summary = "Update a metadata service",
      tags = "metadataService",
      description = "Update an existing Metadata service using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the metadata service", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[" + "{op:remove, path:/a}," + "{op:add, path: /b, value: val}" + "]")
                      }))
          JsonPatch patch)
      throws IOException {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteMetadataService",
      summary = "Delete a metadata service by Id",
      tags = "metadataService",
      description = "Delete a metadata services. If some service belong the service, it can't be " + "deleted.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "MetadataService service for instance {id} " + "is not found")
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
      @Parameter(description = "Id of the metadata service", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteMetadataServiceByName",
      summary = "Delete a metadata service by name",
      tags = "metadataService",
      description =
          "Delete a metadata services by `name`. If some service belong the service, it can't be " + "deleted.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "MetadataService service for instance {name} " + "is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Name of the metadata service", schema = @Schema(type = "string")) @PathParam("name")
          String name)
      throws IOException {
    return deleteByName(uriInfo, securityContext, name, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted metadata service.",
      tags = "metadataService",
      description = "Restore a soft deleted metadata service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the Table ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Table.class)))
      })
  public Response restoreTable(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RestoreEntity restore)
      throws IOException {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  private MetadataService getMetadataService(CreateMetadataService create, String user) throws IOException {
    return copy(new MetadataService(), create, user)
        .withServiceType(create.getServiceType())
        .withConnection(create.getConnection());
  }

  @Override
  protected MetadataService nullifyConnection(MetadataService service) {
    return service.withConnection(null);
  }

  @Override
  protected String extractServiceType(MetadataService service) {
    return service.getServiceType().value();
  }

  private ElasticsSearch getElasticSearchConnectionSink(ElasticSearchConfiguration esConfig) {
    if (Objects.nonNull(esConfig)) {
      ElasticsSearch sink = new ElasticsSearch();
      ComponentConfig componentConfig = new ComponentConfig();
      sink.withType("elasticsearch")
          .withConfig(
              componentConfig
                  .withAdditionalProperty("es_host", esConfig.getHost())
                  .withAdditionalProperty("es_port", esConfig.getPort().toString())
                  .withAdditionalProperty("es_username", esConfig.getUsername())
                  .withAdditionalProperty("es_password", esConfig.getPassword())
                  .withAdditionalProperty("scheme", esConfig.getScheme()));
      return sink;
    } else {
      throw new RuntimeException("Elastic Search Configuration Missing");
    }
  }
}
