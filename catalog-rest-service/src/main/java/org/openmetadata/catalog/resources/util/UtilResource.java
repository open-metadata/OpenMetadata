package org.openmetadata.catalog.resources.util;

import io.swagger.annotations.Api;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.util.Objects;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.UtilRepository;
import org.openmetadata.catalog.resources.Collection;
import org.openmetadata.catalog.security.Authorizer;
import org.openmetadata.catalog.util.EntitiesCount;
import org.openmetadata.catalog.util.ServicesCount;

@Path("/v1/util")
@Api(value = "Util collection", tags = "Util collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "util")
@Slf4j
public class UtilResource {
  public static final String COLLECTION_PATH = "/v1/util";
  private final UtilRepository utilRepository;
  private final Authorizer authorizer;

  public UtilResource(CollectionDAO dao, Authorizer authorizer) {
    Objects.requireNonNull(dao, "UtilRepository must not be null");
    this.utilRepository = new UtilRepository(dao.utilDAO());
    this.authorizer = authorizer;
  }

  @GET
  @Path("/entities/count")
  @Operation(
      operationId = "listEntitiesCount",
      summary = "List All Entities Counts",
      tags = "util",
      description = "Get a List of all Entities Count",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Entities Count",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntitiesCount.class)))
      })
  public EntitiesCount listEntitiesCount(@Context UriInfo uriInfo) {
    return utilRepository.getAllEntitiesCount();
  }

  @GET
  @Path("/services/count")
  @Operation(
      operationId = "listServicesCount",
      summary = "List All Services Counts",
      tags = "util",
      description = "Get a List of all Entities Count",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Services Count",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = ServicesCount.class)))
      })
  public ServicesCount listServicesCount(@Context UriInfo uriInfo) {
    return utilRepository.getAllServicesCount();
  }
}
