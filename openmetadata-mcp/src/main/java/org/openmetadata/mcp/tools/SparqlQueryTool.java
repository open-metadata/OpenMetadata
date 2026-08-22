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

package org.openmetadata.mcp.tools;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.RdfSparqlService;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

/** Executes bounded, read-only SPARQL queries for MCP clients. */
public class SparqlQueryTool extends RdfMcpTool<SparqlQueryTool.Result> {

  private static final int DEFAULT_MAX_BYTES = 1024 * 1024;
  private static final int HARD_MAX_BYTES = 16 * 1024 * 1024;
  private static final int MIN_MAX_BYTES = 1024;

  public SparqlQueryTool() {
    super();
  }

  SparqlQueryTool(Supplier<RdfRepository> repositorySupplier) {
    super(repositorySupplier);
  }

  public record Result(
      String format, String queryType, String body, boolean truncated, int byteCount) {}

  @Override
  public Result execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    McpToolParameters parameters = McpToolParameters.from(params);
    String sparql = parameters.requiredString("query");
    RdfSparqlService.ReadQuery query = RdfSparqlService.ReadQuery.parse(sparql);
    RdfRepository repository = repository();
    String inferenceLevel = parameters.optionalString("inferenceLevel");
    int maxBytes =
        clamp(parameters.integer("maxBytes", DEFAULT_MAX_BYTES), MIN_MAX_BYTES, HARD_MAX_BYTES);
    RdfSparqlService.QueryResult queryResult =
        new RdfSparqlService(repository, new SparqlFederationGuard(repository.getConfig()))
            .query(query, parameters.optionalString("format"), inferenceLevel);
    BoundedBody body = BoundedBody.from(queryResult.body(), maxBytes);

    return new Result(
        queryResult.format(),
        query.parsed().queryType().toString(),
        body.value(),
        body.truncated(),
        body.byteCount());
  }

  private static int clamp(int value, int minimum, int maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }

  private record BoundedBody(String value, boolean truncated, int byteCount) {

    private BoundedBody {
      value = Objects.requireNonNullElse(value, "");
    }

    private static BoundedBody from(String response, int maxBytes) {
      byte[] bytes = Objects.requireNonNullElse(response, "").getBytes(StandardCharsets.UTF_8);
      int end = utf8Boundary(bytes, Math.min(bytes.length, maxBytes));
      return new BoundedBody(
          new String(bytes, 0, end, StandardCharsets.UTF_8), bytes.length > maxBytes, bytes.length);
    }

    private static int utf8Boundary(byte[] bytes, int proposedEnd) {
      int end = proposedEnd;
      while (end < bytes.length && end > 0 && (bytes[end] & 0xC0) == 0x80) {
        end--;
      }
      return end;
    }
  }
}
