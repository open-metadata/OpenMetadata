/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.resources.governance;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
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
import jakarta.ws.rs.NotFoundException;
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
import org.openmetadata.schema.api.governance.CreateIntakeForm;
import org.openmetadata.schema.entity.governance.IntakeForm;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.IntakeFormRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;

@Slf4j
@Path("/v1/governance/intakeForms")
@Tag(
    name = "IntakeForms",
    description =
        "An IntakeForm declares additional required fields for a governance entity. Required fields "
            + "are enforced at the API layer, layered on top of the entity's schema-required fields.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "intakeForms", order = 5)
public class IntakeFormResource extends EntityResource<IntakeForm, IntakeFormRepository> {
  public static final String COLLECTION_PATH = "/v1/governance/intakeForms/";
  static final String FIELDS = "owners,requiredFields";
  private final IntakeFormMapper mapper = new IntakeFormMapper();

  public IntakeFormResource(Authorizer authorizer, Limits limits) {
    super(Entity.INTAKE_FORM, authorizer, limits);
  }

  @GET
  @Operation(
      operationId = "listIntakeForms",
      summary = "List IntakeForms",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Paginated list of IntakeForm",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = IntakeFormList.class)))
      })
  public ResultList<IntakeForm> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Limit the number of IntakeForms returned")
          @DefaultValue("10")
          @Min(0)
          @Max(1000000)
          @QueryParam("limit")
          int limitParam,
      @Parameter(description = "Offset for pagination") @QueryParam("before") String before,
      @Parameter(description = "Offset for pagination") @QueryParam("after") String after,
      @Parameter(description = "Include soft-deleted entities")
          @DefaultValue("non-deleted")
          @QueryParam("include")
          Include include) {
    return listInternal(
        uriInfo, securityContext, fieldsParam, new ListFilter(include), limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getIntakeFormByID",
      summary = "Get an IntakeForm by ID",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The IntakeForm",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = IntakeForm.class)))
      })
  public IntakeForm get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Include soft-deleted entities")
          @DefaultValue("non-deleted")
          @QueryParam("include")
          Include include) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include);
  }

  @GET
  @Path("/name/{name}")
  @Operation(
      operationId = "getIntakeFormByName",
      summary = "Get an IntakeForm by name",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The IntakeForm",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = IntakeForm.class)))
      })
  public IntakeForm getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("name") String name,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Include soft-deleted entities")
          @DefaultValue("non-deleted")
          @QueryParam("include")
          Include include) {
    return getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
  }

  @GET
  @Path("/entityType/{entityType}")
  @Operation(
      operationId = "getIntakeFormByEntityType",
      summary = "Get the IntakeForm configured for a specific entity type",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The IntakeForm for the entity type",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = IntakeForm.class))),
        @ApiResponse(responseCode = "404", description = "No IntakeForm configured")
      })
  public IntakeForm getByEntityType(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("entityType") String entityType) {
    IntakeForm form = repository.findEnabledForEntityType(entityType);
    if (form == null) {
      throw new NotFoundException(
          "No enabled IntakeForm configured for entity type '" + entityType + "'");
    }
    return form;
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listIntakeFormVersions",
      summary = "List versions of an IntakeForm",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Version history",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getIntakeFormVersion",
      summary = "Get a specific version of an IntakeForm",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The IntakeForm at the requested version",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = IntakeForm.class)))
      })
  public IntakeForm getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @PathParam("version") String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createIntakeForm",
      summary = "Create a new IntakeForm",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The created IntakeForm",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = IntakeForm.class)))
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateIntakeForm create) {
    authorizer.authorizeAdmin(securityContext);
    IntakeForm entity = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, entity);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateIntakeForm",
      summary = "Create or update an IntakeForm",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The created or updated IntakeForm",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = IntakeForm.class)))
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateIntakeForm create) {
    authorizer.authorizeAdmin(securityContext);
    IntakeForm entity = mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, entity);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchIntakeForm",
      summary = "Patch an IntakeForm",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The patched IntakeForm",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = IntakeForm.class)))
      })
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @PathParam("id") UUID id,
      @RequestBody(
              description = "JSON patch document",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @io.swagger.v3.oas.annotations.media.ExampleObject(
                            "[{\"op\":\"replace\",\"path\":\"/enabled\",\"value\":false}]")
                      }))
          JsonPatch patch) {
    authorizer.authorizeAdmin(securityContext);
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteIntakeForm",
      summary = "Delete an IntakeForm",
      responses = {
        @ApiResponse(responseCode = "200", description = "Deleted"),
        @ApiResponse(responseCode = "404", description = "Not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @DefaultValue("true") @QueryParam("hardDelete") boolean hardDelete,
      @PathParam("id") UUID id) {
    authorizer.authorizeAdmin(securityContext);
    return delete(uriInfo, securityContext, id, true, hardDelete);
  }

  public static class IntakeFormList extends ResultList<IntakeForm> {
    /* placeholder for swagger */
  }
}
