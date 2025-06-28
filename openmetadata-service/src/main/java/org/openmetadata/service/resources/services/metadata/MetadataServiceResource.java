package org.openmetadata.service.resources.services.metadata;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;

import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.json.JsonPatch;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.services.CreateMetadataService;
import org.openmetadata.schema.entity.services.MetadataConnection;
import org.openmetadata.schema.entity.services.MetadataService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.services.connections.metadata.ComponentConfig;
import org.openmetadata.schema.services.connections.metadata.ElasticsSearch;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.MetadataServiceRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.services.ServiceEntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/services/metadataServices")
@Tag(
    name = "Metadata Services",
    description =
        "APIs related to creating and managing other Metadata Services that "
            + "OpenMetadata integrates with such as `Apache Atlas`, `Amundsen`, etc.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "metadataServices", order = 8) // init before IngestionPipelineService
public class MetadataServiceResource
    extends ServiceEntityResource<MetadataService, MetadataServiceRepository, MetadataConnection> {
  private final MetadataServiceMapper mapper = new MetadataServiceMapper();
  public static final String OPENMETADATA_SERVICE = "OpenMetadata";
  public static final String COLLECTION_PATH = "v1/services/metadataServices/";
  public static final String FIELDS = "pipelines,owners,tags,followers";

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    registerMetadataServices(config);
  }

  private void registerMetadataServices(OpenMetadataApplicationConfig config) throws IOException {
    List<MetadataService> servicesList =
        repository.getEntitiesFromSeedData(".*json/data/metadataService/OpenmetadataService.json$");
    if (!nullOrEmpty(servicesList)) {
      MetadataService openMetadataService = servicesList.get(0);
      openMetadataService.setId(UUID.randomUUID());
      openMetadataService.setUpdatedBy(ADMIN_USER_NAME);
      openMetadataService.setUpdatedAt(System.currentTimeMillis());
      if (config.getElasticSearchConfiguration() != null) {
        OpenMetadataConnection openMetadataServerConnection =
            new OpenMetadataConnectionBuilder(config)
                .build()
                .withElasticsSearch(
                    getElasticSearchConnectionSink(config.getElasticSearchConfiguration()));
        MetadataConnection metadataConnection =
            new MetadataConnection().withConfig(openMetadataServerConnection);
        openMetadataService.setConnection(metadataConnection);
      } else {
        LOG.error("[MetadataService] Missing Elastic Search Config.");
      }
      repository.setFullyQualifiedName(openMetadataService);
      repository.createOrUpdate(null, openMetadataService, ADMIN_USER_NAME);
    } else {
      throw new IOException("Failed to initialize OpenMetadata Service.");
    }
  }

  @Override
  public MetadataService addHref(UriInfo uriInfo, MetadataService service) {
    super.addHref(uriInfo, service);
    Entity.withHref(uriInfo, service.getOwners());
    return service;
  }

  public MetadataServiceResource(Authorizer authorizer, Limits limits) {
    super(Entity.METADATA_SERVICE, authorizer, limits, ServiceType.METADATA);
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("pipelines", MetadataOperation.VIEW_BASIC);
    return null;
  }

  public static class MetadataServiceList extends ResultList<MetadataService> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listMetadataServices",
      summary = "List metadata services",
      description = "Get a list of metadata services.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Metadata Service instances",
            content =
                @Content(
                    mediaType = "application/json",
                    schema =
                        @Schema(
                            implementation = MetadataServiceResource.MetadataServiceList.class)))
      })
  public ResultList<MetadataService> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @DefaultValue("10")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(
              description = "Returns list of metadata services before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of metadata services after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    return listInternal(
        uriInfo, securityContext, fieldsParam, include, null, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getMetadataServiceByID",
      summary = "Get a metadata service by Id",
      description = "Get a Metadata Service by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Metadata Service instance",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = MetadataService.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Metadata Service for instance {id} is not found")
      })
  public MetadataService get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the metadata service", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
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
          Include include) {
    MetadataService metadataService =
        getInternal(uriInfo, securityContext, id, fieldsParam, include);
    return decryptOrNullify(securityContext, metadataService);
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getMetadataServiceByFQN",
      summary = "Get a metadata service by name",
      description = "Get a Metadata Service by the service `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Metadata Service instance",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = MetadataService.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Metadata Service for instance {name} is not found")
      })
  public MetadataService getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the metadata service", schema = @Schema(type = "string"))
          @PathParam("name")
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
          Include include) {
    MetadataService metadataService =
        getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
    return decryptOrNullify(securityContext, metadataService);
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      operationId = "addFollowerToMetadataService",
      summary = "Add a follower",
      description = "Add a user identified by `userId` as followed of this Metadata service",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Metadata Service for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Metadata Service", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the user to be added as follower",
              schema = @Schema(type = "string"))
          UUID userId) {
    return repository
        .addFollower(securityContext.getUserPrincipal().getName(), id, userId)
        .toResponse();
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(
      operationId = "deleteFollower",
      summary = "Remove a follower",
      description = "Remove the user identified `userId` as a follower of the entity.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class)))
      })
  public Response deleteFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Entity", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the user being removed as follower",
              schema = @Schema(type = "string"))
          @PathParam("userId")
          String userId) {
    return repository
        .deleteFollower(securityContext.getUserPrincipal().getName(), id, UUID.fromString(userId))
        .toResponse();
  }

  @PUT
  @Path("/{id}/testConnectionResult")
  @Operation(
      operationId = "addTestConnectionResult",
      summary = "Add test connection result",
      description = "Add test connection result to the service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully updated the service",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = MetadataService.class)))
      })
  public MetadataService addTestConnectionResult(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the service", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Valid TestConnectionResult testConnectionResult) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.CREATE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    MetadataService service = repository.addTestConnectionResult(id, testConnectionResult);
    return decryptOrNullify(securityContext, service);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllMetadataServiceVersion",
      summary = "List metadata service versions",
      description = "Get a list of all the versions of a Metadata Service identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Metadata Service versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the metadata service", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    EntityHistory entityHistory = super.listVersionsInternal(securityContext, id);

    List<Object> versions =
        entityHistory.getVersions().stream()
            .map(
                json -> {
                  try {
                    MetadataService metadataService =
                        JsonUtils.readValue((String) json, MetadataService.class);
                    return JsonUtils.pojoToJson(decryptOrNullify(securityContext, metadataService));
                  } catch (Exception e) {
                    return json;
                  }
                })
            .toList();
    entityHistory.setVersions(versions);
    return entityHistory;
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificMetadataServiceVersion",
      summary = "Get a version of the metadata service",
      description = "Get a version of the Metadata Service by given `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Metadata Service",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = MetadataService.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Metadata Service for instance {id} and version {version} is not found")
      })
  public MetadataService getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the metadata service", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Metadata Service version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    MetadataService metadataService = super.getVersionInternal(securityContext, id, version);
    return decryptOrNullify(securityContext, metadataService);
  }

  @POST
  @Operation(
      operationId = "createMetadataService",
      summary = "Create metadata service",
      description = "Create a new Metadata Service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Metadata Service instance",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = MetadataService.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateMetadataService create) {
    MetadataService service =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    Response response = create(uriInfo, securityContext, service);
    decryptOrNullify(securityContext, (MetadataService) response.getEntity());
    return response;
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateMetadataService",
      summary = "Update metadata service",
      description = "Update an existing or create a new Metadata Service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Metadata Service instance",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = MetadataService.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateMetadataService update) {
    MetadataService service =
        mapper.createToEntity(update, securityContext.getUserPrincipal().getName());
    Response response = createOrUpdate(uriInfo, securityContext, unmask(service));
    decryptOrNullify(securityContext, (MetadataService) response.getEntity());
    return response;
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchMetadataService",
      summary = "Update a metadata service",
      description = "Update an existing Metadata service using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the metadata service", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")
                      }))
          JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @PATCH
  @Path("/name/{fqn}")
  @Operation(
      operationId = "patchMetadataService",
      summary = "Update a metadata service using name.",
      description = "Update an existing Metadata service using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the metadata service", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")
                      }))
          JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, fqn, patch);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteMetadataService",
      summary = "Delete a metadata service by Id",
      description =
          "Delete a metadata services. If some service belong the service, it can't be deleted.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "MetadataService service for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the metadata service", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteMetadataServiceAsync",
      summary = "Asynchronously delete a metadata service by Id",
      description =
          "Asynchronously delete a metadata services. If some service belong the service, it can't be deleted.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "MetadataService service for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the metadata service", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return deleteByIdAsync(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteMetadataServiceByName",
      summary = "Delete a metadata service by name",
      description =
          "Delete a metadata services by `name`. If some service belong the service, it can't be deleted.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "MetadataService service for instance {name} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive,
      @Parameter(description = "Name of the metadata service", schema = @Schema(type = "string"))
          @PathParam("name")
          String name) {
    return deleteByName(uriInfo, securityContext, name, recursive, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted metadata service.",
      description = "Restore a soft deleted metadata service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the MetadataService ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = MetadataService.class)))
      })
  public Response restoreMetadataService(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @Override
  protected MetadataService nullifyConnection(MetadataService service) {
    return service.withConnection(null);
  }

  @Override
  protected String extractServiceType(MetadataService service) {
    return service.getServiceType().value();
  }

  private ElasticsSearch getElasticSearchConnectionSink(ElasticSearchConfiguration esConfig)
      throws IOException {
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
      throw new IOException("Elastic Search Configuration Missing");
    }
  }
}
