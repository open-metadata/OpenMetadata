package org.openmetadata.service.resources.governance;

import static org.openmetadata.service.services.governance.WorkflowDefinitionService.FIELDS;

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
import java.util.UUID;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.governance.CreateWorkflowDefinition;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.services.governance.WorkflowDefinitionService;

@Path("/v1/governance/workflowDefinitions")
@Tag(
    name = "Workflow Definitions",
    description =
        "A `Workflow Definition` is a configured workflow setup for a given governance task.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "governanceWorkflows", entityType = Entity.WORKFLOW_DEFINITION)
public class WorkflowDefinitionResource {
  public static final String COLLECTION_PATH = "v1/governance/workflowDefinitions/";
  private final WorkflowDefinitionService service;

  public WorkflowDefinitionResource(WorkflowDefinitionService service) {
    this.service = service;
  }

  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    service.initialize(config);
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
                                WorkflowDefinitionService.WorkflowDefinitionList.class)))
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
    return service.listInternal(
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
    return service.listVersionsInternal(securityContext, id);
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
    return service.getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @POST
  @Path("/{id}/redeploy")
  @Operation(
      operationId = "redeployWorkflowDefinition",
      summary = "Redeploy a Workflow Definition by Id",
      description = "Redeploy a Workflow Definition by `Id`.",
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
    return service.redeploy(uriInfo, id);
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
    return service.getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
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
    return service.getVersionInternal(securityContext, id, version);
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
        service.getMapper().createToEntity(create, securityContext.getUserPrincipal().getName());
    return service.createWorkflow(uriInfo, securityContext, workflowDefinition);
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
    return service.patchWorkflow(uriInfo, securityContext, id, patch);
  }

  @PATCH
  @Path("/name/{fqn}")
  @Operation(
      operationId = "patchWorkflowDefinitionByName",
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
    return service.patchWorkflowByName(uriInfo, securityContext, fqn, patch);
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
        service.getMapper().createToEntity(create, securityContext.getUserPrincipal().getName());
    return service.createOrUpdateWorkflow(uriInfo, securityContext, workflowDefinition);
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
    return service.deleteWorkflow(uriInfo, securityContext, id, hardDelete);
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
    return service.deleteByIdAsync(uriInfo, securityContext, id, recursive, hardDelete);
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
    return service.deleteWorkflowByName(uriInfo, securityContext, fqn, hardDelete);
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
    return service.restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @POST
  @Path("/validate")
  @Operation(
      operationId = "validateWorkflowDefinition",
      summary = "Validate a Workflow Definition",
      description =
          "Validates a Workflow Definition for cycles, node ID conflicts, user task requirements, and updatedBy namespace configuration. "
              + "This is useful for workflow builders to test their configuration before saving.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Workflow Definition is valid",
            content = @Content(mediaType = "application/json")),
        @ApiResponse(
            responseCode = "400",
            description = "Workflow Definition validation failed",
            content = @Content(mediaType = "application/json"))
      })
  public Response validate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateWorkflowDefinition create) {
    WorkflowDefinition workflowDefinition =
        service.getMapper().createToEntity(create, securityContext.getUserPrincipal().getName());
    return service.validateWorkflow(securityContext, workflowDefinition);
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
            description = "Workflow triggered successfully",
            content = @Content(mediaType = "application/json")),
        @ApiResponse(
            responseCode = "400",
            description = "Workflow is suspended or cannot be triggered"),
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
    return service.triggerWorkflow(uriInfo, fqn);
  }

  @PUT
  @Path("/name/{fqn}/suspend")
  @Operation(
      operationId = "suspendWorkflow",
      summary = "Suspend a Workflow Definition",
      description = "Suspend a Workflow Definition to temporarily stop its execution.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Workflow suspended successfully",
            content = @Content(mediaType = "application/json")),
        @ApiResponse(
            responseCode = "404",
            description = "Workflow Definition named '{fqn}' is not found")
      })
  public Response suspend(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Workflow Definition", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    return service.suspendWorkflow(uriInfo, securityContext, fqn);
  }

  @PUT
  @Path("/name/{fqn}/resume")
  @Operation(
      operationId = "resumeWorkflow",
      summary = "Resume a suspended Workflow Definition",
      description = "Resume a suspended Workflow Definition to continue its execution.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Workflow resumed successfully",
            content = @Content(mediaType = "application/json")),
        @ApiResponse(
            responseCode = "404",
            description = "Workflow Definition named '{fqn}' is not found")
      })
  public Response resume(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Workflow Definition", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    return service.resumeWorkflow(uriInfo, securityContext, fqn);
  }
}
