package org.openmetadata.service.resources.services.security;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
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
import org.openmetadata.schema.api.services.CreateSecurityService;
import org.openmetadata.schema.entity.services.SecurityService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.SecurityConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.SecurityServiceRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.services.ServiceEntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Path("/v1/services/securityServices")
@Tag(
    name = "Security Services",
    description = "APIs related to Security Service entities, such as Apache Ranger.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "securityServices")
public class SecurityServiceResource
    extends ServiceEntityResource<SecurityService, SecurityServiceRepository, SecurityConnection> {
  public static final String COLLECTION_PATH = "v1/services/securityServices/";
  public static final String FIELDS = "owners,tags,domain,followers";

  @Override
  public SecurityService addHref(UriInfo uriInfo, SecurityService service) {
    super.addHref(uriInfo, service);
    Entity.withHref(uriInfo, service.getOwners());
    return service;
  }

  public SecurityServiceResource(Authorizer authorizer, Limits limits) {
    super(Entity.SECURITY_SERVICE, authorizer, limits, ServiceType.SECURITY);
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    return null;
  }

  @Override
  protected SecurityService nullifyConnection(SecurityService service) {
    return service.withConnection(null);
  }

  @Override
  protected String extractServiceType(SecurityService service) {
    return service.getServiceType().value();
  }

  public static class SecurityServiceList extends ResultList<SecurityService> {
    /* Required for serde */
  }

  @GET
  @Operation(
      operationId = "listSecurityServices",
      summary = "List security services",
      description = "Get a list of security services.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of security service instances",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SecurityServiceList.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public ResultList<SecurityService> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = FIELDS))
          @QueryParam("fields")
          String fieldsParam) {
    return super.listInternal(
        uriInfo,
        securityContext,
        fieldsParam,
        new org.openmetadata.service.jdbi3.ListFilter(
            org.openmetadata.schema.type.Include.NON_DELETED),
        10,
        null,
        null);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getSecurityServiceByID",
      summary = "Get a security service",
      description = "Get a security service by `id`.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Security service instance",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SecurityService.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Security service for instance {id} is not found")
      })
  public SecurityService get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Security service Id", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return getInternal(
        uriInfo, securityContext, id, FIELDS, org.openmetadata.schema.type.Include.NON_DELETED);
  }

  @POST
  @Operation(
      operationId = "createSecurityService",
      summary = "Create security service",
      description = "Create a new security service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Security service instance",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SecurityService.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateSecurityService create) {
    SecurityService service =
        new SecurityService()
            .withId(UUID.randomUUID())
            .withName(create.getName())
            .withDisplayName(create.getDisplayName())
            .withServiceType(create.getServiceType())
            .withDescription(create.getDescription())
            .withConnection(create.getConnection())
            .withTags(create.getTags())
            .withOwners(create.getOwners());
    return create(uriInfo, securityContext, service);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateSecurityService",
      summary = "Update security service",
      description = "Update an existing or create a new security service.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Security service instance",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SecurityService.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateSecurityService create) {
    SecurityService service =
        new SecurityService()
            .withId(UUID.randomUUID())
            .withName(create.getName())
            .withDisplayName(create.getDisplayName())
            .withServiceType(create.getServiceType())
            .withDescription(create.getDescription())
            .withConnection(create.getConnection())
            .withTags(create.getTags())
            .withOwners(create.getOwners());
    return createOrUpdate(uriInfo, securityContext, service);
  }
}
