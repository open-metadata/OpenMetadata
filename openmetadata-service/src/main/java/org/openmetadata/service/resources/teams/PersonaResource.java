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

package org.openmetadata.service.resources.teams;

import static org.openmetadata.common.utils.CommonUtil.listOf;

import io.dropwizard.jersey.PATCH;
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
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.teams.CreatePersona;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.PersonaRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/personas")
@Tag(
    name = "Personas",
    description =
        "A `Persona` is to represent job function a user does. "
            + " OpenMetadata uses Persona to define customizable experience in the UI.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "personas", order = 2)
public class PersonaResource extends EntityResource<Persona, PersonaRepository> {
  private final PersonaMapper mapper = new PersonaMapper();
  public static final String COLLECTION_PATH = "/v1/personas";
  static final String FIELDS = "users";

  @Override
  public Persona addHref(UriInfo uriInfo, Persona persona) {
    super.addHref(uriInfo, persona);
    Entity.withHref(uriInfo, persona.getUsers());
    return persona;
  }

  public PersonaResource(Authorizer authorizer, Limits limits) {
    super(Entity.PERSONA, authorizer, limits);
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation(FIELDS, MetadataOperation.VIEW_BASIC);
    return listOf(MetadataOperation.EDIT_ALL);
  }

  public static class PersonaList extends ResultList<Persona> {
    /* Required for serde */
  }

  @GET
  @Valid
  @Operation(
      operationId = "listPersonas",
      summary = "List personas",
      description =
          "Get a list of personas. Use `fields` "
              + "parameter to get only necessary fields. Use cursor-based pagination to limit the number "
              + "entries in the list using `limit` and `before` or `after` query params.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of personas",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = PersonaList.class)))
      })
  public ResultList<Persona> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Limit the number of personas returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @Min(value = 0, message = "must be greater than or equal to 0")
          @Max(value = 1000000, message = "must be less than or equal to 1000000")
          @QueryParam("limit")
          int limitParam,
      @Parameter(
              description = "Returns list of personas before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of personas after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after) {
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, new ListFilter(null), limitParam, before, after);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllPersonaVersion",
      summary = "List Persona versions",
      description = "Get a list of all the versions of a persona identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of persona versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Persona", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Valid
  @Path("/{id}")
  @Operation(
      operationId = "getPersonaByID",
      summary = "Get a persona by id",
      description = "Get a persona by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Persona",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Persona.class))),
        @ApiResponse(responseCode = "404", description = "Persona for instance {id} is not found")
      })
  public Persona get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Persona", schema = @Schema(type = "UUID"))
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
  @Valid
  @Path("/name/{name}")
  @Operation(
      operationId = "getPersonaByFQN",
      summary = "Get a Persona by name",
      description = "Get a Persona by `name`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Persona",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Persona.class))),
        @ApiResponse(responseCode = "404", description = "Persona for instance {name} is not found")
      })
  public Persona getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Persona", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
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
    return getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificPersonaVersion",
      summary = "Get a version of the Persona",
      description = "Get a version of the Persona by given `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Persona",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Persona.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Persona for instance {id} and version {version} is not found")
      })
  public Persona getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Persona", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Personas version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createPersona",
      summary = "Create a Persona",
      description = "Create a new Persona.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Persona.",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Persona.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreatePersona cp) {
    authorizer.authorizeAdmin(securityContext);
    Persona persona = mapper.createToEntity(cp, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, persona);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdatePersona",
      summary = "Update Persona",
      description = "Create or Update a Persona.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The Persona.",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Persona.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid CreatePersona cp) {
    authorizer.authorizeAdmin(securityContext);
    Persona persona = mapper.createToEntity(cp, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, persona);
  }

  @PATCH
  @Path("/{id}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(
      operationId = "patchPersona",
      summary = "Update a Persona",
      description = "Update an existing persona with JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Persona", schema = @Schema(type = "UUID"))
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
    authorizer.authorizeAdmin(securityContext);
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @PATCH
  @Path("/name/{fqn}")
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  @Operation(
      operationId = "patchPersona",
      summary = "Update a Persona using name.",
      description = "Update an existing persona with JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Persona", schema = @Schema(type = "string"))
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
    authorizer.authorizeAdmin(securityContext);
    return patchInternal(uriInfo, securityContext, fqn, patch);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deletePersona",
      summary = "Delete a Persona by id",
      description = "Delete a Persona by given `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Persona for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Persona", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    authorizer.authorizeAdmin(securityContext);
    return delete(uriInfo, securityContext, id, false, true);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deletePersonaAsync",
      summary = "Asynchronously delete a Persona by id",
      description = "Asynchronously delete a Persona by given `id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Persona for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the Persona", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    authorizer.authorizeAdmin(securityContext);
    return deleteByIdAsync(uriInfo, securityContext, id, false, true);
  }

  @DELETE
  @Path("/name/{name}")
  @Operation(
      operationId = "deletePersonaByName",
      summary = "Delete a Persona by name",
      description = "Delete a Persona by given `name`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(responseCode = "404", description = "Persona for instance {name} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the Persona", schema = @Schema(type = "string"))
          @PathParam("name")
          String name) {
    authorizer.authorizeAdmin(securityContext);
    return deleteByName(uriInfo, securityContext, name, false, true);
  }
}
