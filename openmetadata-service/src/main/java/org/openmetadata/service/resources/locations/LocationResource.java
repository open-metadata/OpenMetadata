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

package org.openmetadata.service.resources.locations;

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
import java.util.UUID;
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
import org.openmetadata.schema.api.data.CreateLocation;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.data.Location;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.LocationRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Path("/v1/locations")
@Api(value = "Locations collection", tags = "Locations collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "locations")
public class LocationResource extends EntityResource<Location, LocationRepository> {
  public static final String COLLECTION_PATH = "v1/locations/";

  @Override
  public Location addHref(UriInfo uriInfo, Location location) {
    Entity.withHref(uriInfo, location.getOwner());
    Entity.withHref(uriInfo, location.getService());
    Entity.withHref(uriInfo, location.getFollowers());
    return location;
  }

  public LocationResource(CollectionDAO dao, Authorizer authorizer) {
    super(Location.class, new LocationRepository(dao), authorizer);
  }

  public static class LocationList extends ResultList<Location> {
    @SuppressWarnings("unused") /* Required for tests */
    public LocationList() {}
  }

  static final String FIELDS = "owner,followers,tags,path";

  @GET
  @Operation(
      operationId = "listLocations",
      summary = "List locations",
      tags = "locations",
      description =
          "Get a list of locations, optionally filtered by `service` it belongs to. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of locations",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = LocationList.class)))
      })
  public ResultList<Location> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Filter locations by prefix of the FQN",
              schema = @Schema(type = "string", example = "s3://bucket/folder1"))
          @QueryParam("service")
          String serviceParam,
      @Parameter(description = "Limit the number locations returned. " + "(1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(0)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Returns list of locations before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of locations after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    ListFilter filter = new ListFilter(include).addQueryParam("service", serviceParam);
    return super.listInternal(uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllLocationVersion",
      summary = "List location versions",
      tags = "locations",
      description = "Get a list of all the versions of a location identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of location versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "location Id", schema = @Schema(type = "string")) @PathParam("id") UUID id)
      throws IOException {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getLocationByID",
      summary = "Get a location",
      tags = "locations",
      description = "Get a location by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The location",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Location.class))),
        @ApiResponse(responseCode = "404", description = "Location for instance {id} is not found")
      })
  public Location get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "location Id", schema = @Schema(type = "string")) @PathParam("id") UUID id,
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
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("prefixes/{fqn}")
  @Operation(
      operationId = "listLocationPrefixes",
      summary = "List locations that are prefixes",
      tags = "locations",
      description =
          "Get a list of locations. Use `fields` parameter to get only necessary fields. "
              + "Use cursor-based pagination to limit the number entries in the list using `limit` and `before` "
              + "or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of ancestor locations",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = LocationList.class)))
      })
  public ResultList<Location> listPrefixes(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the location urlencoded if needed",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit the number locations returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(1)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Returns list of locations before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of locations after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after)
      throws IOException {
    RestUtil.validateCursors(before, after);
    Fields fields = getFields(fieldsParam);

    ResultList<Location> locations;
    if (before != null) { // Reverse paging
      locations = dao.listPrefixesBefore(fields, fqn, limitParam, before); // Ask for one extra entry
    } else { // Forward paging or first page
      locations = dao.listPrefixesAfter(fields, fqn, limitParam, after);
    }
    return addHref(uriInfo, locations);
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getLocationByFQN",
      summary = "Get a location by name",
      tags = "locations",
      description = "Get a location by fully qualified name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The location",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Location.class))),
        @ApiResponse(responseCode = "404", description = "Location for instance {id} is not found")
      })
  public Location getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the location urlencoded if needed",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
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
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include);
  }

  @GET
  @Path("/association/{id}")
  @Operation(
      operationId = "getEntityByLocation",
      summary = "Get a table associated with location",
      tags = "locations",
      description = "Get a table associated with location by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "location",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Location.class))),
        @ApiResponse(responseCode = "404", description = "Location for instance {id} is not found")
      })
  public List<EntityReference> getTableFromLocation(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "location Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return dao.getEntityDetails(id.toString());
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificLocationVersion",
      summary = "Get a version of the location",
      tags = "locations",
      description = "Get a version of the location by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "location",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Location.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Location for instance {id} and version " + "{version} is not found")
      })
  public Location getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "location Id", schema = @Schema(type = "string")) @PathParam("id") UUID id,
      @Parameter(
              description = "location version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createLocation",
      summary = "Create a location",
      tags = "locations",
      description = "Create a location under an existing `service`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The location",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Location.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateLocation create)
      throws IOException {
    Location location = getLocation(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, location);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateLocation",
      summary = "Create or update location",
      tags = "locations",
      description = "Create a location, it it does not exist or update an existing location.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The updated location ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Location.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateLocation create)
      throws IOException {
    Location location = getLocation(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, location);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchLocation",
      summary = "Update a location",
      tags = "locations",
      description = "Update an existing location using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
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
      operationId = "deleteLocation",
      summary = "Delete a location",
      tags = "locations",
      description = "Delete a location by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Location for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(description = "Location Id", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, false, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted location.",
      tags = "locations",
      description = "Restore a soft deleted location.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the Location ",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Location.class)))
      })
  public Response restoreLocation(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid RestoreEntity restore)
      throws IOException {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      operationId = "addFollower",
      summary = "Add a follower",
      tags = "locations",
      description = "Add a user identified by `userId` as followed of this location",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = ChangeEvent.class))),
        @ApiResponse(responseCode = "404", description = "Location for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the location", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(description = "Id of the user to be added as follower", schema = @Schema(type = "UUID")) UUID userId)
      throws IOException {
    return dao.addFollower(securityContext.getUserPrincipal().getName(), id, userId).toResponse();
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(
      operationId = "deleteFollower",
      summary = "Remove a follower",
      tags = "locations",
      description = "Remove the user identified `userId` as a follower of the location.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "OK",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = ChangeEvent.class))),
      })
  public Response deleteFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the location", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(description = "Id of the user being removed as follower", schema = @Schema(type = "string"))
          @PathParam("userId")
          String userId)
      throws IOException {
    return dao.deleteFollower(
            securityContext.getUserPrincipal().getName(), UUID.fromString(id), UUID.fromString(userId))
        .toResponse();
  }

  public static Location validateNewLocation(Location location) {
    return location.withId(UUID.randomUUID());
  }

  private Location getLocation(CreateLocation create, String user) throws IOException {
    return copy(new Location(), create, user)
        .withPath(create.getPath())
        .withService(create.getService())
        .withLocationType(create.getLocationType())
        .withTags(create.getTags());
  }
}
