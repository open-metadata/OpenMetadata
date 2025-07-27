/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.resources.apis;

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
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreateAPIEndpoint;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.APIEndpointRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.ResultList;

@Path("/v1/apiEndpoints")
@Tag(
    name = "API Endpoint",
    description =
        "A `API Endpoint` is a specific endpoint of an API that is part of an API Collection..")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "apiEndpoints")
public class APIEndpointResource extends EntityResource<APIEndpoint, APIEndpointRepository> {
  public static final String COLLECTION_PATH = "v1/apiEndpoints/";
  private final APIEndpointMapper mapper = new APIEndpointMapper();

  static final String FIELDS = "owners,followers,tags,extension,domains,dataProducts,sourceHash";

  @Override
  public APIEndpoint addHref(UriInfo uriInfo, APIEndpoint apiEndpoint) {
    super.addHref(uriInfo, apiEndpoint);
    Entity.withHref(uriInfo, apiEndpoint.getApiCollection());
    Entity.withHref(uriInfo, apiEndpoint.getService());
    return apiEndpoint;
  }

  public APIEndpointResource(Authorizer authorizer, Limits limits) {
    super(Entity.API_ENDPOINT, authorizer, limits);
  }

  public static class APIEndpointList extends ResultList<APIEndpoint> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listAPIEndpoints",
      summary = "List API Endpoints",
      description =
          "Get a list of API Endpoints, optionally filtered by `service` it belongs to. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of API Endpoints",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = APIEndpointList.class)))
      })
  public ResultList<APIEndpoint> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Filter APIEndpoints by service name",
              schema = @Schema(type = "string", example = "OpenMetadata API Service"))
          @QueryParam("service")
          String serviceParam,
      @Parameter(
              description = "Filter APIEndpoints by apiCollection name",
              schema = @Schema(type = "string", example = "UsersAPI"))
          @QueryParam("apiCollection")
          String apiCollectionParam,
      @Parameter(
              description = "Limit the number APIEndpoints returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          int limitParam,
      @Parameter(
              description = "Returns list of APIEndpoints before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of APIEndpoints after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ListFilter filter =
        new ListFilter(include)
            .addQueryParam("service", serviceParam)
            .addQueryParam("apiCollection", apiCollectionParam);
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllAPIEndpointVersion",
      summary = "List API Endpoint versions",
      description = "Get a list of all the versions of a APIEndpoint identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of APIEndpoint versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the APIEndpoint", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getEndpointById",
      summary = "Get a APIEndpoint by id",
      description = "Get a APIEndpoint by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The APIEndpoint",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = APIEndpoint.class))),
        @ApiResponse(
            responseCode = "404",
            description = "APIEndpoint for instance {id} is not found")
      })
  public APIEndpoint get(
      @Context UriInfo uriInfo,
      @Parameter(description = "Id of the APIEndpoint", schema = @Schema(type = "UUID"))
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

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getEndpointByFQN",
      summary = "Get a Endpoint by fully qualified name.",
      description = "Get a Endpoint by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The APIEndpoint",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = APIEndpoint.class))),
        @ApiResponse(responseCode = "404", description = "Endpoint for instance {fqn} is not found")
      })
  public APIEndpoint getByName(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Fully qualified name of the Endpoint",
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
      operationId = "getSpecificEndpointVersion",
      summary = "Get a version of the APIEndpoint",
      description = "Get a version of the APIEndpoint by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "APIEndpoint Version",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = APIEndpoint.class))),
        @ApiResponse(
            responseCode = "404",
            description = "APIEndpoint for instance {id} and version {version} is not found")
      })
  public APIEndpoint getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the APIEndpoint", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "APIEndpoint version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createAPIEndpoint",
      summary = "Create a API Endpoint",
      description = "Create a API Endpoint under an existing `service`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The API Endpoint",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = APIEndpoint.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateAPIEndpoint create) {
    APIEndpoint apiEndpoint =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, apiEndpoint);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchAPIEndpoint",
      summary = "Update a APIEndpoint",
      description = "Update an existing APIEndpoint using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateMetric(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the APIEndpoint", schema = @Schema(type = "UUID"))
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
      operationId = "patchAPIEndpoint",
      summary = "Update a APIEndpoint using name.",
      description = "Update an existing APIEndpoint using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateAPIEndpoint(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the APIEndpoint", schema = @Schema(type = "string"))
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
      operationId = "createOrUpdateAPIEndpoint",
      summary = "Update API Endpoint",
      description =
          "Create a API Endpoint, it it does not exist or update an existing API Endpoint.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated api endpoint ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = APIEndpoint.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateAPIEndpoint create) {
    APIEndpoint apiEndpoint =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, apiEndpoint);
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      operationId = "addFollower",
      summary = "Add a follower",
      description = "Add a user identified by `userId` as followed of this APiEndpoint.",
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
            description = "APIEndpoint for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the APIEndpoint", schema = @Schema(type = "UUID"))
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
      summary = "Remove a follower",
      description = "Remove the user identified `userId` as a follower of the APIEndpoint.",
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
      @Parameter(description = "Id of the APIEndpoint", schema = @Schema(type = "UUID"))
          @PathParam("id")
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
  @Path("/{id}/vote")
  @Operation(
      operationId = "updateVoteForAPIEndpoint",
      summary = "Update Vote for a APIEndpoint",
      description = "Update vote for a APIEndpoint",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "model for instance {id} is not found")
      })
  public Response updateVote(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Entity", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Valid VoteRequest request) {
    return repository
        .updateVote(securityContext.getUserPrincipal().getName(), id, request)
        .toResponse();
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteAPIEndpoint",
      summary = "Delete a APIEndpoint by id",
      description = "Delete a APIEndpoint by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "APIEndpoint for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the APIEndpoint", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, false, hardDelete);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteAPIEndpointAsync",
      summary = "Asynchronously delete a APIEndpoint by id",
      description = "Asynchronously delete a APIEndpoint by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "APIEndpoint for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Id of the APIEndpoint", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return deleteByIdAsync(uriInfo, securityContext, id, false, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteAPIEndpointByFQN",
      summary = "Delete a APIEndpoint by fully qualified name",
      description = "Delete a APIEndpoint by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "APIEndpoint for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(
              description = "Fully qualified name of the APIEndpoint",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {
    return deleteByName(uriInfo, securityContext, fqn, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted APIEndpoint",
      description = "Restore a soft deleted APIEndpoint.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the APIEndpoint. ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = APIEndpoint.class)))
      })
  public Response restore(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }
}
