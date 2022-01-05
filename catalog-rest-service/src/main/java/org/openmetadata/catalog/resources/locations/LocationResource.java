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

package org.openmetadata.catalog.resources.locations;

import com.google.inject.Inject;
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
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.Objects;
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
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateLocation;
import org.openmetadata.catalog.entity.data.Location;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.LocationRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.RestUtil.PatchResponse;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;

@Path("/v1/locations")
@Api(value = "Locations collection", tags = "Locations collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "locations")
public class LocationResource {
  public static final String COLLECTION_PATH = "v1/locations/";
  private final LocationRepository dao;
  private final Authorizer authorizer;

  public static Location addHref(UriInfo uriInfo, Location location) {
    Entity.withHref(uriInfo, location.getOwner());
    Entity.withHref(uriInfo, location.getService());
    Entity.withHref(uriInfo, location.getFollowers());
    return location;
  }

  @Inject
  public LocationResource(CollectionDAO dao, Authorizer authorizer) {
    Objects.requireNonNull(dao, "LocationRepository must not be null");
    this.dao = new LocationRepository(dao);
    this.authorizer = authorizer;
  }

  public static class LocationList extends ResultList<Location> {
    @SuppressWarnings("unused") /* Required for tests */
    public LocationList() {}

    public LocationList(List<Location> data, String beforeCursor, String afterCursor, int total)
        throws GeneralSecurityException, UnsupportedEncodingException {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  static final String FIELDS = "owner,followers,tags";
  public static final List<String> FIELD_LIST = Arrays.asList(FIELDS.replace(" ", "").split(","));

  @GET
  @Operation(
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
      throws IOException, GeneralSecurityException, ParseException {
    RestUtil.validateCursors(before, after);
    Fields fields = new Fields(FIELD_LIST, fieldsParam);

    ResultList<Location> locations;
    if (before != null) { // Reverse paging
      locations = dao.listBefore(uriInfo, fields, serviceParam, limitParam, before); // Ask for one extra entry
    } else { // Forward paging or first page
      locations = dao.listAfter(uriInfo, fields, serviceParam, limitParam, after);
    }
    locations.getData().forEach(l -> addHref(uriInfo, l));
    return locations;
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
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
      @Parameter(description = "location Id", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException, ParseException {
    return dao.listVersions(id);
  }

  @GET
  @Path("/{id}")
  @Operation(
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
      @Parameter(description = "location Id", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam)
      throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    return addHref(uriInfo, dao.get(uriInfo, id, fields));
  }

  @GET
  @Path("prefixes/{fqn}")
  @Operation(
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
              description = "Fully qualified name of the location urlencoded " + "if needed",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit the number locations returned. " + "(1 to 1000000, default = 10)")
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
      throws IOException, GeneralSecurityException {
    RestUtil.validateCursors(before, after);
    Fields fields = new Fields(FIELD_LIST, fieldsParam);

    ResultList<Location> locations;
    if (before != null) { // Reverse paging
      locations = dao.listPrefixesBefore(fields, fqn, limitParam, before); // Ask for one extra entry
    } else { // Forward paging or first page
      locations = dao.listPrefixesAfter(fields, fqn, limitParam, after);
    }
    locations.getData().forEach(l -> addHref(uriInfo, l));
    return locations;
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(
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
          String fieldsParam)
      throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    return addHref(uriInfo, dao.getByName(uriInfo, fqn, fields));
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
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
      @Parameter(description = "location Id", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(
              description = "location version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException, ParseException {
    return dao.getVersion(id, version);
  }

  @POST
  @Operation(
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
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    Location location = getLocation(securityContext, create);
    location = addHref(uriInfo, dao.create(uriInfo, location));
    return Response.created(location.getHref()).entity(location).build();
  }

  @PUT
  @Operation(
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
      throws IOException, ParseException {
    Location location = getLocation(securityContext, create);
    SecurityUtil.checkAdminRoleOrPermissions(authorizer, securityContext, dao.getOwnerReference(location));
    PutResponse<Location> response = dao.createOrUpdate(uriInfo, validateNewLocation(location));
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      summary = "Update a location",
      tags = "locations",
      description = "Update an existing location using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") String id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[" + "{op:remove, path:/a}," + "{op:add, path: /b, value: val}" + "]")
                      }))
          JsonPatch patch)
      throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, FIELDS);
    Location location = dao.get(uriInfo, id, fields);
    SecurityUtil.checkAdminRoleOrPermissions(authorizer, securityContext, dao.getOwnerReference(location));
    PatchResponse<Location> response =
        dao.patch(uriInfo, UUID.fromString(id), securityContext.getUserPrincipal().getName(), patch);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  @DELETE
  @Path("/{id}")
  @Operation(
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
      @Parameter(description = "Id of the location", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    dao.delete(UUID.fromString(id), false);
    return Response.ok().build();
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(
      summary = "Add a follower",
      tags = "locations",
      description = "Add a user identified by `userId` as followed of this location",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Location for instance {id} is not found")
      })
  public Response addFollower(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the location", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(description = "Id of the user to be added as follower", schema = @Schema(type = "string"))
          String userId)
      throws IOException {
    return dao.addFollower(securityContext.getUserPrincipal().getName(), UUID.fromString(id), UUID.fromString(userId))
        .toResponse();
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(
      summary = "Remove a follower",
      tags = "locations",
      description = "Remove the user identified `userId` as a follower of the location.")
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
    location.setId(UUID.randomUUID());
    return location;
  }

  private Location getLocation(SecurityContext securityContext, CreateLocation create) {
    return new Location()
        .withId(UUID.randomUUID())
        .withName(create.getName())
        .withDescription(create.getDescription())
        .withService(create.getService())
        .withLocationType(create.getLocationType())
        .withTags(create.getTags())
        .withUpdatedBy(securityContext.getUserPrincipal().getName())
        .withOwner(create.getOwner())
        .withUpdatedAt(new Date());
  }
}
