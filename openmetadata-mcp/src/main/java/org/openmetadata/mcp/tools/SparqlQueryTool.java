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

import com.fasterxml.jackson.annotation.JsonInclude;
import java.io.IOException;
import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.RdfSparqlService;
import org.openmetadata.service.rdf.SparqlQueryExecutionGuard;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

/** Executes bounded, read-only SPARQL queries for MCP clients. */
public class SparqlQueryTool extends RdfMcpTool<SparqlQueryTool.Result> {

  /**
   * Default and ceiling both come from the dispatch-level budget rather than a standalone megabyte
   * figure. The previous 1 MiB default and 16 MiB ceiling were 10x and 160x the dispatch cap, so a
   * large SELECT was executed and paid for in full, then discarded wholesale by {@code
   * DefaultToolContext.applyBudget} and replaced with a data-less truncation stub. See {@link
   * RdfBody}. {@code maxBytes} can therefore only narrow the response, never widen it.
   */
  private static final int DEFAULT_MAX_BYTES = RdfBody.MAX_BYTES;

  private static final int HARD_MAX_BYTES = RdfBody.MAX_BYTES;
  private static final int MIN_MAX_BYTES = RdfBody.MIN_BYTES;
  private final GuardedQueryExecutor guardedQueryExecutor;

  public SparqlQueryTool() {
    super();
    guardedQueryExecutor = SparqlQueryExecutionGuard.shared()::execute;
  }

  SparqlQueryTool(Supplier<RdfRepository> repositorySupplier) {
    this(repositorySupplier, SparqlQueryExecutionGuard.shared()::execute);
  }

  SparqlQueryTool(
      Supplier<RdfRepository> repositorySupplier, GuardedQueryExecutor guardedQueryExecutor) {
    super(repositorySupplier);
    this.guardedQueryExecutor = Objects.requireNonNull(guardedQueryExecutor);
  }

  /**
   * {@code warning} carries {@link RdfSparqlService.QueryResult#warning()} - set when the requested
   * inference level was not actually applied because the graph exceeded {@code
   * maxInMemoryInferenceTriples}. The REST endpoint surfaces this as the {@code OM-Inference-Warning}
   * header; dropping it here meant an {@code inferenceLevel: "owl"} call silently returned
   * un-inferred results that looked authoritative. Null when the query ran as asked.
   */
  @JsonInclude(JsonInclude.Include.NON_NULL)
  public record Result(
      String format,
      String queryType,
      String body,
      boolean truncated,
      int byteCount,
      String warning) {}

  @Override
  protected Result executeAuthorized(
      final CatalogSecurityContext securityContext, final Map<String, Object> params)
      throws IOException {
    McpToolParameters parameters = McpToolParameters.from(params);
    String sparql = parameters.requiredString("query");
    RdfSparqlService.ReadQuery query = RdfSparqlService.ReadQuery.parse(sparql);
    RdfRepository repository = repository();
    String inferenceLevel = parameters.optionalString("inferenceLevel");
    int maxBytes =
        RdfBody.clamp(
            parameters.integer("maxBytes", DEFAULT_MAX_BYTES), MIN_MAX_BYTES, HARD_MAX_BYTES);
    RdfSparqlService sparqlService =
        new RdfSparqlService(repository, new SparqlFederationGuard(repository.getConfig()));
    RdfSparqlService.QueryResult queryResult =
        guardedQueryExecutor.execute(
            CommonUtils.principal(securityContext),
            () -> sparqlService.query(query, parameters.optionalString("format"), inferenceLevel));
    RdfBody.Bounded body = RdfBody.bound(queryResult.body(), maxBytes);

    return new Result(
        queryResult.format(),
        query.parsed().queryType().toString(),
        body.value(),
        body.truncated(),
        body.byteCount(),
        queryResult.warning());
  }

  @FunctionalInterface
  interface GuardedQueryExecutor {
    RdfSparqlService.QueryResult execute(
        String principal, Supplier<RdfSparqlService.QueryResult> query);
  }
}
