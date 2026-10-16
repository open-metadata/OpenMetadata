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
import java.util.Map;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.search.SearchClient.RawSearchResponse;
import org.openmetadata.service.security.Authorizer;

/**
 * Admin-only, read-only search-engine introspection for integration tests that run against a remote
 * cluster (where {@code :9200} isn't reachable). Auto-registered via {@link Collection}.
 *
 * <p>Exposes a fixed, typed set of read-only operations — {@code count}, {@code search},
 * {@code alias}, {@code mapping}, {@code indices}, {@code exists} — each of which builds the engine
 * request <b>server-side</b> from a validated index/alias name. There is no caller-controlled
 * request path or HTTP method, so no mutating engine operation (e.g. {@code _doc}, {@code _bulk},
 * {@code _delete_by_query}) can be reached through this resource. Every method requires admin.
 *
 * <p><b>Disabled by default.</b> This is a test-only surface, so it does not register unless {@code
 * OM_TEST_SUPPORT_SEARCH_ENABLED=true} (env var or system property) — a production deployment never
 * exposes it. The constructor throws when disabled; {@code CollectionRegistry} catches that and
 * simply skips registration. To run the external integration suites against a cluster, set the flag
 * on that <b>server's</b> deployment (not on the CI runner).
 */
@Path("/v1/test-support/search")
@Collection(name = "testSupportSearch")
@Tag(name = "TestSupport", description = "Admin-only read-only search introspection for tests")
@Produces(MediaType.APPLICATION_JSON)
@Slf4j
public class TestSupportSearchResource {

  /** Index/alias names are interpolated into the engine path, so restrict to a safe charset. */
  private static final Pattern SAFE_NAME = Pattern.compile("[a-zA-Z0-9][a-zA-Z0-9._-]*");

  private static final Pattern SAFE_PATTERN = Pattern.compile("[a-zA-Z0-9][a-zA-Z0-9._-]*\\*?");

  private static final String ENABLED_FLAG = "OM_TEST_SUPPORT_SEARCH_ENABLED";

  private final Authorizer authorizer;

  public TestSupportSearchResource(Authorizer authorizer) {
    if (!isEnabled()) {
      throw new IllegalStateException(
          "TestSupportSearchResource is disabled. Set "
              + ENABLED_FLAG
              + "=true (env var or system property) on the server to expose the test-support search"
              + " introspection endpoints; production deployments must leave it unset.");
    }
    this.authorizer = authorizer;
  }

  private static boolean isEnabled() {
    final String env = System.getenv(ENABLED_FLAG);
    final String value = env != null ? env : System.getProperty(ENABLED_FLAG);
    return Boolean.parseBoolean(value);
  }

  @GET
  @Path("/count")
  @Operation(
      operationId = "testSupportSearchCount",
      summary = "Document count for an index/alias",
      responses = {@ApiResponse(responseCode = "200", description = "Raw engine count response")})
  public Response count(@Context SecurityContext securityContext, @QueryParam("index") String index)
      throws IOException {
    return engineGet(securityContext, "/" + safeName(index) + "/_count");
  }

  @POST
  @Path("/count")
  @Consumes(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "testSupportSearchCountWithQuery",
      summary = "Document count for an index/alias matching a query",
      responses = {@ApiResponse(responseCode = "200", description = "Raw engine count response")})
  public Response countWithQuery(
      @Context SecurityContext securityContext, @QueryParam("index") String index, String query)
      throws IOException {
    return enginePost(securityContext, "/" + safeName(index) + "/_count", query);
  }

  @POST
  @Path("/search")
  @Consumes(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "testSupportSearchQuery",
      summary = "Search an index/alias with a query body",
      responses = {@ApiResponse(responseCode = "200", description = "Raw engine search response")})
  public Response search(
      @Context SecurityContext securityContext, @QueryParam("index") String index, String query)
      throws IOException {
    return enginePost(securityContext, "/" + safeName(index) + "/_search", query);
  }

  @GET
  @Path("/alias")
  @Operation(
      operationId = "testSupportSearchAlias",
      summary = "Backing indices for an alias",
      responses = {@ApiResponse(responseCode = "200", description = "Raw engine alias response")})
  public Response alias(@Context SecurityContext securityContext, @QueryParam("name") String name)
      throws IOException {
    return engineGet(securityContext, "/_alias/" + safeName(name));
  }

  @GET
  @Path("/mapping")
  @Operation(
      operationId = "testSupportSearchMapping",
      summary = "Mapping for an index/alias",
      responses = {@ApiResponse(responseCode = "200", description = "Raw engine mapping response")})
  public Response mapping(
      @Context SecurityContext securityContext, @QueryParam("index") String index)
      throws IOException {
    return engineGet(securityContext, "/" + safeName(index) + "/_mapping");
  }

  @GET
  @Path("/indices")
  @Operation(
      operationId = "testSupportSearchIndices",
      summary = "Index names matching a pattern (_cat/indices)",
      responses = {@ApiResponse(responseCode = "200", description = "Raw engine _cat response")})
  public Response indices(
      @Context SecurityContext securityContext, @QueryParam("pattern") String pattern)
      throws IOException {
    return engineGet(
        securityContext, "/_cat/indices/" + safePattern(pattern) + "?format=json&h=index");
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
  public Response exists(
      @Context SecurityContext securityContext,
      @QueryParam("index") String index,
      @QueryParam("alias") String alias)
      throws IOException {
    authorizer.authorizeAdmin(securityContext);
    RawSearchResponse response =
        Entity.getSearchRepository()
            .getSearchClient()
            .rawSearchRequest("GET", existsPath(index, alias), null);
    boolean exists = response.statusCode() >= 200 && response.statusCode() < 300;
    return Response.ok(Map.of("exists", exists)).build();
  }

  private Response engineGet(SecurityContext securityContext, String enginePath)
      throws IOException {
    return forward(securityContext, "GET", enginePath, null);
  }

  private Response enginePost(SecurityContext securityContext, String enginePath, String body)
      throws IOException {
    return forward(securityContext, "POST", enginePath, body);
  }

  private Response forward(
      SecurityContext securityContext, String method, String enginePath, String body)
      throws IOException {
    authorizer.authorizeAdmin(securityContext);
    RawSearchResponse response =
        Entity.getSearchRepository().getSearchClient().rawSearchRequest(method, enginePath, body);
    return Response.status(response.statusCode())
        .type(MediaType.APPLICATION_JSON)
        .entity(response.body())
        .build();
  }

  private static String existsPath(String index, String alias) {
    final String path;
    if (!CommonUtil.nullOrEmpty(index) && CommonUtil.nullOrEmpty(alias)) {
      path = "/" + safeName(index);
    } else if (CommonUtil.nullOrEmpty(index) && !CommonUtil.nullOrEmpty(alias)) {
      path = "/_alias/" + safeName(alias);
    } else {
      throw new BadRequestException(
          "exactly one of 'index' or 'alias' query parameters is required");
    }
    return path;
  }

  private static String safeName(String name) {
    if (CommonUtil.nullOrEmpty(name) || !SAFE_NAME.matcher(name).matches()) {
      throw new BadRequestException("invalid index/alias name: " + name);
    }
    return name;
  }

  private static String safePattern(String pattern) {
    if (CommonUtil.nullOrEmpty(pattern) || !SAFE_PATTERN.matcher(pattern).matches()) {
      throw new BadRequestException("invalid index pattern: " + pattern);
    }
    return pattern;
  }
}
