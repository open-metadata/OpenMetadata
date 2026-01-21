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
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.events.CreateNotificationTemplate;
import org.openmetadata.schema.api.events.NotificationTemplateRenderRequest;
import org.openmetadata.schema.api.events.NotificationTemplateRenderResponse;
import org.openmetadata.schema.api.events.NotificationTemplateSendRequest;
import org.openmetadata.schema.api.events.NotificationTemplateValidationRequest;
import org.openmetadata.schema.api.events.NotificationTemplateValidationResponse;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.NotificationTemplateRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperMetadata;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.AuthRequest;
import org.openmetadata.service.security.AuthorizationLogic;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.RestUtil;

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

  private final NotificationTemplateMapper mapper = new NotificationTemplateMapper();

  public NotificationTemplateResource(Authorizer authorizer, Limits limits) {
    super(Entity.NOTIFICATION_TEMPLATE, authorizer, limits);
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("templateBody", MetadataOperation.VIEW_BASIC);
    return List.of(MetadataOperation.EDIT_USER_NOTIFICATION_TEMPLATE);
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    // Load notification template seed data on startup with versioning support
    repository.initOrUpdateSeedDataFromResources();
    LOG.info("Notification template seed data initialized with versioning support");
  }

  public static class NotificationTemplateList extends ResultList<NotificationTemplate> {
    /* Required for serde */
  }

  /** Helper to build AuthRequest list based on provider type for patch operations. */
  private List<AuthRequest> buildEditAuthRequests(
      ProviderType providerType, ResourceContextInterface ctx) {
    if (ProviderType.SYSTEM.equals(providerType)) {
      // SYSTEM templates require EDIT_ALL
      return List.of(
          new AuthRequest(new OperationContext(entityType, MetadataOperation.EDIT_ALL), ctx));
    }
    // USER templates require EDIT_ALL OR EDIT_USER_NOTIFICATION_TEMPLATE
    return List.of(
        new AuthRequest(new OperationContext(entityType, MetadataOperation.EDIT_ALL), ctx),
        new AuthRequest(
            new OperationContext(entityType, MetadataOperation.EDIT_USER_NOTIFICATION_TEMPLATE),
            ctx));
  }

  /**
   * Tooling endpoints (/validate, /render, /send): allow EITHER CREATE OR any EDIT flavor.
   * Note: No provider discrimination needed here per requirements.
   */
  private void authorizePreviewCapability(SecurityContext securityContext) {
    List<AuthRequest> anyOf =
        List.of(
            new AuthRequest(
                new OperationContext(entityType, MetadataOperation.CREATE), getResourceContext()),
            new AuthRequest(
                new OperationContext(entityType, MetadataOperation.EDIT_ALL), getResourceContext()),
            new AuthRequest(
                new OperationContext(entityType, MetadataOperation.EDIT_USER_NOTIFICATION_TEMPLATE),
                getResourceContext()));
    authorizer.authorizeRequests(securityContext, anyOf, AuthorizationLogic.ANY);
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
          Include include,
      @Parameter(
              description =
                  "Per-relation include control. Format: field:value,field2:value2. "
                      + "Example: owners:non-deleted,followers:all. "
                      + "Valid values: all, deleted, non-deleted. "
                      + "If not specified for a field, uses the entity's include value.",
              schema = @Schema(type = "string", example = "owners:non-deleted,followers:all"))
          @QueryParam("includeRelations")
          String includeRelations) {
    return getInternal(uriInfo, securityContext, id, fieldsParam, include, includeRelations);
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
          Include include,
      @Parameter(
              description =
                  "Per-relation include control. Format: field:value,field2:value2. "
                      + "Example: owners:non-deleted,followers:all. "
                      + "Valid values: all, deleted, non-deleted. "
                      + "If not specified for a field, uses the entity's include value.",
              schema = @Schema(type = "string", example = "owners:non-deleted,followers:all"))
          @QueryParam("includeRelations")
          String includeRelations) {
    return getByNameInternal(uriInfo, securityContext, fqn, fieldsParam, include, includeRelations);
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
        @ApiResponse(
            responseCode = "403",
            description =
                "Forbidden - Requires appropriate permissions for USER or SYSTEM templates"),
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
    NotificationTemplate existing = repository.get(null, id, repository.getFields("*"));

    if (!isTemplateFieldPatch(patch)) {
      return patchInternal(uriInfo, securityContext, id, patch, ChangeSource.MANUAL);
    }

    ResourceContext<NotificationTemplate> ctx = getResourceContextById(id);
    boolean isSystem = ProviderType.SYSTEM.equals(existing.getProvider());

    List<AuthRequest> authRequests =
        isSystem
            ? List.of(
                new AuthRequest(new OperationContext(entityType, MetadataOperation.EDIT_ALL), ctx))
            : List.of(
                new AuthRequest(new OperationContext(entityType, MetadataOperation.EDIT_ALL), ctx),
                new AuthRequest(
                    new OperationContext(
                        entityType, MetadataOperation.EDIT_USER_NOTIFICATION_TEMPLATE),
                    ctx));

    AuthorizationLogic logic = isSystem ? AuthorizationLogic.ALL : AuthorizationLogic.ANY;
    return patchInternal(uriInfo, securityContext, authRequests, logic, id, patch);
  }

  private boolean isTemplateFieldPatch(JsonPatch patch) {
    return patch.toJsonArray().stream()
        .anyMatch(
            op -> {
              String path = op.asJsonObject().getString("path", "");
              return path.equals("/templateBody") || path.equals("/templateSubject");
            });
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
        @ApiResponse(
            responseCode = "403",
            description =
                "Forbidden - Requires appropriate permissions for USER or SYSTEM templates"),
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
    NotificationTemplate existing = repository.getByName(null, fqn, repository.getFields("*"));

    if (!isTemplateFieldPatch(patch)) {
      return patchInternal(uriInfo, securityContext, existing.getId(), patch, ChangeSource.MANUAL);
    }

    ResourceContext<NotificationTemplate> ctx = getResourceContextByName(fqn);
    boolean isSystem = ProviderType.SYSTEM.equals(existing.getProvider());

    List<AuthRequest> authRequests =
        isSystem
            ? List.of(
                new AuthRequest(new OperationContext(entityType, MetadataOperation.EDIT_ALL), ctx))
            : List.of(
                new AuthRequest(new OperationContext(entityType, MetadataOperation.EDIT_ALL), ctx),
                new AuthRequest(
                    new OperationContext(
                        entityType, MetadataOperation.EDIT_USER_NOTIFICATION_TEMPLATE),
                    ctx));

    AuthorizationLogic logic = isSystem ? AuthorizationLogic.ALL : AuthorizationLogic.ANY;
    return patchInternal(uriInfo, securityContext, authRequests, logic, existing.getId(), patch);
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
        @ApiResponse(responseCode = "400", description = "Bad request"),
        @ApiResponse(
            responseCode = "403",
            description =
                "Forbidden - Requires appropriate permissions for USER or SYSTEM templates")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateNotificationTemplate create) {

    final String principal = securityContext.getUserPrincipal().getName();
    final ResourceContext<NotificationTemplate> ctx = getResourceContextByName(create.getName());
    final NotificationTemplate existing =
        repository.findByNameOrNull(create.getName(), Include.ALL);

    final List<AuthRequest> authRequests;
    final AuthorizationLogic authorizationLogic;

    if (existing == null) {
      // New template → requires CREATE
      authorizationLogic = AuthorizationLogic.ALL;
      authRequests =
          List.of(new AuthRequest(new OperationContext(entityType, MetadataOperation.CREATE), ctx));
    } else if (ProviderType.SYSTEM.equals(existing.getProvider())) {
      // Existing SYSTEM template → must have EDIT_ALL
      authorizationLogic = AuthorizationLogic.ALL;
      authRequests =
          List.of(
              new AuthRequest(new OperationContext(entityType, MetadataOperation.EDIT_ALL), ctx));
    } else {
      // Existing USER template → EDIT_ALL OR EDIT_USER_NOTIFICATION_TEMPLATE
      authorizationLogic = AuthorizationLogic.ANY;
      authRequests =
          List.of(
              new AuthRequest(new OperationContext(entityType, MetadataOperation.EDIT_ALL), ctx),
              new AuthRequest(
                  new OperationContext(
                      entityType, MetadataOperation.EDIT_USER_NOTIFICATION_TEMPLATE),
                  ctx));
    }

    final NotificationTemplate updated = mapper.createToEntity(create, principal);
    return createOrUpdate(uriInfo, securityContext, authRequests, authorizationLogic, updated);
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
    NotificationTemplate existing =
        Entity.getEntity(Entity.NOTIFICATION_TEMPLATE, restore.getId(), "", Include.DELETED);
    List<AuthRequest> authRequests;
    AuthorizationLogic authorizationLogic;
    ResourceContext<NotificationTemplate> ctx = getResourceContextById(existing.getId());
    if (ProviderType.SYSTEM.equals(existing.getProvider())) {
      authorizationLogic = AuthorizationLogic.ALL;
      authRequests =
          List.of(
              new AuthRequest(new OperationContext(entityType, MetadataOperation.EDIT_ALL), ctx));
    } else {
      authorizationLogic = AuthorizationLogic.ANY;
      authRequests =
          List.of(
              new AuthRequest(new OperationContext(entityType, MetadataOperation.EDIT_ALL), ctx),
              new AuthRequest(
                  new OperationContext(
                      entityType, MetadataOperation.EDIT_USER_NOTIFICATION_TEMPLATE),
                  ctx));
    }

    authorizer.authorizeRequests(securityContext, authRequests, authorizationLogic);

    RestUtil.PutResponse<NotificationTemplate> put =
        repository.restoreEntity(securityContext.getUserPrincipal().getName(), existing.getId());
    repository.restoreFromSearch(put.getEntity());
    addHref(uriInfo, put.getEntity());
    LOG.info(
        "Restored {}:{}", Entity.getEntityTypeFromObject(put.getEntity()), put.getEntity().getId());
    return put.toResponse();
  }

  @PUT
  @Path("/{id}/reset")
  @Operation(
      operationId = "resetNotificationTemplateById",
      summary = "Reset a notification template to its default state by Id",
      description =
          "Reset a SYSTEM notification template to its original default state from seed data. "
              + "Only SYSTEM templates can be reset. This operation requires EDIT permissions.",
      responses = {
        @ApiResponse(responseCode = "200", description = "Template successfully reset to default"),
        @ApiResponse(
            responseCode = "400",
            description = "Bad request - Template cannot be reset (not a SYSTEM template)"),
        @ApiResponse(
            responseCode = "403",
            description = "Forbidden - proper EDIT permission required"),
        @ApiResponse(
            responseCode = "404",
            description = "Notification template for instance {id} is not found")
      })
  public Response resetToDefaultById(
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the notification template", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {

    NotificationTemplate template = repository.get(null, id, repository.getFields("*"));
    if (!ProviderType.SYSTEM.equals(template.getProvider())) {
      return Response.status(Response.Status.BAD_REQUEST)
          .entity("Cannot reset template: only SYSTEM templates can be reset to default")
          .build();
    }
    List<AuthRequest> authRequests =
        List.of(
            new AuthRequest(
                new OperationContext(entityType, MetadataOperation.EDIT_ALL),
                getResourceContextById(id)));
    authorizer.authorizeRequests(securityContext, authRequests, AuthorizationLogic.ALL);
    repository.resetToDefault(template);
    return Response.ok().build();
  }

  @PUT
  @Path("/name/{fqn}/reset")
  @Operation(
      operationId = "resetNotificationTemplateByFQN",
      summary = "Reset a notification template to its default state by fully qualified name",
      description =
          "Reset a SYSTEM notification template to its original default state from seed data. "
              + "Only SYSTEM templates can be reset. This operation requires EDIT permissions.",
      responses = {
        @ApiResponse(responseCode = "200", description = "Template successfully reset to default"),
        @ApiResponse(
            responseCode = "400",
            description = "Bad request - Template cannot be reset (not a SYSTEM template)"),
        @ApiResponse(
            responseCode = "403",
            description = "Forbidden - proper EDIT permission required"),
        @ApiResponse(
            responseCode = "404",
            description = "Notification template for instance {fqn} is not found")
      })
  public Response resetToDefaultByFQN(
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fully qualified name of the notification template to reset",
              schema = @Schema(type = "string"))
          @PathParam("fqn")
          String fqn) {

    NotificationTemplate template = repository.getByName(null, fqn, repository.getFields("*"));
    if (!ProviderType.SYSTEM.equals(template.getProvider())) {
      return Response.status(Response.Status.BAD_REQUEST)
          .entity("Cannot reset template: only SYSTEM templates can be reset to default")
          .build();
    }
    List<AuthRequest> authRequests =
        List.of(
            new AuthRequest(
                new OperationContext(entityType, MetadataOperation.EDIT_ALL),
                getResourceContextByName(fqn)));
    authorizer.authorizeRequests(securityContext, authRequests, AuthorizationLogic.ALL);
    repository.resetToDefault(template);
    return Response.ok().build();
  }

  @POST
  @Path("/validate")
  @Operation(
      operationId = "validateNotificationTemplate",
      summary = "Validate notification template syntax",
      description =
          "Validates only the Handlebars syntax of template subject and body without generating mock data or sending. "
              + "Requires any of: CREATE, EDIT_ALL, EDIT_USER_NOTIFICATION_TEMPLATE.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Validation result",
            content =
                @Content(
                    mediaType = "application/json",
                    schema =
                        @Schema(implementation = NotificationTemplateValidationResponse.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response validateTemplate(
      @Context SecurityContext securityContext,
      @Valid NotificationTemplateValidationRequest request) {
    authorizePreviewCapability(securityContext);
    NotificationTemplateValidationResponse response = repository.validate(request);

    return Response.ok(response).build();
  }

  @POST
  @Path("/render")
  @Operation(
      operationId = "renderNotificationTemplate",
      summary = "Render notification template with mock data",
      description =
          "Generates mock ChangeEvent data for the specified resource and eventType, then renders the template. "
              + "Returns the rendered subject and body for preview. Does not send to any destination. "
              + "Requires any of: CREATE, EDIT_ALL, EDIT_USER_NOTIFICATION_TEMPLATE.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Rendering result with validation and render outputs",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = NotificationTemplateRenderResponse.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response renderTemplate(
      @Context SecurityContext securityContext, @Valid NotificationTemplateRenderRequest request) {
    authorizePreviewCapability(securityContext);
    NotificationTemplateRenderResponse response = repository.render(request);

    return Response.ok(response).build();
  }

  @POST
  @Path("/send")
  @Operation(
      operationId = "sendNotificationTemplateTest",
      summary = "Validate and send notification template to external destinations",
      description =
          "Validates template syntax, generates mock ChangeEvent data, and sends to specified external destinations. "
              + "Returns validation status only. Delivery errors are logged server-side. "
              + "Only external destinations (Email, Slack, Teams, GChat, Webhook) are supported. "
              + "Requires any of: CREATE, EDIT_ALL, EDIT_USER_NOTIFICATION_TEMPLATE.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Validation result",
            content =
                @Content(
                    mediaType = "application/json",
                    schema =
                        @Schema(implementation = NotificationTemplateValidationResponse.class))),
        @ApiResponse(responseCode = "400", description = "Bad request or validation failure")
      })
  public Response sendTemplate(
      @Context SecurityContext securityContext, @Valid NotificationTemplateSendRequest request) {
    authorizePreviewCapability(securityContext);
    NotificationTemplateValidationResponse response = repository.send(request);

    return Response.ok(response).build();
  }

  @GET
  @Path("/helpers")
  @Operation(
      operationId = "getHandlebarsHelpers",
      summary = "Get available Handlebars helpers",
      description =
          "Returns a list of all available Handlebars helpers with their usage information. "
              + "Requires VIEW_BASIC permission for notification templates.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Handlebars helpers",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = HandlebarsHelperMetadata.class)))
      })
  public List<HandlebarsHelperMetadata> getHandlebarsHelpers(
      @Context SecurityContext securityContext) {
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC),
        getResourceContext());
    return repository.getHelperMetadata();
  }
}
