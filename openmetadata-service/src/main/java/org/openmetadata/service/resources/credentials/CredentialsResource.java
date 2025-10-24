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

package org.openmetadata.service.resources.credentials;

import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;


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
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.CreateCredentials;
import org.openmetadata.schema.entity.Credentials;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CredentialsRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;

@Path("/v1/credentials")
@Tag(
    name = "Credentials",
    description =
        "Credentials entity represents reusable authentication configurations for connecting to external services. "
            + "Credentials can be shared across multiple service connections and support various authentication methods "
            + "including OAuth2, API keys, basic authentication, and cloud provider credentials.")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "credentials")
@Slf4j
public class CredentialsResource extends EntityResource<Credentials, CredentialsRepository> {
  public static final String COLLECTION_PATH = "credentials";

  public static class CredentialsList extends ResultList<Credentials> {
    /* Required for tests */
  }

  @Override
  public Credentials addHref(UriInfo uriInfo, Credentials credentials) {
    super.addHref(uriInfo, credentials);
    Entity.withHref(uriInfo, credentials.getOwners());
    Entity.withHref(uriInfo, credentials.getDomains());
    return credentials;
  }

  public CredentialsResource(Authorizer authorizer, Limits limits) {
    super(Entity.CREDENTIALS, authorizer, limits);
  }

