package org.openmetadata.service.resources.ai;

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
import org.openmetadata.schema.api.ai.CreateAIGovernancePolicy;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.ai.AIGovernancePolicy;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AIGovernancePolicyRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;

@Path("/v1/aiGovernancePolicies")
@Tag(
    name = "AI Governance Policies",
    description =
        "`AI Governance Policies` define rules, compliance requirements, bias thresholds, and control measures for AI agents and models.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "aiGovernancePolicies")
public class AIGovernancePolicyResource
    extends EntityResource<AIGovernancePolicy, AIGovernancePolicyRepository> {
  public static final String COLLECTION_PATH = "/v1/aiGovernancePolicies/";
  private final AIGovernancePolicyMapper mapper = new AIGovernancePolicyMapper();
  static final String FIELDS = "owners,followers,tags,extension,domains";

  @Override
  public AIGovernancePolicy addHref(UriInfo uriInfo, AIGovernancePolicy policy) {
    super.addHref(uriInfo, policy);
    return policy;
  }

  public AIGovernancePolicyResource(Authorizer authorizer, Limits limits) {
    super(Entity.AI_GOVERNANCE_POLICY, authorizer, limits);
  }

  public static class AIGovernancePolicyList extends ResultList<AIGovernancePolicy> {
    /* Required for serde */
  }

  @GET
  @Valid
  @Operation(
      operationId = "listAIGovernancePolicies",
      summary = "List AI governance policies",
      description =
          "Get a list of AI governance policies. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of policies",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = AIGovernancePolicyList.class)))
      })
  public ResultList<AIGovernancePolicy> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit the number policies returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(
              description = "Returns list of policies before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of policies after this cursor",
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
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getAIGovernancePolicyByID",
      summary = "Get an AI governance policy by Id",
      description = "Get an AI governance policy by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The policy",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = AIGovernancePolicy.class))),
        @ApiResponse(responseCode = "404", description = "Policy for instance {id} is not found")
      })
  public AIGovernancePolicy get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the AI Governance Policy", schema = @Schema(type = "UUID"))
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
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getAIGovernancePolicyByFQN",
      summary = "Get an AI governance policy by fully qualified name",
      description = "Get an AI governance policy by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The policy",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = AIGovernancePolicy.class))),
        @ApiResponse(responseCode = "404", description = "Policy for instance {fqn} is not found")
      })
  public AIGovernancePolicy getByName(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Fully qualified name of AI Governance Policy",
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

  @POST
  @Operation(
      operationId = "createAIGovernancePolicy",
      summary = "Create an AI governance policy",
      description = "Create a new AI governance policy.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "AI Governance Policy",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = AIGovernancePolicy.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateAIGovernancePolicy create) {
    AIGovernancePolicy policy =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, policy);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchAIGovernancePolicy",
      summary = "Update an AI governance policy",
      description = "Update an existing AI governance policy using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the AI Governance Policy", schema = @Schema(type = "UUID"))
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
      operationId = "patchAIGovernancePolicy",
      summary = "Update an AI governance policy by name.",
      description = "Update an existing AI governance policy using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Name of the AI Governance Policy",
              schema = @Schema(type = "string"))
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
      operationId = "createOrUpdateAIGovernancePolicy",
      summary = "Create or update an AI governance policy",
      description =
          "Create a new AI governance policy, if it does not exist or update an existing policy.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The policy",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = AIGovernancePolicy.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateAIGovernancePolicy create) {
    AIGovernancePolicy policy =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, policy);
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      operationId = "addFollower",
      summary = "Add a follower",
      description = "Add a user identified by `userId` as follower of this policy",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "policy for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the AI Governance Policy", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the user to be added as follower",
              schema = @Schema(type = "UUID"))
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
      description = "Remove the user identified `userId` as a follower of the policy.",
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
      @Parameter(description = "Id of the AI Governance Policy", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the user being removed as follower",
              schema = @Schema(type = "UUID"))
          @PathParam("userId")
          UUID userId) {
    return repository
        .deleteFollower(securityContext.getUserPrincipal().getName(), id, userId)
        .toResponse();
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllAIGovernancePolicyVersion",
      summary = "List AI governance policy versions",
      description = "Get a list of all the versions of an AI Governance Policy identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of AI Governance Policy versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the AI Governance Policy", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificAIGovernancePolicyVersion",
      summary = "Get a version of the AI governance policy",
      description = "Get a version of the AI governance policy by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "AIGovernancePolicy",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = AIGovernancePolicy.class))),
        @ApiResponse(
            responseCode = "404",
            description =
                "AI Governance Policy for instance {id} and version {version} is not found")
      })
  public AIGovernancePolicy getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the AI Governance Policy", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "AI Governance Policy version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteAIGovernancePolicy",
      summary = "Delete an AI governance policy by Id",
      description = "Delete an AI governance policy by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "policy for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the AI Governance Policy", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, false, hardDelete);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteAIGovernancePolicyAsync",
      summary = "Asynchronously delete an AI governance policy by Id",
      description = "Asynchronously delete an AI governance policy by `Id`.",
      responses = {
        @ApiResponse(responseCode = "202", description = "Accepted"),
        @ApiResponse(responseCode = "404", description = "policy for instance {id} is not found")
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
      @Parameter(description = "Id of the AI Governance Policy", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return deleteByIdAsync(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteAIGovernancePolicyByFQN",
      summary = "Delete an AI governance policy by fully qualified name",
      description = "Delete an AI governance policy by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "policy for instance {fqn} is not found")
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
      @Parameter(
              description = "Name of the AI Governance Policy",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    return deleteByName(uriInfo, securityContext, fqn, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted AI governance policy",
      description = "Restore a soft deleted AI Governance Policy.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the AIGovernancePolicy ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = AIGovernancePolicy.class)))
      })
  public Response restoreAIGovernancePolicy(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }
}
