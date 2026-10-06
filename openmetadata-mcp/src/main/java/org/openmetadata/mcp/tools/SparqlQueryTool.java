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
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;
import org.openmetadata.schema.api.rdf.AgentSparqlCompleteness;
import org.openmetadata.schema.api.rdf.AgentSparqlErrorCode;
import org.openmetadata.schema.api.rdf.RdfProjectionState;
import org.openmetadata.service.rdf.RdfProjectionStateResolver;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.RdfSparqlService;
import org.openmetadata.service.rdf.SparqlQueryExecutionGuard;
import org.openmetadata.service.rdf.agent.AgentSparqlAudit;
import org.openmetadata.service.rdf.agent.AgentSparqlCaller;
import org.openmetadata.service.rdf.agent.AgentSparqlException;
import org.openmetadata.service.rdf.agent.AgentSparqlResult;
import org.openmetadata.service.rdf.agent.AgentSparqlService;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

/**
 * Executes bounded, read-only SPARQL queries for MCP clients.
 *
 * <p>Administrators keep the full read surface. Every other caller who holds {@code
 * ExecuteSparqlQuery} runs through the same agent profile as {@code POST /v1/rdf/sparql/agent}:
 * SELECT only, no graph selection or federation, no inference, a ready projection, and an audit
 * event.
 */
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
  private static final String JSON_FORMAT = "json";
  private static final String NO_INFERENCE = "none";
  private static final String SELECT_QUERY_TYPE = "SELECT";
  private final GuardedQueryExecutor guardedQueryExecutor;
  private final Supplier<RdfProjectionState> projectionStateSupplier;

  public SparqlQueryTool() {
    super();
    guardedQueryExecutor = SparqlQueryExecutionGuard.shared()::execute;
    projectionStateSupplier = RdfProjectionStateResolver::resolveConfigured;
  }

  SparqlQueryTool(Supplier<RdfRepository> repositorySupplier) {
    this(repositorySupplier, SparqlQueryExecutionGuard.shared()::execute);
  }

  SparqlQueryTool(
      Supplier<RdfRepository> repositorySupplier, GuardedQueryExecutor guardedQueryExecutor) {
    this(repositorySupplier, guardedQueryExecutor, RdfProjectionStateResolver::resolveConfigured);
  }

  SparqlQueryTool(
      Supplier<RdfRepository> repositorySupplier,
      GuardedQueryExecutor guardedQueryExecutor,
      Supplier<RdfProjectionState> projectionStateSupplier) {
    super(repositorySupplier);
    this.guardedQueryExecutor = Objects.requireNonNull(guardedQueryExecutor);
    this.projectionStateSupplier = Objects.requireNonNull(projectionStateSupplier);
  }

  /**
   * {@code warning} carries {@link RdfSparqlService.QueryResult#warning()} - set when the requested
   * inference level was not actually applied because the graph exceeded {@code
   * maxInMemoryInferenceTriples}. The REST endpoint surfaces this as the {@code OM-Inference-Warning}
   * header; dropping it here meant an {@code inferenceLevel: "owl"} call silently returned
   * un-inferred results that looked authoritative. Null when the query ran as asked.
   *
   * <p>{@code completeness} is set only for non-administrators, whose body is the agent JSON. It is
   * repeated here because that JSON carries it at the end, where a bounded body cuts first.
   */
  @JsonInclude(JsonInclude.Include.NON_NULL)
  public record Result(
      String format,
      String queryType,
      String body,
      boolean truncated,
      int byteCount,
      String warning,
      Completeness completeness) {

    Result(
        String format,
        String queryType,
        String body,
        boolean truncated,
        int byteCount,
        String warning) {
      this(format, queryType, body, truncated, byteCount, warning, null);
    }
  }

  /** Whether the rows are every row the submitted query selects, and why not when they are not. */
  @JsonInclude(JsonInclude.Include.NON_NULL)
  public record Completeness(String status, String reason) {

    static Completeness of(final AgentSparqlCompleteness completeness) {
      return new Completeness(
          completeness.getStatus().value(),
          completeness.getReason() == null ? null : completeness.getReason().value());
    }
  }

  @Override
  protected Result executeAuthorized(
      final CatalogSecurityContext securityContext, final Map<String, Object> params)
      throws IOException {
    McpToolParameters parameters = McpToolParameters.from(params);
    String sparql = parameters.requiredString("query");
    return isAdministrator(securityContext)
        ? executeAsAdministrator(securityContext, parameters, sparql)
        : executeWithAgentProfile(securityContext, parameters, sparql);
  }

  /**
   * Resolves the caller the way {@code Authorizer#authorizeAdmin} does, so administrator status has
   * one definition. The permission check already ran, so this only picks the execution profile.
   */
  private static boolean isAdministrator(final CatalogSecurityContext securityContext) {
    return DefaultAuthorizer.getSubjectContext(securityContext).isAdmin();
  }

  private Result executeAsAdministrator(
      final CatalogSecurityContext securityContext,
      final McpToolParameters parameters,
      final String sparql) {
    RdfSparqlService.ReadQuery query = RdfSparqlService.ReadQuery.parse(sparql);
    RdfRepository repository = repository();
    String inferenceLevel = parameters.optionalString("inferenceLevel");
    int maxBytes = maxBytes(parameters);
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

  private Result executeWithAgentProfile(
      final CatalogSecurityContext securityContext,
      final McpToolParameters parameters,
      final String sparql) {
    RdfRepository repository = repository();
    AgentSparqlResult result =
        runAgentQuery(repository, requirePrincipal(securityContext), parameters, sparql);
    RdfBody.Bounded body =
        RdfBody.bound(new String(result.body(), StandardCharsets.UTF_8), maxBytes(parameters));

    return new Result(
        JSON_FORMAT,
        SELECT_QUERY_TYPE,
        body.value(),
        body.truncated(),
        body.byteCount(),
        null,
        Completeness.of(result.completeness()));
  }

  /**
   * The option check runs inside the audited call, so a permitted caller whose options are refused
   * leaves the same {@code agent_sparql_query} event as any other outcome.
   */
  private AgentSparqlResult runAgentQuery(
      final RdfRepository repository,
      final String principal,
      final McpToolParameters parameters,
      final String sparql) {
    AgentSparqlService service =
        AgentSparqlService.forRepository(() -> repository, projectionStateSupplier);
    try {
      return AgentSparqlAudit.record(
          AgentSparqlCaller.of(principal, null),
          () -> {
            requireAgentProfileOptions(parameters);
            return service.execute(principal, sparql);
          });
    } catch (AgentSparqlException failure) {
      throw AgentSparqlToolErrors.toToolException(failure);
    }
  }

  private static void requireAgentProfileOptions(final McpToolParameters parameters) {
    requireOption(parameters, "format", JSON_FORMAT);
    requireOption(parameters, "inferenceLevel", NO_INFERENCE);
  }

  private static void requireOption(
      final McpToolParameters parameters, final String name, final String allowed) {
    String requested = parameters.optionalString(name);
    if (!McpToolParameters.isBlank(requested)
        && !allowed.equals(requested.toLowerCase(Locale.ROOT))) {
      throw new AgentSparqlException(
          AgentSparqlErrorCode.QUERY_INVALID,
          "'%s' must be '%s' unless you are an administrator; got '%s'"
              .formatted(name, allowed, requested));
    }
  }

  private static String requirePrincipal(final CatalogSecurityContext securityContext) {
    if (securityContext.getUserPrincipal() == null) {
      throw new AuthorizationException("An authenticated principal is required");
    }
    return CommonUtils.principal(securityContext);
  }

  private static int maxBytes(final McpToolParameters parameters) {
    return RdfBody.clamp(
        parameters.integer("maxBytes", DEFAULT_MAX_BYTES), MIN_MAX_BYTES, HARD_MAX_BYTES);
  }

  @FunctionalInterface
  interface GuardedQueryExecutor {
    RdfSparqlService.QueryResult execute(
        String principal, Supplier<RdfSparqlService.QueryResult> query);
  }
}
