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
package org.openmetadata.service.resources.testsupport;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.search.SearchClient.RawSearchResponse;
import org.openmetadata.service.security.Authorizer;

/**
 * Admin-only, read-only passthrough to the search engine for integration tests that run against a
 * remote cluster (where {@code :9200} isn't reachable). Auto-registered via {@link Collection}.
 *
 * <p>Forwards a whitelisted set of read-only operations ({@code _count}, {@code _search},
 * {@code _alias}, {@code _cat/indices}) to {@link
 * org.openmetadata.service.search.SearchClient#rawSearchRequest}. Mutating paths are rejected and
 * every method requires admin.
 */
@Path("/v1/test-support/search")
@Collection(name = "testSupportSearch")
@Tag(name = "TestSupport", description = "Admin-only read-only search passthrough for tests")
@Produces(MediaType.APPLICATION_JSON)
@Slf4j
public class TestSupportSearchResource {

  private static final List<String> ALLOWED_TOKENS =
      List.of("_count", "_search", "_alias", "_cat/indices");

  private final Authorizer authorizer;

  public TestSupportSearchResource(Authorizer authorizer) {
    this.authorizer = authorizer;
  }

  @GET
  @Path("/passthrough")
  @Operation(
      operationId = "testSupportSearchGet",
      summary = "Read-only GET passthrough to the search engine",
      responses = {@ApiResponse(responseCode = "200", description = "Raw engine response")})
  public Response passthroughGet(
      @Context SecurityContext securityContext, @QueryParam("path") String path)
      throws IOException {
    return forward(securityContext, "GET", path, null);
  }

  @POST
  @Path("/passthrough")
  @Consumes(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "testSupportSearchPost",
      summary = "Read-only POST passthrough to the search engine",
      responses = {@ApiResponse(responseCode = "200", description = "Raw engine response")})
  public Response passthroughPost(
      @Context SecurityContext securityContext, @QueryParam("path") String path, String body)
      throws IOException {
    return forward(securityContext, "POST", path, body);
  }

  @GET
  @Path("/cluster-alias")
  @Operation(
      operationId = "testSupportClusterAlias",
      summary = "The server's configured search cluster alias (index name prefix)",
      responses = {@ApiResponse(responseCode = "200", description = "{\"clusterAlias\": string}")})
  public Response clusterAlias(@Context SecurityContext securityContext) {
    authorizer.authorizeAdmin(securityContext);
    String clusterAlias = Entity.getSearchRepository().getClusterAlias();
    return Response.ok(Map.of("clusterAlias", clusterAlias == null ? "" : clusterAlias)).build();
  }

  @GET
  @Path("/exists")
  @Operation(
      operationId = "testSupportSearchExists",
      summary = "Whether an index or alias exists",
      responses = {@ApiResponse(responseCode = "200", description = "{\"exists\": boolean}")})
  public Response exists(@Context SecurityContext securityContext, @QueryParam("path") String path)
      throws IOException {
    authorizer.authorizeAdmin(securityContext);
    validateReadOnly(path);
    RawSearchResponse response =
        Entity.getSearchRepository()
            .getSearchClient()
            .rawSearchRequest("GET", normalize(path), null);
    boolean exists = response.statusCode() >= 200 && response.statusCode() < 300;
    return Response.ok(Map.of("exists", exists)).build();
  }

  private Response forward(SecurityContext securityContext, String method, String path, String body)
      throws IOException {
    authorizer.authorizeAdmin(securityContext);
    validateReadOnly(path);
    RawSearchResponse response =
        Entity.getSearchRepository()
            .getSearchClient()
            .rawSearchRequest(method, normalize(path), body);
    return Response.status(response.statusCode())
        .type(MediaType.APPLICATION_JSON)
        .entity(response.body())
        .build();
  }

  private static String normalize(String path) {
    if (CommonUtil.nullOrEmpty(path)) {
      throw new BadRequestException("path query parameter is required");
    }
    return path.startsWith("/") ? path : "/" + path;
  }

  private static void validateReadOnly(String path) {
    String value = normalize(path);
    boolean allowed = ALLOWED_TOKENS.stream().anyMatch(value::contains);
    if (!allowed) {
      throw new BadRequestException(
          "Only read-only search introspection paths are permitted: " + ALLOWED_TOKENS);
    }
  }
}
