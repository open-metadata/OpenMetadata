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
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.time.Duration;
import java.util.Map;
import org.openmetadata.service.rdf.repair.RdfRepairJob;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.security.Authorizer;

/**
 * Admin-only test support for the RDF projection: runs a scheduled RDF repair pass on demand, so
 * integration tests need not wait for the next one.
 *
 * <p><b>Disabled by default.</b> It registers only when {@code OM_TEST_SUPPORT_SEARCH_ENABLED=true}
 * (env var or system property), the flag that also enables {@link TestSupportSearchResource}; a
 * production deployment never exposes it. The constructor throws when disabled, and {@code
 * CollectionRegistry} skips registration.
 */
@Path("/v1/test-support/rdf")
@Collection(name = "testSupportRdf")
@Tag(name = "TestSupport", description = "Admin-only RDF projection support for tests")
@Produces(MediaType.APPLICATION_JSON)
public class TestSupportRdfResource {
  private static final String ENABLED_FLAG = "OM_TEST_SUPPORT_SEARCH_ENABLED";

  private final Authorizer authorizer;

  public TestSupportRdfResource(final Authorizer authorizer) {
    if (!isEnabled()) {
      throw new IllegalStateException(
          "TestSupportRdfResource is disabled. Set "
              + ENABLED_FLAG
              + "=true (env var or system property) on the server to expose it; production"
              + " deployments must leave it unset.");
    }
    this.authorizer = authorizer;
  }

  private static boolean isEnabled() {
    final String env = System.getenv(ENABLED_FLAG);
    return Boolean.parseBoolean(env != null ? env : System.getProperty(ENABLED_FLAG));
  }

  @POST
  @Path("/repair")
  @Operation(
      operationId = "testSupportRunRdfRepair",
      summary = "Run a scheduled RDF repair pass now",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "{\"ran\": boolean}; false while another pass holds the repair lock"),
        @ApiResponse(responseCode = "404", description = "This server runs no RDF repair")
      })
  public Response runRdfRepair(
      @Context final SecurityContext securityContext,
      @QueryParam("sweep") @DefaultValue("false") final boolean sweep,
      @QueryParam("settleSeconds") @DefaultValue("60") final int settleSeconds) {
    authorizer.authorizeAdmin(securityContext);
    return RdfRepairJob.running()
        .map(
            job ->
                Response.ok(
                        Map.of(
                            "ran",
                            job.runPassNow(sweep, Duration.ofSeconds(Math.max(0, settleSeconds)))))
                    .build())
        .orElseGet(() -> Response.status(Response.Status.NOT_FOUND).build());
  }
}
