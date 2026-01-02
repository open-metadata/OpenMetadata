package org.openmetadata.service.resources.ai;

import static org.openmetadata.service.services.ai.PromptTemplateService.FIELDS;

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
import java.util.UUID;
import org.openmetadata.schema.api.ai.CreatePromptTemplate;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.ai.PromptTemplate;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.services.ai.PromptTemplateService;

@Path("/v1/promptTemplates")
@Tag(
    name = "Prompt Templates",
    description =
        "`Prompt Templates` are reusable, parameterized templates for LLM interactions that ensure consistent and effective prompting across AI agents.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "promptTemplates")
public class PromptTemplateResource {
  public static final String COLLECTION_PATH = "v1/promptTemplates/";
  private final PromptTemplateService service;

  public PromptTemplateResource(PromptTemplateService service) {
    this.service = service;
  }

  @GET
  @Valid
  @Operation(
      operationId = "listPromptTemplates",
      summary = "List prompt templates",
      description =
          "Get a list of prompt templates. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of templates",
            content =
                @Content(
                    mediaType = "application/json",
                    schema =
                        @Schema(implementation = PromptTemplateService.PromptTemplateList.class)))
      })
  public ResultList<PromptTemplate> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit the number templates returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(
              description = "Returns list of templates before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of templates after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ListFilter filter = new ListFilter(include);
    return service.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getPromptTemplateByID",
      summary = "Get a prompt template by Id",
      description = "Get a prompt template by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The template",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PromptTemplate.class))),
        @ApiResponse(responseCode = "404", description = "Template for instance {id} is not found")
      })
  public PromptTemplate get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Prompt Template", schema = @Schema(type = "UUID"))
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
    return service.getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getPromptTemplateByFQN",
      summary = "Get a prompt template by fully qualified name",
      description = "Get a prompt template by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The template",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PromptTemplate.class))),
        @ApiResponse(responseCode = "404", description = "Template for instance {fqn} is not found")
      })
  public PromptTemplate getByName(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Fully qualified name of Prompt Template",
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

  @POST
  @Operation(
      operationId = "createPromptTemplate",
      summary = "Create a prompt template",
      description = "Create a new prompt template.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Prompt Template",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PromptTemplate.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreatePromptTemplate create) {
    PromptTemplate promptTemplate =
        service.getMapper().createToEntity(create, securityContext.getUserPrincipal().getName());
    return service.create(uriInfo, securityContext, promptTemplate);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchPromptTemplate",
      summary = "Update a prompt template",
      description = "Update an existing prompt template using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Prompt Template", schema = @Schema(type = "UUID"))
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
    return service.patchInternal(uriInfo, securityContext, id, patch);
  }

  @PATCH
  @Path("/name/{fqn}")
  @Operation(
      operationId = "patchPromptTemplate",
      summary = "Update a prompt template by name.",
      description = "Update an existing prompt template using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Prompt Template", schema = @Schema(type = "string"))
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
    return service.patchInternal(uriInfo, securityContext, fqn, patch);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdatePromptTemplate",
      summary = "Create or update a prompt template",
      description =
          "Create a new prompt template, if it does not exist or update an existing template.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The template",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PromptTemplate.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreatePromptTemplate create) {
    PromptTemplate promptTemplate =
        service.getMapper().createToEntity(create, securityContext.getUserPrincipal().getName());
    return service.createOrUpdate(uriInfo, securityContext, promptTemplate);
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      operationId = "addFollower",
      summary = "Add a follower",
      description = "Add a user identified by `userId` as follower of this template",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "template for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Prompt Template", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the user to be added as follower",
              schema = @Schema(type = "UUID"))
          UUID userId) {
    return service
        .addFollower(securityContext.getUserPrincipal().getName(), id, userId)
        .toResponse();
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(
      operationId = "deleteFollower",
      summary = "Remove a follower",
      description = "Remove the user identified `userId` as a follower of the template.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
      })
  public Response deleteFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Prompt Template", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the user being removed as follower",
              schema = @Schema(type = "UUID"))
          @PathParam("userId")
          UUID userId) {
    return service
        .deleteFollower(securityContext.getUserPrincipal().getName(), id, userId)
        .toResponse();
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllPromptTemplateVersion",
      summary = "List prompt template versions",
      description = "Get a list of all the versions of a Prompt Template identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Prompt Template versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Prompt Template", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return service.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificPromptTemplateVersion",
      summary = "Get a version of the prompt template",
      description = "Get a version of the prompt template by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "PromptTemplate",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PromptTemplate.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Prompt Template for instance {id} and version {version} is not found")
      })
  public PromptTemplate getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Prompt Template", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Prompt Template version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return service.getVersionInternal(securityContext, id, version);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deletePromptTemplate",
      summary = "Delete a prompt template by Id",
      description = "Delete a prompt template by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "template for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the Prompt Template", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return service.delete(uriInfo, securityContext, id, false, hardDelete);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deletePromptTemplateAsync",
      summary = "Asynchronously delete a prompt template by Id",
      description = "Asynchronously delete a prompt template by `Id`.",
      responses = {
        @ApiResponse(responseCode = "202", description = "Accepted"),
        @ApiResponse(responseCode = "404", description = "template for instance {id} is not found")
      })
  public Response deleteByIdAsync(
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
      @Parameter(description = "Id of the Prompt Template", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return service.deleteByIdAsync(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deletePromptTemplateByFQN",
      summary = "Delete a prompt template by fully qualified name",
      description = "Delete a prompt template by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "template for instance {fqn} is not found")
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
      @Parameter(description = "Name of the Prompt Template", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    return service.deleteByName(uriInfo, securityContext, fqn, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted prompt template",
      description = "Restore a soft deleted Prompt Template.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the PromptTemplate ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PromptTemplate.class)))
      })
  public Response restorePromptTemplate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return service.restoreEntity(uriInfo, securityContext, restore.getId());
  }
}
