package org.openmetadata.service.resources.entityProfiles;

import static org.openmetadata.schema.type.Include.ALL;

import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
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
import javax.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.CreateEntityProfile;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityProfile;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TableProfile;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityProfileRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityTimeSeriesResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
@Path("/v1/entity/profiles")
@Tag(
    name = "Entity Profiles",
    description = "Provides APIs to interact with entity profiles (statistics).")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "EntityProfiles")
@Hidden
public class EntityProfileResource
    extends EntityTimeSeriesResource<EntityProfile, EntityProfileRepository> {
  public EntityProfileResource(Authorizer authorizer) {
    super(Entity.ENTITY_PROFILE, authorizer);
  }

  public static class EntityProfileList extends ResultList<EntityProfile> {
    /* Required for serde */
  }

  @GET
  @Path("/{entityType}/{fqn}")
  @Operation(
      operationId = "list profiles",
      summary = "List of profiles",
      description =
          "Get a list of all the profiles for the given fqn, optionally filtered by `profileType`,"
              + "`startTs` and `endTs` of the profile. To get profile of a specific column you can "
              + "use a combination of the column fqn + profileType=column.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of profiles",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityProfileList.class)))
      })
  public ResultList<EntityProfile> listProfileData(
      @Context SecurityContext securityContext,
      @Parameter(description = "FQN of the entity", schema = @Schema(type = "String"))
          @PathParam("fqn")
          String fqn,
      @Parameter(
              description = "Type of entity we are adding a profile for (e.g. table, etc.)",
              schema = @Schema(type = "String"))
          @PathParam("entityType")
          String entityType,
      @Parameter(
              description = "Filter profile data after the given start timestamp",
              schema = @Schema(type = "number"))
          @NotNull
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "Filter profile before the given end timestamp",
              schema = @Schema(type = "number"))
          @NotNull
          @QueryParam("endTs")
          Long endTs,
      @Parameter(
              description =
                  "Optional: Profile extension type (Column, Table, System, etc.). If not provided, list all profile data for the fqn.",
              schema = @Schema(implementation = CreateEntityProfile.ProfileTypeEnum.class))
          @QueryParam("profileType")
          CreateEntityProfile.ProfileTypeEnum profileType,
      @Parameter(
              description = "Optional: Column name to get the profile of a specific column.",
              schema = @Schema(type = "String"))
          @QueryParam("columnName")
          String columnName) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_DATA_PROFILE);
    String entityFQN;
    try {
      entityFQN = FullyQualifiedName.getTableFQN(fqn);
    } catch (IllegalArgumentException e) {
      // If we can't extract the table FQN, then assume we have entity FQN
      entityFQN = fqn;
    }
    ListFilter filter = new ListFilter(null);
    filter.addQueryParam("entityProfileColumnName", columnName);
    filter.addQueryParam("entityProfileType", profileType != null ? profileType.value() : null);
    filter.addQueryParam("entityProfileFQN", fqn);
    filter.addQueryParam("entityProfileEntityType", entityType);

    ResourceContext<?> resourceContext = new ResourceContext<>(entityType, null, entityFQN);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    EntityInterface entity = Entity.getEntityByName(entityType, entityFQN, "owners", ALL);
    Boolean authorizePII = authorizer.authorizePII(securityContext, entity.getOwners());
    return repository.listProfileData(filter, startTs, endTs, authorizePII);
  }

  @POST
  @Path("/id/{entityType}/{id}")
  @Operation(
      operationId = "addProfileDataById",
      summary = "Add profile data for an entity",
      description = "Add profile data for an entity identified by `id`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Entity profile data added successfully",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityProfile.class)))
      })
  public Response addProfileDataById(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Unique identifier of the entity", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Type of entity we are adding a profile for (e.g. table, etc.)",
              schema = @Schema(type = "String"))
          @PathParam("entityType")
          String entityType,
      @Valid CreateEntityProfile create) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    ResourceContext<Table> resourceContext = new ResourceContext<>(entityType, id, null);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    EntityInterface entity = Entity.getEntity(entityType, id, "", ALL);
    return repository.addProfileData(uriInfo, entity, create);
  }

  @POST
  @Path("/name/{entityType}/{fqn}")
  @Operation(
      operationId = "addProfileDataByFQN",
      summary = "Add profile data for an entity",
      description = "Add profile data for an entity identified by `fullyQualifiedName`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Entity profile data added successfully",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityProfile.class)))
      })
  public Response addProfileDataByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Entity fullyQualifiedName", schema = @Schema(type = "String"))
          @PathParam("fqn")
          String fqn,
      @Parameter(
              description = "Type of entity we are adding a profile for (e.g. table, etc.)",
              schema = @Schema(type = "String"))
          @PathParam("entityType")
          String entityType,
      @Valid CreateEntityProfile create) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    ResourceContext<Table> resourceContext = new ResourceContext<>(entityType, null, fqn);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    EntityInterface entity = Entity.getEntityByName(entityType, fqn, "", ALL);
    return repository.addProfileData(uriInfo, entity, create);
  }

  @DELETE
  @Path("/name/{entityType}/{fqn}/{timestamp}")
  @Operation(
      operationId = "deleteEntityProfileDataByName",
      summary = "Delete profile data for an entity",
      description =
          "Delete all profile data for an entity, or specific profile extension data if extension parameter is provided.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully deleted profile data",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TableProfile.class)))
      })
  public Response deleteEntityProfileDataByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "FQN of the entity", schema = @Schema(type = "String"))
          @PathParam("fqn")
          String fqn,
      @Parameter(
              description = "Type of entity we are deleting a profile for (e.g. table, etc.)",
              schema = @Schema(type = "String"))
          @PathParam("entityType")
          String entityType,
      @Parameter(
              description = "Timestamp of the profile data we are deleting",
              schema = @Schema(type = "long"))
          @PathParam("timestamp")
          Long timestamp,
      @Parameter(
              description =
                  "Optional: Profile extension type (Column, Table, System, etc.). If not provided, deletes all profile data.",
              schema = @Schema(implementation = CreateEntityProfile.ProfileTypeEnum.class))
          @QueryParam("profileType")
          CreateEntityProfile.ProfileTypeEnum profileType,
      @Parameter(
              description = "Optional: Column name to delete the profile of a specific column.",
              schema = @Schema(type = "String"))
          @QueryParam("columnName")
          String columnName) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    ResourceContext<Table> resourceContext = new ResourceContext<>(entityType, null, fqn);
    authorizer.authorize(securityContext, operationContext, resourceContext);

    ListFilter filter = new ListFilter(null);
    filter.addQueryParam("entityProfileColumnName", columnName);
    filter.addQueryParam("entityProfileType", profileType != null ? profileType.value() : null);
    filter.addQueryParam("entityProfileFQN", fqn);
    filter.addQueryParam("entityProfileEntityType", entityType);

    repository.deleteEntityProfile(filter, timestamp);
    return Response.ok().build();
  }

  @DELETE
  @Path("/id/{entityType}/{id}/{timestamp}")
  @Operation(
      operationId = "deleteEntityProfileData",
      summary = "Delete profile data for an entity",
      description =
          "Delete all profile data for an entity, or specific profile extension data if extension parameter is provided.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Successfully deleted profile data",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = TableProfile.class)))
      })
  public Response deleteEntityProfileDataById(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Id of the entity", schema = @Schema(type = "UUID")) @PathParam("id")
          UUID id,
      @Parameter(
              description = "Type of entity we are deleting a profile for (e.g. table, etc.)",
              schema = @Schema(type = "String"))
          @PathParam("entityType")
          String entityType,
      @Parameter(
              description = "Timestamp of the profile data we are deleting",
              schema = @Schema(type = "long"))
          @PathParam("timestamp")
          Long timestamp,
      @Parameter(
              description =
                  "Optional: Profile type (Column, Table, System, etc.). If not provided, deletes all profile data.",
              schema = @Schema(implementation = CreateEntityProfile.ProfileTypeEnum.class))
          @QueryParam("profileType")
          CreateEntityProfile.ProfileTypeEnum profileType,
      @Parameter(
              description = "Optional: Column name to delete the profile of a specific column.",
              schema = @Schema(type = "String"))
          @QueryParam("columnName")
          String columnName) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_DATA_PROFILE);
    ResourceContext<Table> resourceContext = new ResourceContext<>(entityType, id, null);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    EntityInterface entity = Entity.getEntity(entityType, id, "", ALL);

    ListFilter filter = new ListFilter(null);
    filter.addQueryParam("entityProfileColumnName", columnName);
    filter.addQueryParam("entityProfileType", profileType != null ? profileType.value() : null);
    filter.addQueryParam("entityProfileFQN", entity.getFullyQualifiedName());
    filter.addQueryParam("entityProfileEntityType", entityType);

    repository.deleteEntityProfile(filter, timestamp);
    return Response.ok().build();
  }

  @GET
  @Path("/{entityType}")
  @Operation(
      operationId = "listAllProfileData",
      summary = "List all profile data ",
      description =
          "Get all profile data for a specific entity type between the specified timestamps. Non admin users and non bots are restricted to only profile data that does not contain PII.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of profiles",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityProfileList.class)))
      })
  public ResultList<EntityProfile> listAllProfileData(
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Filter profile data after the given start timestamp",
              schema = @Schema(type = "number"))
          @NotNull
          @QueryParam("startTs")
          Long startTs,
      @Parameter(
              description = "Filter profile before the given end timestamp",
              schema = @Schema(type = "number"))
          @NotNull
          @QueryParam("endTs")
          Long endTs,
      @Parameter(
              description = "Type of entity we are adding a profile for (e.g. table, etc.)",
              schema = @Schema(type = "String"))
          @PathParam("entityType")
          String entityType,
      @Parameter(
              description =
                  "Optional: Profile extension type (Column, Table, System, etc.). If not provided, list all profile data for the fqn.",
              schema = @Schema(implementation = CreateEntityProfile.ProfileTypeEnum.class))
          @QueryParam("profileType")
          CreateEntityProfile.ProfileTypeEnum profileType) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_DATA_PROFILE);
    ResourceContext<?> resourceContext = new ResourceContext<>(entityType);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    SubjectContext subjectContext = DefaultAuthorizer.getSubjectContext(securityContext);

    ListFilter filter = new ListFilter(null);
    filter.addQueryParam("entityProfileType", profileType != null ? profileType.value() : null);
    filter.addQueryParam("entityProfileEntityType", entityType);

    Boolean authorizePII = subjectContext.isAdmin() || subjectContext.isBot();
    return repository.listProfileData(filter, startTs, endTs, authorizePII);
  }
}
