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
import org.openmetadata.catalog.api.data.CreateModel;
import org.openmetadata.catalog.entity.data.Model;
import org.openmetadata.catalog.jdbi3.ModelRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.CatalogAuthorizer;
import org.openmetadata.catalog.security.SecurityUtil;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityUtil;
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
import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Path("/v1/models")
@Api(value = "Models collection", tags = "Models collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "models", repositoryClass = "org.openmetadata.catalog.jdbi3.ModelRepository")
public class ModelResource {
  public static final String MODEL_COLLECTION_PATH = "v1/models/";
  private final ModelRepository dao;
  private final CatalogAuthorizer authorizer;

  public static void addHref(UriInfo uriInfo, EntityReference ref) {
    ref.withHref(RestUtil.getHref(uriInfo, MODEL_COLLECTION_PATH, ref.getId()));
  }

  public static List<Model> addHref(UriInfo uriInfo, List<Model> models) {
    Optional.ofNullable(models).orElse(Collections.emptyList()).forEach(i -> addHref(uriInfo, i));
    return models;
  }

  public static Model addHref(UriInfo uriInfo, Model model) {
    model.setHref(RestUtil.getHref(uriInfo, MODEL_COLLECTION_PATH, model.getId()));
    EntityUtil.addHref(uriInfo, model.getOwner());
    EntityUtil.addHref(uriInfo, model.getDashboard()); // Dashboard HREF
    EntityUtil.addHref(uriInfo, model.getFollowers());
    return model;
  }

  @Inject
  public ModelResource(ModelRepository dao, CatalogAuthorizer authorizer) {
    Objects.requireNonNull(dao, "ModelRepository must not be null");
    this.dao = dao;
    this.authorizer = authorizer;
  }

  public static class ModelList extends ResultList<Model> {
    @SuppressWarnings("unused")
    ModelList() {
      // Empty constructor needed for deserialization
    }

    public ModelList(List<Model> data, String beforeCursor, String afterCursor, int total)
            throws GeneralSecurityException, UnsupportedEncodingException {
      super(data, beforeCursor, afterCursor, total);
    }
  }

  static final String FIELDS = "owner,dashboard,algorithm,followers,tags,usageSummary";
  public static final List<String> FIELD_LIST = Arrays.asList(FIELDS.replaceAll(" ", "")
          .split(","));

  @GET
  @Valid
  @Operation(summary = "List Models", tags = "models",
          description = "Get a list of models. Use `fields` parameter to get only necessary fields. " +
                  " Use cursor-based pagination to limit the number " +
                  "entries in the list using `limit` and `before` or `after` query params.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "List of models",
                               content = @Content(mediaType = "application/json",
                                       schema = @Schema(implementation = ModelList.class)))
          })
  public ModelList list(@Context UriInfo uriInfo,
                                      @Context SecurityContext securityContext,
                                      @Parameter(description = "Fields requested in the returned resource",
                                              schema = @Schema(type = "string", example = FIELDS))
                                      @QueryParam("fields") String fieldsParam,
                                      @Parameter(description = "Limit the number models returned. (1 to 1000000, " +
                                              "default = 10)")
                                      @DefaultValue("10")
                                      @Min(1)
                                      @Max(1000000)
                                      @QueryParam("limit") int limitParam,
                                      @Parameter(description = "Returns list of models before this cursor",
                                              schema = @Schema(type = "string"))
                                      @QueryParam("before") String before,
                                      @Parameter(description = "Returns list of models after this cursor",
                                              schema = @Schema(type = "string"))
                                      @QueryParam("after") String after
  ) throws IOException, GeneralSecurityException {
    RestUtil.validateCursors(before, after);
    Fields fields = new Fields(FIELD_LIST, fieldsParam);

    ModelList models;
    if (before != null) { // Reverse paging
      models = dao.listBefore(fields, limitParam, before); // Ask for one extra entry
    } else { // Forward paging or first page
      models = dao.listAfter(fields, limitParam, after);
    }
    addHref(uriInfo, models.getData());
    return models;
  }

  @GET
  @Path("/{id}")
  @Operation(summary = "Get a model", tags = "models",
          description = "Get a model by `id`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The model",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = Model.class))),
                  @ApiResponse(responseCode = "404", description = "Model for instance {id} is not found")
          })
  public Model get(@Context UriInfo uriInfo,
                       @Context SecurityContext securityContext,
                       @PathParam("id") String id,
                       @Parameter(description = "Fields requested in the returned resource",
                               schema = @Schema(type = "string", example = FIELDS))
                       @QueryParam("fields") String fieldsParam) throws IOException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    return addHref(uriInfo, dao.get(id, fields));
  }

  @GET
  @Path("/name/{fqn}")
  @Operation(summary = "Get a model by name", tags = "models",
          description = "Get a model by fully qualified name.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The model",
                          content = @Content(mediaType = "application/json",
                                  schema = @Schema(implementation = Model.class))),
                  @ApiResponse(responseCode = "404", description = "Model for instance {id} is not found")
          })
  public Model getByName(@Context UriInfo uriInfo, @PathParam("fqn") String fqn,
                            @Context SecurityContext securityContext,
                            @Parameter(description = "Fields requested in the returned resource",
                                    schema = @Schema(type = "string", example = FIELDS))
                            @QueryParam("fields") String fieldsParam) throws IOException {
    Fields fields = new Fields(FIELD_LIST, fieldsParam);
    Model model = dao.getByName(fqn, fields);
    return addHref(uriInfo, model);
  }


  @POST
  @Operation(summary = "Create a model", tags = "models",
          description = "Create a new model.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The model",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = CreateModel.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response create(@Context UriInfo uriInfo, @Context SecurityContext securityContext,
                         @Valid CreateModel create) throws IOException {
    SecurityUtil.checkAdminOrBotRole(authorizer, securityContext);
    Model model = new Model().withId(UUID.randomUUID()).withName(create.getName())
            .withDisplayName(create.getDisplayName())
            .withDescription(create.getDescription())
            .withDashboard(create.getDashboard()) //ADDED
            .withAlgorithm(create.getAlgorithm()) //ADDED
            .withTags(create.getTags())
            .withOwner(create.getOwner())
            .withUpdatedBy(securityContext.getUserPrincipal().getName())
            .withUpdatedAt(new Date());
    model = addHref(uriInfo, dao.create(model));
    return Response.created(model.getHref()).entity(model).build();
  }

  @PATCH
  @Path("/{id}")
  @Operation(summary = "Update a model", tags = "models",
          description = "Update an existing model using JsonPatch.",
          externalDocs = @ExternalDocumentation(description = "JsonPatch RFC",
                  url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Model updateDescription(@Context UriInfo uriInfo,
                                     @Context SecurityContext securityContext,
                                     @PathParam("id") String id,
                                     @RequestBody(description = "JsonPatch with array of operations",
                                         content = @Content(mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                                                 examples = {@ExampleObject("[" +
                                                         "{op:remove, path:/a}," +
                                                         "{op:add, path: /b, value: val}" +
                                                         "]")}))
                                         JsonPatch patch) throws IOException {
    Fields fields = new Fields(FIELD_LIST, FIELDS);
    Model model = dao.get(id, fields);
    SecurityUtil.checkAdminRoleOrPermissions(authorizer, securityContext,
            dao.getOwnerReference(model));
    model = dao.patch(id, securityContext.getUserPrincipal().getName(), patch);
    return addHref(uriInfo, model);
  }

  @PUT
  @Operation(summary = "Create or update a model", tags = "models",
          description = "Create a new model, if it does not exist or update an existing model.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "The model",
                          content = @Content(mediaType = "application/json",
                          schema = @Schema(implementation = Model.class))),
                  @ApiResponse(responseCode = "400", description = "Bad request")
          })
  public Response createOrUpdate(@Context UriInfo uriInfo,
                                 @Context SecurityContext securityContext,
                                 @Valid CreateModel create) throws IOException {
    Model model = new Model().withId(UUID.randomUUID()).withName(create.getName())
            .withDisplayName(create.getDisplayName())
            .withDescription(create.getDescription())
            .withDashboard(create.getDashboard()) //ADDED
            .withAlgorithm(create.getAlgorithm()) //ADDED
            .withTags(create.getTags())
            .withOwner(create.getOwner())
            .withUpdatedBy(securityContext.getUserPrincipal().getName())
            .withUpdatedAt(new Date());

    PutResponse<Model> response = dao.createOrUpdate(model);
    model = addHref(uriInfo, response.getEntity());
    return Response.status(response.getStatus()).entity(model).build();
  }

  @PUT
  @Path("/{id}/followers")
  @Operation(summary = "Add a follower", tags = "models",
          description = "Add a user identified by `userId` as follower of this model",
          responses = {
                  @ApiResponse(responseCode = "200", description = "OK"),
                  @ApiResponse(responseCode = "404", description = "model for instance {id} is not found")
          })
  public Response addFollower(@Context UriInfo uriInfo,
                              @Context SecurityContext securityContext,
                              @Parameter(description = "Id of the model", schema = @Schema(type = "string"))
                              @PathParam("id") String id,
                              @Parameter(description = "Id of the user to be added as follower",
                                      schema = @Schema(type = "string"))
                                      String userId) throws IOException {
    Fields fields = new Fields(FIELD_LIST, "followers");
    Response.Status status = dao.addFollower(id, userId);
    Model model = dao.get(id, fields);
    return Response.status(status).entity(model).build();
  }

  @DELETE
  @Path("/{id}/followers/{userId}")
  @Operation(summary = "Remove a follower", tags = "model",
          description = "Remove the user identified `userId` as a follower of the model.")
  public Model deleteFollower(@Context UriInfo uriInfo,
                              @Context SecurityContext securityContext,
                              @Parameter(description = "Id of the model",
                                      schema = @Schema(type = "string"))
                              @PathParam("id") String id,
                              @Parameter(description = "Id of the user being removed as follower",
                                      schema = @Schema(type = "string"))
                              @PathParam("userId") String userId) throws IOException {
    Fields fields = new Fields(FIELD_LIST, "followers");
    dao.deleteFollower(id, userId);
    Model model = dao.get(id, fields);
    return addHref(uriInfo, model);
  }

  @DELETE
  @Path("/{id}")
  @Operation(summary = "Delete a Model", tags = "model",
          description = "Delete a model by `id`.",
          responses = {
                  @ApiResponse(responseCode = "200", description = "OK"),
                  @ApiResponse(responseCode = "404", description = "model for instance {id} is not found")
          })
  public Response delete(@Context UriInfo uriInfo, @PathParam("id") String id) {
    dao.delete(id);
    return Response.ok().build();
  }
}