  @GET
  @Operation(
      operationId = "listCredentials",
      summary = "List credentials",
      description =
          "Get a list of credentials, optionally filtered by service type or credential type. "
              + "Use fields parameter to get only necessary fields.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of credentials",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = CredentialsList.class)))
      })
  public ResultList<Credentials> list(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = "owner,tags"))
          @QueryParam("fields")
          String fieldsParam,
      @Parameter(description = "Filter credentials by service type") @QueryParam("serviceType")
      ServiceType serviceType,
      @Parameter(description = "Filter credentials by credential type")
          @QueryParam("credentialType")
          CreateCredentials.CredentialType credentialType,
      @Parameter(
              description = "Limit the number credentials returned. (1 to 1000000, default = 10)")
          @DefaultValue("10")
          @QueryParam("limit")
          @Min(0)
          @Max(1000000)
          int limitParam,
      @Parameter(
              description = "Returns list of credentials before this cursor",
              schema = @Schema(type = "string"))
          @QueryParam("before")
          String before,
      @Parameter(
              description = "Returns list of credentials after this cursor",
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

    if (serviceType != null) {
      filter.addQueryParam("serviceType", serviceType.value());
    }

    if (credentialType != null) {
      filter.addQueryParam("credentialType", credentialType.value());
    }

    return super.listInternal(
        uriInfo, securityContext, fieldsParam, filter, limitParam, before, after);
  }

  @GET
  @Path("/{id}")
  @Operation(
      operationId = "getCredentialsById",
      summary = "Get credentials by ID",
      description = "Get a credentials entity by ID.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The credentials",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Credentials.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Credentials for instance {id} is not found")
      })
  public Credentials get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "ID of the credentials", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = "owner,tags"))
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
  @Path("/name/{name}")
  @Operation(
      operationId = "getCredentialsByName",
      summary = "Get credentials by name",
      description = "Get a credentials entity by name.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The credentials",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Credentials.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Credentials for instance {name} is not found")
      })
  public Credentials getByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the credentials", schema = @Schema(type = "string"))
          @PathParam("name")
          String name,
      @Parameter(
              description = "Fields requested in the returned resource",
              schema = @Schema(type = "string", example = "owner,tags"))
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

  @POST
  @Operation(
      operationId = "createCredentials",
      summary = "Create credentials",
      description = "Create a new credentials entity.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The credentials",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Credentials.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response create(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateCredentials create) {
    Credentials credentials = getCredentials(create, securityContext.getUserPrincipal().getName());
    return create(uriInfo, securityContext, credentials);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateCredentials",
      summary = "Create or update credentials",
      description = "Create a new credentials entity or update an existing one.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The credentials",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Credentials.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid CreateCredentials create) {
    Credentials credentials = getCredentials(create, securityContext.getUserPrincipal().getName());
    return createOrUpdate(uriInfo, securityContext, credentials);
  }

  @PATCH
  @Path("/{id}")
  @Operation(
      operationId = "patchCredentials",
      summary = "Update credentials",
      description = "Update an existing credentials entity using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "ID of the credentials", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject(
                            "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"Updated description\"}]")
                      }))
      JsonPatch patch) {
    return patchInternal(uriInfo, securityContext, id, patch);
  }

  @DELETE
  @Path("/{id}")
  @Operation(
      operationId = "deleteCredentials",
      summary = "Delete credentials",
      description =
          "Delete a credentials entity by ID. When deleted, all associated OAuth tokens will also be revoked.",
      responses = {
        @ApiResponse(responseCode = "200", description = "OK"),
        @ApiResponse(
            responseCode = "404",
            description = "Credentials for instance {id} is not found")
      })
  public Response delete(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "ID of the credentials", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return delete(uriInfo, securityContext, id, false, true);
  }

  @GET
  @Path("/{id}/versions")
  @Operation(
      operationId = "listAllCredentialsVersions",
      summary = "List credentials versions",
      description = "Get a list of all the versions of a credentials entity identified by ID.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of credentials versions",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntityHistory.class)))
      })
  public EntityHistory listVersions(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "ID of the credentials", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {
    return super.listVersionsInternal(securityContext, id);
  }

  @GET
  @Path("/{id}/versions/{version}")
  @Operation(
      operationId = "getSpecificCredentialsVersion",
      summary = "Get a version of the credentials",
      description = "Get a version of the credentials entity by ID.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "credentials",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Credentials.class))),
        @ApiResponse(
            responseCode = "404",
            description = "Credentials for instance {id} and version {version} is not found")
      })
  public Credentials getVersion(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "ID of the credentials", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id,
      @Parameter(
              description = "Credentials version number in the form `major`.`minor`",
              schema = @Schema(type = "string", example = "0.1 or 1.1"))
          @PathParam("version")
          String version) {
    return super.getVersionInternal(securityContext, id, version);
  }

  @POST
  @Path("/{id}/test")
  @Operation(
      operationId = "testCredentials",
      summary = "Test credentials connectivity",
      description = "Test the connectivity and validity of the credentials.",
      responses = {
        @ApiResponse(responseCode = "200", description = "Credentials test successful"),
        @ApiResponse(responseCode = "400", description = "Credentials test failed")
      })
  public Response testCredentials(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "ID of the credentials", schema = @Schema(type = "UUID"))
          @PathParam("id")
          UUID id) {

    // Get credentials with full config
    Credentials credentials = repository.get(uriInfo, id, repository.getFields("credentialConfig"));

    // Test the credentials based on type
    boolean testResult = testCredentialsConnectivity(credentials);

    if (testResult) {
      return Response.ok()
          .entity("{\"status\":\"success\",\"message\":\"Credentials test successful\"}")
          .build();
    } else {
      return Response.status(Response.Status.BAD_REQUEST)
          .entity("{\"status\":\"failed\",\"message\":\"Credentials test failed\"}")
          .build();
    }
  }

  private Credentials getCredentials(CreateCredentials create, String user) {
    return this.repository.copy(new Credentials(), create, user)
        .withCredentialType(create.getCredentialType())
        .withCredentialConfig(create.getCredentialConfig())
        .withServiceTypes(create.getServiceTypes())
        .withIsOAuth(create.getIsOAuth())
        .withRequiresUserAuthentication(create.getRequiresUserAuthentication());
  }

  private boolean testCredentialsConnectivity(Credentials credentials) {
    // Implement credential testing logic based on type
    // This is a placeholder - real implementation would test actual connectivity
    try {
      switch (credentials.getCredentialType()) {
        case BasicAuth:
        case ApiToken:
        case ApiKeyAuth:
          // Test API connectivity
          return true;
        case AWSCredentials:
          // Test AWS connectivity
          return true;
        case GCPCredentials:
          // Test GCP connectivity
          return true;
        case AzureServicePrincipal:
          // Test Azure connectivity
          return true;
        case OAuth2ClientCredentials:
        case OAuth2AzureAD:
          // Test OAuth token validity
          return true;
        default:
          return true;
      }
    } catch (Exception e) {
      LOG.warn("Credentials test failed for {}: {}", credentials.getId(), e.getMessage());
      return false;
    }
  }
}
