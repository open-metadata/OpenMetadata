package org.openmetadata.service.resources.governance;

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
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.governance.CreateWorkflowDefinition;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.ResultList;

@Path("/v1/governance/workflowDefinitions")
@Tag(
    name = "Workflow Definitions",
    description =
        "A `Workflow Definition` is a configured workflow setup for a given governance task.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "governanceWorkflows")
@Slf4j
public class WorkflowDefinitionResource
    extends EntityResource<WorkflowDefinition, WorkflowDefinitionRepository> {
  public static final String COLLECTION_PATH = "v1/governance/workflowDefinitions/";
  static final String FIELDS = "owners";
  private final WorkflowDefinitionMapper mapper = new WorkflowDefinitionMapper();

  public WorkflowDefinitionResource(Authorizer authorizer, Limits limits) {
    super(Entity.WORKFLOW_DEFINITION, authorizer, limits);
  }

  public static class WorkflowDefinitionList extends ResultList<WorkflowDefinition> {
    /* Required for serde */
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    repository.initSeedDataFromResources();
  }

  @GET
  @Operation(
      operationId = "listWorkflowDefinitions",
      summary = "List Workflow Definitions",
      description =
          "Get a list of Workflow Definitions. Use `fields` parameter to get only necessary fields."
              + " Use cursor-based pagination tom limit the number of entries in the list"
              + " using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Workflow Definitions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema =
                        @Schema(
                            implementation =
                                WorkflowDefinitionResource.WorkflowDefinitionList.class)))
      })
  public ResultList<WorkflowDefinition> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit the number of Workflow Definitions returned. Default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          int limitParam,
      @Parameter(description = "Returns the list of Workflow Definitions before this cursor")
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns the list of Workflow Definitions after this cursor")
          @QueryParam("after")
          String after,
      @Parameter(description = "Include all, deleted or non-deleted entities.")
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ListFilter filter = new ListFilter(include);
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllWorkflowDefinitionVersion",
      summary = "List Workflow Definition versions",
      description = "Get a list of all the versions of a Workflow Definition identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Workflow Definition versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Workflow Definition", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getWorkflowDefinitionByID",
      summary = "Get a Workflow Definition by Id",
      description = "Get a Workflow Definition by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Workflow Definition",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = WorkflowDefinition.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Workflow Definition for instance {id} is not found")
      })
  public WorkflowDefinition get(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the Workflow Definition", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Context SecurityContext securityContext,
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
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @POST
  @Path("/{id}/redeploy")
  @Operation(
      operationId = "getWorkflowDefinitionByID",
      summary = "Get a Workflow Definition by Id",
      description = "Get a Workflow Definition by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Workflow Definition",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = WorkflowDefinition.class)))
      })
  public Response redeploy(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the Workflow Definition", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Context SecurityContext securityContext) {
    WorkflowDefinition wd =
        repository.get(
            uriInfo,
            id,
            new EntityUtil.Fields(repository.getAllowedFields()),
            Include.NON_DELETED,
            false);
    WorkflowHandler.getInstance().deleteWorkflowDefinition(wd);
    WorkflowHandler.getInstance().deploy(new Workflow(wd));
    return Response.status(Response.Status.OK).entity("Workflow Redeployed").build();
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getWorkflowDefinitionByFQN",
      summary = "Get a Workflow Definition by fully qualified name",
      description = "Get a Workflow Definition by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Workflow Definition",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = WorkflowDefinition.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Workflow Definition for instance {fqn} is not found")
      })
  public WorkflowDefinition getByName(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Fully qualified name of the Workflow Definition",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Context SecurityContext securityContext,
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
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificWorkflowDefinitionVersion",
      summary = "Get a version of the Workflow Definition",
      description = "Get a version of the Workflow Definition by given `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "database",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = WorkflowDefinition.class))),
        @ApiResponse(
            responseCode = "404",
            description =
                "Workflow Definition for instance {id} and version {version} is not found")
      })
  public WorkflowDefinition getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Workflow Definition", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "WorkflowDefinition version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createWorkflowDefinition",
      summary = "Create a Workflow Definition",
      description = "Create a Workflow Definition.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Workflow Definition",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = WorkflowDefinition.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateWorkflowDefinition create) {
    WorkflowDefinition workflowDefinition =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, workflowDefinition);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchWorkflowDefinition",
      summary = "Update a Workflow Definition by Id",
      description = "Update an existing Workflow Definition using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Workflow Definition", schema = @Schema(type = "UUID"))
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
      operationId = "patchWorkflowDefinition",
      summary = "Update a Workflow Definition by name.",
      description = "Update an existing Workflow Definition using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Workflow Definition", schema = @Schema(type = "string"))
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

  @PUT
  @Operation(
      operationId = "createOrUpdateWorkflowDefinition",
      summary = "Create or update Workflow Definition",
      description =
          "Create a Workflow Definition, if it does not exist or update an existing Workflow Definition.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated Workflow Definition",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = WorkflowDefinition.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateWorkflowDefinition create) {
    WorkflowDefinition workflowDefinition =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, workflowDefinition);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteWorkflowDefinition",
      summary = "Delete a Workflow Definition by Id",
      description = "Delete a Workflow Definition by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Workflow Definition for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Recursively delete this entity and it's children. (default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the Workflow Definition", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteWorkflowDefinitionAsync",
      summary = "Asynchronously delete a Workflow Definition by Id",
      description = "Asynchronously delete a Workflow Definition by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Workflow Definition for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Recursively delete this entity and it's children. (default `false`)")
          @DefaultValue("false")
          @QueryParam("recursive")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the Workflow Definition", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return deleteByIdAsync(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteWorkflowDefinitionByFQN",
      summary = "Delete a Workflow Definition by fully qualified name",
      description = "Delete a Workflow Definition by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Workflow Definition for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(
              description = "Recursively delete this entity and it's children. (default `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive,
      @Parameter(
              description = "Fully qualified name of the Workflow Definition",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    return deleteByName(uriInfo, securityContext, fqn, recursive, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted Workflow Definition.",
      description = "Restore a soft deleted Workflow Definition.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the Workflow Definition. ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = WorkflowDefinition.class)))
      })
  public Response restore(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @POST
  @Path("/name/{fqn}/trigger")
  @Operation(
      operationId = "triggerWorkflow",
      summary = "Start a new instance of a Workflow Definition",
      description = "Start a new instance of a Workflow Definition.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Workflow trigger status code",
            content = @Content(mediaType = "application/json")),
        @ApiResponse(
            responseCode = "404",
            description = "Workflow Definition named '{fqn}' is not found")
      })
  public Response trigger(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Workflow Definition", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    boolean triggerResponse = WorkflowHandler.getInstance().triggerWorkflow(fqn);
    if (triggerResponse) {
      return Response.status(Response.Status.OK).entity("Workflow Triggered").build();
    } else {
      return Response.status(Response.Status.NOT_FOUND).entity(fqn).build();
    }
  }

  // TEST API - REMOVE BEFORE PRODUCTION
  @POST
  @Path("/test/rollback/{entityType}/{entityId}")
  @Operation(
      operationId = "testRollbackEntity",
      summary = "Test rollback entity to previous version",
      description =
          "Tests rolling back an entity to its previous approved version. REMOVE BEFORE PRODUCTION.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Rollback test result",
            content = @Content(mediaType = "application/json"))
      })
  public Response testRollbackEntity(
      @Context SecurityContext securityContext,
      @Parameter(description = "Entity type (e.g., table, dashboard)") @PathParam("entityType")
          String entityType,
      @Parameter(description = "Entity UUID") @PathParam("entityId") UUID entityId,
      @Parameter(description = "Target version to rollback to (optional)")
          @QueryParam("targetVersion")
          String targetVersion) {
    try {
      EntityRepository<?> entityRepo = Entity.getEntityRepository(entityType);

      EntityInterface currentEntity =
          entityRepo.get(null, entityId, entityRepo.getFields("*"), Include.ALL, false);

      if (currentEntity == null) {
        return Response.status(Response.Status.NOT_FOUND)
            .entity(Map.of("error", "Entity not found", "entityId", entityId))
            .build();
      }
      EntityHistory history = entityRepo.listVersions(entityId);

      Double versionToRestore = null;
      if (targetVersion != null && !targetVersion.isEmpty()) {
        versionToRestore = Double.parseDouble(targetVersion);
      } else {
        // Find previous version automatically
        Double currentVersion = currentEntity.getVersion();
        for (Object versionObj : history.getVersions()) {
          try {
            // The versions list contains JSON strings, not Maps
            String versionJson;
            if (versionObj instanceof String) {
              versionJson = (String) versionObj;
            } else {
              // Fallback: convert to JSON if it's not already a string
              versionJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(versionObj);
            }

            // Parse the JSON to get the entity
            EntityInterface versionEntity =
                org.openmetadata.schema.utils.JsonUtils.readValue(
                    versionJson, currentEntity.getClass());
            Double versionNumber = versionEntity.getVersion();

            if (versionNumber != null && versionNumber < currentVersion) {
              versionToRestore = versionNumber;
              break; // Get the most recent previous version
            }
          } catch (Exception e) {
            // Skip this version if we can't parse it
            LOG.warn("Could not parse version object: {}", e.getMessage());
            continue;
          }
        }
      }

      if (versionToRestore == null) {
        return Response.status(Response.Status.BAD_REQUEST)
            .entity(
                Map.of(
                    "error", "No previous version found",
                    "currentVersion", currentEntity.getVersion(),
                    "availableVersions", history.getVersions()))
            .build();
      }

      String userName = securityContext.getUserPrincipal().getName();
      // Put
      //      currentEntity = entityRepo.get(null, entityId, entityRepo.getFields("*"), Include.ALL,
      // false);
      //      EntityInterface previousEntity = entityRepo.getVersion(entityId,
      // versionToRestore.toString());
      //      @SuppressWarnings("unchecked")
      //      EntityRepository<EntityInterface> typedRepo = (EntityRepository<EntityInterface>)
      // entityRepo;
      //      previousEntity.setUpdatedBy(userName);
      //      previousEntity.setUpdatedAt(System.currentTimeMillis());
      //      org.openmetadata.service.util.RestUtil.PutResponse<EntityInterface> putResponse =
      //          typedRepo.update(null, currentEntity, previousEntity, userName);

      // Get current entity using getVersion (not get with fields)
      currentEntity = entityRepo.getVersion(entityId, currentEntity.getVersion().toString());

      // Get previous entity using getVersion
      EntityInterface previousEntity = entityRepo.getVersion(entityId, versionToRestore.toString());

      // Now both loaded the same way - create PATCH
      String currentJson = JsonUtils.pojoToJson(currentEntity);
      String previousJson = JsonUtils.pojoToJson(previousEntity);
      JsonPatch patch = JsonUtils.getJsonPatch(currentJson, previousJson);

      // Apply PATCH
      entityRepo.patch(null, currentEntity.getFullyQualifiedName(), userName, patch);

      Map<String, Object> result = new HashMap<>();
      result.put("status", "success");
      result.put("entityId", entityId);
      result.put("entityType", entityType);
      result.put("rolledBackFrom", currentEntity.getVersion());
      result.put("rolledBackTo", versionToRestore);
      //      result.put("newVersion", patch.getEntity().getVersion());
      result.put("entityName", currentEntity.getName());
      result.put(
          "message",
          String.format(
              "Successfully rolled back %s from version %.1f to %.1f",
              currentEntity.getName(), currentEntity.getVersion(), versionToRestore));

      return Response.ok(result).build();

    } catch (Exception e) {
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity(
              Map.of(
                  "error",
                  "Rollback failed",
                  "message",
                  e.getMessage(),
                  "entityId",
                  entityId,
                  "entityType",
                  entityType))
          .build();
    }
  }
}
