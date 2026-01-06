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

package org.openmetadata.service.resources.domains;

import static org.openmetadata.service.services.domains.DomainService.FIELDS;

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
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.data.EntityHierarchy;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.services.domains.DomainService;
import org.openmetadata.service.util.EntityHierarchyList;

@Slf4j
@Path("/v1/domains")
@Tag(
    name = "Domains",
    description =
        "A `Domain` is a bounded context that is aligned with a Business Unit or a function within an organization.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "domains", order = 4, entityType = Entity.DOMAIN)
public class DomainResource {
  public static final String COLLECTION_PATH = "/v1/domains/";
  private final DomainService service;

  public DomainResource(DomainService service) {
    this.service = service;
  }

  @GET
  @Operation(
      operationId = "listDomains",
      summary = "List domains",
      description = "Get a list of Domains.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Domains",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = DomainService.DomainList.class)))
      })
  public ResultList<Domain> list(
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
              description = "Returns list of Domain before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of Domain after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after) {
    return service.listInternal(
        uriInfo, securityContext, fieldsParam, new ListFilter(null), limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getDomainByID",
      summary = "Get a domain by Id",
      description = "Get a domain by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The domain",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Domain.class))),
        @ApiResponse(responseCode = "404", description = "Domain for instance {id} is not found")
      })
  public Domain get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Id of the domain", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return service.getInternal(uriInfo, securityContext, id, fieldsParam, null);
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getDomainByFQN",
      summary = "Get a domain by name",
      description = "Get a domain by `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "domain",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Domain.class))),
        @ApiResponse(responseCode = "404", description = "Domain for instance {name} is not found")
      })
  public Domain getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the domain", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam) {
    return service.getByNameInternal(uriInfo, securityContext, name, fieldsParam, null);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllDomainVersion",
      summary = "List domain versions",
      description = "Get a list of all the versions of a domain identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of domain versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the domain", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return service.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "listSpecificDomainVersion",
      summary = "Get a version of the domain",
      description = "Get a version of the domain by given `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "domain",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Domain.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Domain for instance {id} and version {version} is not found")
      })
  public Domain getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the domain", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "Domain version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return service.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createDomain",
      summary = "Create a domain",
      description = "Create a new domain.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The domain ",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Domain.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @RequestBody(
              description = "CreateDomain request",
              content =
                  @Content(
                      mediaType = "application/json",
                      schema = @Schema(implementation = CreateDomain.class)))
          @Valid
          CreateDomain create) {
    Domain domain =
        service.getMapper().createToEntity(create, securityContext.getUserPrincipal().getName());
    return service.create(uriInfo, securityContext, domain);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateDomain",
      summary = "Create or update a domain",
      description =
          "Create a domain. if it does not exist. If a domain already exists, update the domain.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The domain",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Domain.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @RequestBody(
              description = "CreateDomain request",
              content =
                  @Content(
                      mediaType = "application/json",
                      schema = @Schema(implementation = CreateDomain.class)))
          @Valid
          CreateDomain create) {
    Domain domain =
        service.getMapper().createToEntity(create, securityContext.getUserPrincipal().getName());
    return service.createOrUpdate(uriInfo, securityContext, domain);
  }

  @PUT
  @Path("/{name}/assets/add")
  @Operation(
      operationId = "bulkAddAssets",
      summary = "Bulk Add Assets",
      description = "Bulk Add Assets",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = BulkOperationResult.class))),
        @ApiResponse(responseCode = "404", description = "model for instance {id} is not found")
      })
  public Response bulkAddAssets(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the domain", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Valid BulkAssets request) {
    return Response.ok().entity(service.bulkAddAssets(securityContext, name, request)).build();
  }

  @PUT
  @Path("/{name}/assets/remove")
  @Operation(
      operationId = "bulkRemoveAssets",
      summary = "Bulk Remove Assets",
      description = "Bulk Remove Assets",
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
  public Response bulkRemoveGlossaryFromAssets(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the domain", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Valid BulkAssets request) {
    return Response.ok().entity(service.bulkRemoveAssets(securityContext, name, request)).build();
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchDomain",
      summary = "Update a domain",
      description = "Update an existing domain using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the domain", schema = @Schema(type = "UUID")) @PathParam("id")
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
      operationId = "patchDomain",
      summary = "Update a domain by name.",
      description = "Update an existing domain using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the domain", schema = @Schema(type = "string"))
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

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteDomain",
      summary = "Delete a domain by Id",
      description = "Delete a domain by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Domain for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the domain", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return service.delete(uriInfo, securityContext, id, true, true);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteDomainAsync",
      summary = "Asynchronously delete a domain by Id",
      description = "Asynchronously delete a domain by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Domain for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the domain", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id) {
    return service.deleteByIdAsync(uriInfo, securityContext, id, true, true);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteDomainByFQN",
      summary = "Delete a domain by name",
      description = "Delete a domain by `name`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Domain for instance {name} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the domain", schema = @Schema(type = "string"))
          @PathParam("name")
          String name) {
    return service.deleteByName(uriInfo, securityContext, name, true, true);
  }

  @GET
  @Path("/hierarchy")
  @Operation(
      operationId = "listDomainsHierarchy",
      summary = "List domains in hierarchical order",
      description = "Get a list of Domains in hierarchical order.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Domains in hierarchical order",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHierarchyList.class)))
      })
  public ResultList<EntityHierarchy> listHierarchy(
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
              description =
                  "List domains filtered to retrieve the first level/immediate children of the domain `directChildrenOf` parameter. "
                      + "If not specified, returns only root domains (domains with no parent).",
              schema = @Schema(type = "string"))
          @QueryParam("directChildrenOf")
          String directChildrenOf,
      @Parameter(
              description =
                  "Offset from which to start returning results (for offset-based pagination)",
              schema = @Schema(type = "integer", defaultValue = "0"))
          @DefaultValue("0")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @QueryParam("offset")
          int offset) {
    return service.buildHierarchy(fieldsParam, limitParam, directChildrenOf, offset);
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      operationId = "addFollowerToDomain",
      summary = "Add a follower",
      description = "Add a user identified by `userId` as followed of this Domain",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "Domain for instance {id} is not found")
      })
  public Response addFollower(
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Domain", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the user to be added as follower",
              schema = @Schema(type = "string"))
          UUID userId) {
    return service.addDomainFollower(securityContext, id, userId).toResponse();
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(
      operationId = "deleteFollowerFromDomain",
      summary = "Remove a follower",
      description = "Remove the user identified `userId` as a follower of the domain.",
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
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Entity", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "Id of the user being removed as follower",
              schema = @Schema(type = "string"))
          @PathParam("userId")
          String userId) {
    return service.deleteDomainFollower(securityContext, id, UUID.fromString(userId)).toResponse();
  }

  @GET
  @Path("/{id}/assets")
  @Operation(
      operationId = "getDomainAssets",
      summary = "Get assets for a domain",
      description = "Get paginated list of assets belonging to a domain.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of assets",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ResultList.class))),
        @ApiResponse(responseCode = "404", description = "Domain for instance {id} is not found")
      })
  public Response getAssets(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the domain", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description =
                  "Limit the number of results returned. Maximum of 1000 records will be returned in a single request.",
              schema = @Schema(type = "integer", defaultValue = "10"))
          @QueryParam("limit")
          @DefaultValue("10")
          @Min(1)
          @Max(1000)
          int limit,
      @Parameter(
              description = "Offset from which to start returning results",
              schema = @Schema(type = "integer", defaultValue = "0"))
          @QueryParam("offset")
          @DefaultValue("0")
          @Min(0)
          int offset) {
    return Response.ok(service.getDomainAssets(id, limit, offset)).build();
  }

  @GET
  @Path("/name/{fqn}/assets")
  @Operation(
      operationId = "getDomainAssetsByName",
      summary = "Get assets for a domain by name",
      description = "Get paginated list of assets belonging to a domain by domain name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of assets",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ResultList.class))),
        @ApiResponse(responseCode = "404", description = "Domain for instance {name} is not found")
      })
  public Response getAssetsByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the domain", schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(
              description =
                  "Limit the number of results returned. Maximum of 1000 records will be returned in a single request.",
              schema = @Schema(type = "integer", defaultValue = "10"))
          @QueryParam("limit")
          @DefaultValue("10")
          @Min(1)
          @Max(1000)
          int limit,
      @Parameter(
              description = "Offset from which to start returning results",
              schema = @Schema(type = "integer", defaultValue = "0"))
          @QueryParam("offset")
          @DefaultValue("0")
          @Min(0)
          int offset) {
    return Response.ok(service.getDomainAssetsByName(fqn, limit, offset)).build();
  }

  @GET
  @Path("/assets/counts")
  @Operation(
      operationId = "getAllDomainsWithAssetsCount",
      summary = "Get all domains with their asset counts",
      description =
          "Get a map of domain fully qualified names to their asset counts using search aggregation.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Map of domain FQN to asset count",
            content = @Content(mediaType = "application/json"))
      })
  public Response getAllDomainsWithAssetsCount(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    java.util.Map<String, Integer> result = service.getAllDomainsWithAssetsCount();
    return Response.ok(result).build();
  }
}
