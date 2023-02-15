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

package org.openmetadata.service.resources.types;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;

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
import org.openmetadata.schema.api.CreateType;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.type.Category;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TypeRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil.PutResponse;
import org.openmetadata.service.util.ResultList;

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

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    // Load types defined in OpenMetadata schemas
    long now = System.currentTimeMillis();
    List<Type> types = JsonUtils.getTypes();
    types.forEach(
        type -> {
          type.withId(UUID.randomUUID()).withUpdatedBy(ADMIN_USER_NAME).withUpdatedAt(now);
          LOG.info("Loading type {}", type.getName());
          try {
            Fields fields = getFields("customProperties");
            try {
              Type storedType = dao.getByName(null, type.getName(), fields);
              type.setId(storedType.getId());
              // If entity type already exists, then carry forward custom properties
              if (storedType.getCategory().equals(Category.Entity)) {
                type.setCustomProperties(storedType.getCustomProperties());
              }
            } catch (Exception e) {
              LOG.debug("Creating entity that does not exist ", e);
            }
            this.dao.createOrUpdate(null, type);
            this.dao.addToRegistry(type);
          } catch (Exception e) {
            LOG.error("Error loading type {}", type.getName(), e);
          }
        });
  }

  public static class TypeList extends ResultList<Type> {
    @SuppressWarnings("unused")
    TypeList() {
      // Empty constructor needed for deserialization
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
      @Parameter(description = "Id of the type", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
      operationId = "getTypeByName",
      summary = "Get a type by name",
      tags = "metadata",
      description = "Get a type by name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The type",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = Type.class))),
        @ApiResponse(responseCode = "404", description = "Type for instance {name} is not found")
      })
  public Type getByName(
      @Context UriInfo uriInfo,
      @Parameter(description = "Name of the type", schema = @Schema(type = "string")) @PathParam("name") String name,
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
      @Parameter(description = "Id of the type", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return super.listVersionsInternal(securityContext, id);
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
      @Parameter(description = "Id of the type", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Parameter(
              description = "type version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version)
      throws IOException {
    return super.getVersionInternal(securityContext, id, version);
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
    return create(uriInfo, securityContext, type);
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
      @Parameter(description = "Id of the type", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
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
    return createOrUpdate(uriInfo, securityContext, type);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteType",
      summary = "Delete a type by id",
      tags = "metadata",
      description = "Delete a type by `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "type for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the type", schema = @Schema(type = "UUID")) @PathParam("id") UUID id)
      throws IOException {
    return delete(uriInfo, securityContext, id, false, true);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deleteTypeByName",
      summary = "Delete a type by name",
      tags = "metadata",
      description = "Delete a type by `name`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "type for instance {name} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the type", schema = @Schema(type = "string")) @PathParam("name") String name)
      throws IOException {
    return deleteByName(uriInfo, securityContext, name, false, true);
  }

  @PUT
  @Path("/{id}")
  @Operation(
      operationId = "addProperty",
      summary = "Add or update a Property to an entity",
      tags = "metadata",
      description =
          "Add or update a property to an entity type. "
              + "Properties can only be added to entity type and not property type.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "type for instance {id} is not found")
      })
  public Response addOrUpdateProperty(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the type", schema = @Schema(type = "UUID")) @PathParam("id") UUID id,
      @Valid CustomProperty property)
      throws IOException {
    // TODO fix this is the typeID correct? Why are we not doing this by name?
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.CREATE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    PutResponse<Type> response =
        dao.addCustomProperty(uriInfo, securityContext.getUserPrincipal().getName(), id, property);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  private Type getType(CreateType create, String user) throws IOException {
    return copy(new Type(), create, user)
        .withFullyQualifiedName(create.getName())
        .withCategory(create.getCategory())
        .withSchema(create.getSchema());
  }
}
