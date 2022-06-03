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

package org.openmetadata.catalog.resources.types;

import static org.openmetadata.catalog.security.SecurityUtil.ADMIN;
import static org.openmetadata.catalog.security.SecurityUtil.BOT;
import static org.openmetadata.catalog.security.SecurityUtil.OWNER;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

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
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.CatalogApplicationConfig;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.CreateType;
import org.openmetadata.catalog.entity.Type;
import org.openmetadata.catalog.entity.type.CustomProperty;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.ListFilter;
import org.openmetadata.catalog.jdbi3.TypeRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.resources.EntityResource;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;

@Path("/v1/metadata/types")
@Api(value = "Types collection", tags = "metadata")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "types")
@Slf4j
public class TypeResource extends EntityResource<Type, TypeRepository> {
  public static final String COLLECTION_PATH = "v1/metadata/types/";

  @Override
  public Type addHref(UriInfo uriInfo, Type type) {
    listOrEmpty(type.getCustomProperties()).forEach(property -> Entity.withHref(uriInfo, property.getPropertyType()));
    return type;
  }

  @Inject
  public TypeResource(CollectionDAO dao, Authorizer authorizer) {
    super(Type.class, new TypeRepository(dao), authorizer);
  }

  @SuppressWarnings("unused") // Method used for reflection
  public void initialize(CatalogApplicationConfig config) throws IOException {
    // Find tag definitions and load tag categories from the json file, if necessary
    long now = System.currentTimeMillis();
    List<Type> types = JsonUtils.getTypes();
    types.forEach(
        type -> {
          type.withId(UUID.randomUUID()).withUpdatedBy("admin").withUpdatedAt(now);
          LOG.info("Loading type {}", type.getName());
          try {
            this.dao.createOrUpdate(null, type);
          } catch (IOException e) {
            LOG.error("Error loading type {}", type.getName(), e);
          }
        });
  }

  public static class TypeList extends ResultList<Type> {
    @SuppressWarnings("unused")
    TypeList() {
      // Empty constructor needed for deserialization
    }

    public TypeList(List<Type> data, String beforeCursor, String afterCursor, int total) {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  public static final String PROPERTIES = "customProperties";

  @GET
  @Valid
  @Operation(
      operationId = "listTypes",
      summary = "List types",
      tags = "metadata",
      description =
          "Get a list of types."
              + " Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of types",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = TypeList.class)))
      })
  public ResultList<Type> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Filter types by metadata type category.",
              schema = @Schema(type = "string", example = "Property, Entity"))
          @QueryParam("category")
          String categoryParam,
      @Parameter(description = "Limit the number types returned. (1 to 1000000, " + "default = 10)")
          @DefaultValue("10")
          @Min(0)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Returns list of types before this cursor", schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(description = "Returns list of types after this cursor", schema = @Schema(type = "string"))
          @QueryParam("after")
          String after)
      throws IOException {
    ListFilter filter = new ListFilter(Include.ALL).addQueryParam("category", categoryParam);
    return super.listInternal(uriInfo, securityContext, "", filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getTypeByID",
      summary = "Get a type",
      tags = "metadata",
      description = "Get a type by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The type",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Type.class))),
        @ApiResponse(responseCode = "404", description = "Type for instance {id} is not found")
      })
  public Type get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") String id,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = PROPERTIES))
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
  @Path("/name/{name}")
  @Operation(
      operationId = "getTypeByFQN",
      summary = "Get a type by name",
      tags = "metadata",
      description = "Get a type by name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The type",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Type.class))),
        @ApiResponse(responseCode = "404", description = "Type for instance {id} is not found")
      })
  public Type getByName(
      @Context UriInfo uriInfo,
      @PathParam("name") String name,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = PROPERTIES))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include)
      throws IOException {
    return getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllTypeVersion",
      summary = "List type versions",
      tags = "metadata",
      description = "Get a list of all the versions of a type identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of type versions",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "type Id", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException {
    return dao.listVersions(id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificTypeVersion",
      summary = "Get a version of the types",
      tags = "metadata",
      description = "Get a version of the type by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "types",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Type.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Type for instance {id} and version {version} is " + "not found")
      })
  public Type getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "type Id", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Parameter(
              description = "type version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return dao.getVersion(id, version);
  }

  @POST
  @Operation(
      operationId = "createType",
      summary = "Create a type",
      tags = "metadata",
      description = "Create a new type.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The type",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Type.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(@Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateType create)
      throws IOException {
    Type type = getType(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, type, ADMIN | BOT);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchType",
      summary = "Update a type",
      tags = "metadata",
      description = "Update an existing type using JsonPatch.",
      externalDocs = @ExternalDocumentation(description = "JsonPatch RFC", url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response updateDescription(
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
      throws IOException {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @PUT
  @Operation(
      summary = "Create or update a type",
      tags = "metadata",
      description = "Create a new type, if it does not exist or update an existing type.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The type",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Type.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreateType create) throws IOException {
    Type type = getType(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, type, ADMIN | BOT | OWNER);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteType",
      summary = "Delete a type",
      tags = "metadata",
      description = "Delete a type by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "type for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Type Id", schema = @Schema(type = "string")) @PathParam("id") String id)
      throws IOException {
    return delete(uriInfo, securityContext, id, false, true, ADMIN | BOT);
  }

  @PUT
  @Path("/{id}")
  @Operation(
      operationId = "addProperty",
      summary = "Add a Property to an entity",
      tags = "metadata",
      description =
          "Add a property to an entity type. Properties can only be added to entity type and not property type.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "type for instance {id} is not found")
      })
  public Response addProperty(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Type Id", schema = @Schema(type = "string")) @PathParam("id") String id,
      @Valid CustomProperty property)
      throws IOException {
    SecurityUtil.authorizeAdmin(authorizer, securityContext, ADMIN | BOT);
    PutResponse<Type> response =
        dao.addCustomProperty(uriInfo, securityContext.getUserPrincipal().getName(), id, property);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  private Type getType(CreateType create, String user) {
    return copy(new Type(), create, user)
        .withFullyQualifiedName(create.getName())
        .withCategory(create.getCategory())
        .withSchema(create.getSchema());
  }
}
