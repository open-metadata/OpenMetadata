/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.resources.models;

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
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateModel;
import org.openmetadata.catalog.api.data.CreateTable;
import org.openmetadata.catalog.entity.data.Model;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.ModelRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.resources.databases.DatabaseUtil;
import org.openmetadata.catalog.security.CatalogAuthorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;

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
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Path("/v1/models")
@Api(value = "Models collection", tags = "Models collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "models")
public class ModelResource {
  public static final String COLLECTION_PATH = "v1/models/";
  private final ModelRepository dao;
  private final CatalogAuthorizer authorizer;

  public static Model addHref(UriInfo uriInfo, Model model) {
    Entity.withHref(uriInfo, model.getDatabase());
    Entity.withHref(uriInfo, model.getOwner());
    Entity.withHref(uriInfo, model.getFollowers());
    return model;
  }

  @Inject
  public ModelResource(CollectionDAO dao, CatalogAuthorizer authorizer) {
    Objects.requireNonNull(dao, "CollectionDAO must not be null");
    this.dao = new ModelRepository(dao);
    this.authorizer = authorizer;
  }

  public static class ModelList extends ResultList<Model> {
    @SuppressWarnings("unused") /* Required for tests */
    public ModelList() {}

    public ModelList(List<Model> data, String beforeCursor, String afterCursor, int total)
            throws GeneralSecurityException, UnsupportedEncodingException {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  static final String FIELDS = "columns,owner,database,tags,followers,viewDefinition";
  public static final List<String> FIELD_LIST = Arrays.asList(FIELDS.replaceAll(" ", "")
          .split(","));

  @GET
  @Operation(summary = "List Models", tags = "models",
          description = "Get a list of models, optionally filtered by `database` it belongs to. Use `fields` " +
                  "parameter to get only necessary fields. Use cursor-based pagination to limit the number " +
                  "entries in the list using `limit` and `before` or `after` query params.",
          responses = {@ApiResponse(responseCode = "200", description = "List of models",
                  content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = ModelList.class)))
          })
  public ResultList<Model> list(@Context UriInfo uriInfo,
                                @Context SecurityContext securityContext,
                                @Parameter(description = "Fields requested in the returned resource",
                                schema = @Schema(type = "string", example = FIELDS))
                        @QueryParam("fields") String fieldsParam,
                                @Parameter(description = "Filter models by database fully qualified name",
                                schema = @Schema(type = "string", example = "snowflakeWestCoast.financeDB"))
                        @QueryParam("database") String databaseParam,
                                @Parameter(description = "Limit the number tables returned. (1 to 1000000, default = 10) ",
                                schema = @Schema(type = "string", example = "snowflakeWestCoast.financeDB"))
                        @DefaultValue("10")
                        @Min(1)
                        @Max(1000000)
                        @QueryParam("limit") int limitParam,
                                @Parameter(description = "Returns list of models before this cursor",
                                schema = @Schema(type = "string"))
                        @QueryParam("before") String before,
                                @Parameter(description = "Returns list of models after this cursor",
                                schema = @Schema(type = "string"))
                        @QueryParam("after") String after)
          throws IOException, ParseException, GeneralSecurityException {
    RestUtil.validateCursors(before, after);
    Fields fields = new Fields(FIELD_LIST, fieldsParam);

    ResultList<Model> models;
    if (before != null) { // Reverse paging
      models = dao.listBefore(uriInfo, fields, databaseParam, limitParam, before);
    } else { // Forward paging or first page
      models = dao.listAfter(uriInfo, fields, databaseParam, limitParam, after);
    }
    models.getData().forEach(m -> addHref(uriInfo, m));
    return models;
  }

  @GET
  @Path("/{id}/versions")
  @Operation(summary = "List model versions", tags = "models",
          description = "Get a list of all the versions of a model identified by `id`",
          responses = {@ApiResponse(responseCode = "200", description = "List of model versions",
                      content = @Content(mediaType = "application/json",
                      schema = @Schema(implementation = EntityHistory.class)))
          })
  public EntityHistory listVersions(@Context UriInfo uriInfo,
                                    @Context SecurityContext securityContext,
                                    @Parameter(description = "table Id", schema = @Schema(type = "string"))
                                    @PathParam("id") String id)
          throws IOException, ParseException, GeneralSecurityException {
    return dao.listVersions(id);
  }

  @GET
  @Path("/{id}")
  @Operation(summary = "Get a model", tags = "models",
          description = "Get a model by `id`",
          responses = {@ApiResponse(responseCode = "200", description = "model",
                       content = @Content(mediaType = "application/json",
                       schema = @Schema(implementation = Model.class))),
                       @ApiResponse(responseCode = "404", description = "Model for instance {id} is not found")
          })
  public Model get(@Context UriInfo uriInfo,
                   @Context SecurityContext securityContext,
                   @Parameter(description = "model Id", schema = @Schema(type = "string"))
                   @PathParam("id") String id,
                   @Parameter(description = "Fields requested in the returned resource",
                           schema = @Schema(type = "string", example = FIELDS))
                   @QueryParam("fields") String fieldsParam) throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    return addHref(uriInfo, dao.get(uriInfo, id, fields));
  }
  
  @GET
  @Path("/name/{fqn}")
  @Operation(summary = "Get a model by name", tags = "models",
          description = "Get a model by fully qualified model name.",
          responses = {@ApiResponse(responseCode = "200", description = "model",
                       content = @Content(mediaType = "application/json",
                       schema = @Schema(implementation = Model.class))),
                       @ApiResponse(responseCode = "404", description = "Model for instance {id} is not found")
          })
  public Model getByName(@Context UriInfo uriInfo,
                         @Context SecurityContext securityContext,
                         @Parameter(description = "Fully qualified name of the model",
                                    schema = @Schema(type = "string"))
                         @PathParam("fqn") String fqn,
                         @Parameter(description = "Fields requested in the returned resource",
                                    schema = @Schema(type = "string", example = FIELDS))
                         @QueryParam("fields") String fieldsParam) throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    return addHref(uriInfo, dao.getByName(uriInfo, fqn, fields));
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(summary = "Get a version of the table", tags = "tables",
          description = "Get a version of the table by given `id`",
          responses = {@ApiResponse(responseCode = "200", description = "table",
                       content = @Content(mediaType = "application/json",
                       schema = @Schema(implementation = Model.class))),
                       @ApiResponse(responseCode = "404", description = "Table for instance {id} and version {version}"+
                          " is not found")
          })
  public Model getVersion(@Context UriInfo uriInfo,
                          @Context SecurityContext securityContext,
                          @Parameter(description = "table Id", schema = @Schema(type = "string"))
                          @PathParam("id") String id,
                          @Parameter(description = "table version number in the form `major`.`minor`",
                                  schema = @Schema(type = "string", example = "0.1 or 1.1"))
                          @PathParam("version") String version) throws IOException, ParseException {
    return dao.getVersion(id, version);
  }

  @POST
  @Operation(summary = "Create a Model", tags = "models",
          description = "Create a new model under an existing `database`.",
          responses = {@ApiResponse(responseCode = "200", description = "table",
                       content = @Content(mediaType = "application/json",
                       schema = @Schema(implementation = CreateModel.class))),
                       @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response create(@Context UriInfo uriInfo,
                         @Context SecurityContext securityContext,
                         @Valid CreateModel create) throws IOException, ParseException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    Model model = getModel(securityContext, create);
    model = addHref(uriInfo, dao.create(uriInfo, validateNewModel(model)));
    return Response.created(model.getHref()).entity(model).build();
  }

  @PUT
  @Operation(summary = "Create or update a table", tags = "tables",
          description = "Create a table, if it does not exist. If a table already exists, update the table.",
          responses = {@ApiResponse(responseCode = "200", description = "The table",
                       content = @Content(mediaType = "application/json",
                       schema = @Schema(implementation = CreateTable.class))),
                       @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response createOrUpdate(@Context UriInfo uriInfo,
                                 @Context SecurityContext securityContext,
                                 @Valid CreateModel create) throws IOException, ParseException {
    Model model = getModel(securityContext, create);
    SecurityUtil.checkAdminRoleOrPermissions(authorizer, securityContext, dao.getOwnerReference(model));
    PutResponse<Model> response = dao.createOrUpdate(uriInfo, validateNewModel(model));
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  @PATCH
  @Path("/{id}")
  @Operation(summary = "Update a model", tags = "models",
          description = "Update an existing model using JsonPatch.",
          externalDocs = @ExternalDocumentation(description = "JsonPatch RFC",
                  url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(@Context UriInfo uriInfo,
                     @Context SecurityContext securityContext,
                     @Parameter(description = "Id of the model", schema = @Schema(type = "string"))
                     @PathParam("id") String id,
                     @RequestBody(description = "JsonPatch with array of operations",
                             content = @Content(mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                                     examples = {@ExampleObject("[" +
                                             "{op:remove, path:/a}," +
                                             "{op:add, path: /b, value: val}" +
                                             "]")}))
                             JsonPatch patch) throws IOException, ParseException {
    Fields fields = new Fields(FIELD_LIST, FIELDS);
    Model model = dao.get(uriInfo, id, fields);
    SecurityUtil.checkAdminRoleOrPermissions(authorizer, securityContext, dao.getOwnerReference(model));
    RestUtil.PatchResponse<Model> response =
            dao.patch(uriInfo, UUID.fromString(id), securityContext.getUserPrincipal().getName(), patch);
    addHref(uriInfo, response.getEntity());
    return response.toResponse();
  }

  @DELETE
  @Path("/{id}")
  @Operation(summary = "Delete a model", tags = "models",
          description = "Delete a model by `id`. Model is not immediately deleted and is only marked as deleted.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "OK"),
                  @ApiResponse(responseCode = "404", description = "Model for instance {id} is not found")
          })
  public Response delete(@Context UriInfo uriInfo,
                         @Context SecurityContext securityContext,
                         @Parameter(description = "Id of the Model", schema = @Schema(type = "string"))
                         @PathParam("id") String id) {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    dao.delete(UUID.fromString(id));
    return Response.ok().build();
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(summary = "Add a follower", tags = "models",
          description = "Add a user identified by `userId` as followed of this model",
          responses = {
                  @ApiResponse(responseCode = "200", description = "OK"),
                  @ApiResponse(responseCode = "404", description = "Model for instance {id} is not found")
          })
  public Response addFollower(@Context UriInfo uriInfo,
                              @Context SecurityContext securityContext,
                              @Parameter(description = "Id of the model", schema = @Schema(type = "string"))
                              @PathParam("id") String id,
                              @Parameter(description = "Id of the user to be added as follower",
                                      schema = @Schema(type = "string"))
                                      String userId) throws IOException, ParseException {
    return dao.addFollower(securityContext.getUserPrincipal().getName(),
            UUID.fromString(id), UUID.fromString(userId)).toResponse();
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(summary = "Remove a follower", tags = "models",
          description = "Remove the user identified `userId` as a follower of the model.")
  public Response deleteFollower(@Context UriInfo uriInfo,
                                 @Context SecurityContext securityContext,
                                 @Parameter(description = "Id of the model",
                                         schema = @Schema(type = "string"))
                                 @PathParam("id") String id,
                                 @Parameter(description = "Id of the user being removed as follower",
                                         schema = @Schema(type = "string"))
                                 @PathParam("userId") String userId) throws IOException, ParseException {
    return dao.deleteFollower(securityContext.getUserPrincipal().getName(), UUID.fromString(id),
            UUID.fromString(userId)).toResponse();
  }

  public static Model validateNewModel(Model model) {
    model.setId(UUID.randomUUID());
    DatabaseUtil.validateColumns(model);
    return model;
  }

  private Model getModel(SecurityContext securityContext, CreateModel create) {
    return new Model().withId(UUID.randomUUID()).withName(create.getName())
            .withColumns(create.getColumns()).withDescription(create.getDescription())
            .withNodeType(create.getNodeType())
            .withTags(create.getTags()).withViewDefinition(create.getViewDefinition())
            .withUpdatedBy(securityContext.getUserPrincipal().getName())
            .withOwner(create.getOwner())
            .withUpdatedAt(new Date())
            .withDatabase(new EntityReference().withId(create.getDatabase()));
  }
}
