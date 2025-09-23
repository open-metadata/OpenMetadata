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

package org.openmetadata.service.resources.events;

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
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.events.CreateNotificationTemplate;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.NotificationTemplateRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;

@Slf4j
@Path("/v1/notificationTemplates")
@Tag(
    name = "Notification Templates",
    description = "Notification templates for customizing event notifications")
@Collection(name = "notificationTemplates")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class NotificationTemplateResource
    extends EntityResource<NotificationTemplate, NotificationTemplateRepository> {

  public static final String COLLECTION_PATH = "/v1/notificationTemplates";
  public static final String FIELDS = "";

  // Mapper for converting DTOs to entities
  private final NotificationTemplateMapper mapper = new NotificationTemplateMapper();

  public NotificationTemplateResource(Authorizer authorizer, Limits limits) {
    super(Entity.NOTIFICATION_TEMPLATE, authorizer, limits);
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("templateBody", MetadataOperation.VIEW_BASIC);
    return null;
  }

  public static class NotificationTemplateList extends ResultList<NotificationTemplate> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listNotificationTemplates",
      summary = "List notification templates",
      description = "Get a list of notification templates",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of notification templates",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = NotificationTemplateList.class)))
      })
  public ResultList<NotificationTemplate> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(
              description = "Filter templates by provider type (SYSTEM or USER)",
              schema = @Schema(implementation = ProviderType.class))
          @QueryParam("provider")
          ProviderType provider,
      @Parameter(description = "Limit the number of results. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(0)
          @Max(1000000)
          int limitParam,
      @Parameter(
              description = "Returns list of entities before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of entities after this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("after")
          String after,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ListFilter filter = new ListFilter(include);
    if (provider != null) {
      filter.addQueryParam("provider", provider.value());
    }
    return super.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getNotificationTemplateById",
      summary = "Get a notification template by Id",
      description = "Get a notification template by `Id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The notification template",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = NotificationTemplate.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Notification template for instance {id} is not found")
      })
  public NotificationTemplate get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the notification template", schema = @Schema(type = "UUID"))
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
  @Path("/name/{fqn}")
  @Operation(
      operationId = "getNotificationTemplateByFQN",
      summary = "Get a notification template by fully qualified name",
      description = "Get a notification template by `fullyQualifiedName`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The notification template",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = NotificationTemplate.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Notification template for instance {fqn} is not found")
      })
  public NotificationTemplate getByName(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Fully qualified name of the notification template",
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
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllNotificationTemplateVersions",
      summary = "List notification template versions",
      description = "Get a list of all the versions of a notification template identified by `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of notification template versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the notification template", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificNotificationTemplateVersion",
      summary = "Get a version of the notification template",
      description = "Get a version of the notification template by given `Id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "notification template",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = NotificationTemplate.class))),
        @ApiResponse(
            responseCode = "404",
            description =
                "Notification template for instance {id} and version {version} is not found")
      })
  public NotificationTemplate getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the notification template", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Notification template version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Operation(
      operationId = "createNotificationTemplate",
      summary = "Create a notification template",
      description = "Create a new notification template",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The notification template",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = NotificationTemplate.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateNotificationTemplate create) {
    NotificationTemplate template =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, template);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchNotificationTemplate",
      summary = "Update a notification template",
      description = "Update an existing notification template using JsonPatch.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully updated the notification template",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = NotificationTemplate.class))),
        @ApiResponse(responseCode = "400", description = "Bad request"),
        @ApiResponse(responseCode = "404", description = "Notification template not found")
      })
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the notification template", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject(
                            "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"new description\"}]")
                      }))
          JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch, ChangeSource.MANUAL);
  }

  @PATCH
  @Path("/name/{fqn}")
  @Operation(
      operationId = "patchNotificationTemplateByFQN",
      summary = "Update a notification template by name",
      description = "Update an existing notification template using JsonPatch.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully updated the notification template",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = NotificationTemplate.class))),
        @ApiResponse(responseCode = "400", description = "Bad request"),
        @ApiResponse(responseCode = "404", description = "Notification template not found")
      })
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the notification template",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject(
                            "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"new description\"}]")
                      }))
          JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, fqn, patch, ChangeSource.MANUAL);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateNotificationTemplate",
      summary = "Create or update a notification template",
      description =
          "Create a notification template, if it does not exist or update an existing notification template.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The notification template",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = NotificationTemplate.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateNotificationTemplate create) {
    NotificationTemplate template =
        mapper.createToEntity(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, template);
  }

  @DELETE
  @Path("/async/{id}")
  @Operation(
      operationId = "deleteNotificationTemplateAsync",
      summary = "Asynchronously delete a notification template by Id",
      description = "Asynchronously delete a notification template by `Id`.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Notification template for instance {id} is not found")
      })
  public Response deleteByIdAsync(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive,
      @Parameter(description = "Id of the notification template", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return deleteByIdAsync(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteNotificationTemplate",
      summary = "Delete a notification template by Id",
      description = "Delete a notification template by `Id`. System templates cannot be deleted.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "400",
            description = "Bad request - System templates cannot be deleted"),
        @ApiResponse(
            responseCode = "404",
            description = "Notification template for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the notification template", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete) {
    return super.delete(uriInfo, securityContext, id, recursive, hardDelete);
  }

  @DELETE
  @Path("/name/{fqn}")
  @Operation(
      operationId = "deleteNotificationTemplateByFQN",
      summary = "Delete a notification template by fully qualified name",
      description =
          "Delete a notification template by `fullyQualifiedName`. System templates cannot be deleted.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "400",
            description = "Bad request - System templates cannot be deleted"),
        @ApiResponse(
            responseCode = "404",
            description = "Notification template for instance {fqn} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the notification template",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn,
      @Parameter(
              description = "Recursively delete this entity and it's children. (Default `false`)")
          @QueryParam("recursive")
          @DefaultValue("false")
          boolean recursive,
      @Parameter(description = "Hard delete the entity. (Default = `false`)")
          @QueryParam("hardDelete")
          @DefaultValue("false")
          boolean hardDelete) {
    return deleteByName(uriInfo, securityContext, fqn, recursive, hardDelete);
  }

  @PUT
  @Path("/restore")
  @Operation(
      operationId = "restore",
      summary = "Restore a soft deleted notification template",
      description = "Restore a soft deleted notification template.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully restored the notification template")
      })
  public Response restoreEntity(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid RestoreEntity restore) {
    return restoreEntity(uriInfo, securityContext, restore.getId());
  }
}
