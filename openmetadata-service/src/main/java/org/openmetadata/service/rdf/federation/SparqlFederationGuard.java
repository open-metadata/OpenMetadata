package org.openmetadata.service.rdf.federation;

import java.net.URI;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.jena.query.Query;
import org.apache.jena.query.QueryException;
import org.apache.jena.query.QueryFactory;
import org.apache.jena.sparql.syntax.ElementService;
import org.apache.jena.sparql.syntax.ElementSubQuery;
import org.apache.jena.sparql.syntax.ElementVisitorBase;
import org.apache.jena.sparql.syntax.ElementWalker;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.api.configuration.rdf.SparqlFederationConfig;

/**
 * Inspects an incoming SPARQL query for {@code SERVICE <uri>} clauses and rejects any whose
 * endpoint URI is not in the configured allowlist.
 *
 * <p>Detection uses Jena's {@link ElementWalker} so it sees only real SERVICE elements — the
 * keyword "SERVICE" inside a string literal or a comment is correctly ignored. The walker also
 * recurses into subqueries, OPTIONAL/UNION/MINUS branches, and nested SERVICE blocks.
 *
 * <p>Behavior:
 *
 * <ul>
 *   <li>Federation disabled (the default) — any SERVICE clause is a violation.
 *   <li>Federation enabled — a SERVICE clause must reference a URI present in
 *       {@code allowedEndpoints} verbatim.
 *   <li>Variable SERVICE endpoints ({@code SERVICE ?endpoint}) cannot be statically allowlisted
 *       and are always rejected.
 *   <li>Queries that fail to parse here are passed through; the SPARQL engine returns its own
 *       parse error to the caller, preserving message fidelity.
 * </ul>
 */
@Slf4j
public final class SparqlFederationGuard {

  private final boolean federationEnabled;
  private final Set<String> allowedEndpoints;

  public SparqlFederationGuard(RdfConfiguration config) {
    SparqlFederationConfig federation = config == null ? null : config.getFederation();
    this.federationEnabled = federation != null && Boolean.TRUE.equals(federation.getEnabled());
    this.allowedEndpoints =
        federation == null || federation.getAllowedEndpoints() == null
            ? Set.of()
            : federation.getAllowedEndpoints().stream()
                .map(URI::toString)
                .collect(Collectors.toUnmodifiableSet());
  }

  /** Visible for tests. Package-private constructor that takes the policy directly. */
  SparqlFederationGuard(boolean federationEnabled, Set<String> allowedEndpoints) {
    this.federationEnabled = federationEnabled;
    this.allowedEndpoints = allowedEndpoints == null ? Set.of() : Set.copyOf(allowedEndpoints);
  }

  /**
   * @return all distinct SERVICE endpoint URIs found in the query. Order of first appearance is
   *     preserved. Variable endpoints surface as the literal string {@code ?varname}.
   */
  public List<String> serviceEndpoints(String sparql) {
    Optional<Query> parsed = parseQuietly(sparql);
    if (parsed.isEmpty()) {
      return List.of();
    }
    EndpointCollector collector = new EndpointCollector();
    ElementWalker.walk(parsed.get().getQueryPattern(), collector);
    return List.copyOf(collector.endpoints);
  }

  /**
   * @return the first endpoint that violates the policy, or empty if the query is allowed.
   */
  public Optional<String> firstDisallowedEndpoint(String sparql) {
    for (String endpoint : serviceEndpoints(sparql)) {
      if (!isAllowed(endpoint)) {
        return Optional.of(endpoint);
      }
    }
    return Optional.empty();
  }

  /**
   * Convenience: throw {@link FederationDisallowedException} if any SERVICE clause is rejected.
   */
  public void enforce(String sparql) {
    Optional<String> blocked = firstDisallowedEndpoint(sparql);
    if (blocked.isPresent()) {
      throw new FederationDisallowedException(blocked.get(), federationEnabled, allowedEndpoints);
    }
  }

  private boolean isAllowed(String endpoint) {
    if (endpoint.startsWith("?")) {
      // Variable endpoints can't be statically allowlisted.
      return false;
    }
    if (!federationEnabled) {
      return false;
    }
    return allowedEndpoints.contains(endpoint);
  }

  private Optional<Query> parseQuietly(String sparql) {
    try {
      return Optional.ofNullable(QueryFactory.create(sparql));
    } catch (QueryException e) {
      LOG.debug(
          "SPARQL parse failed inside federation guard; deferring to engine: {}", e.getMessage());
      return Optional.empty();
    }
  }

  private static final class EndpointCollector extends ElementVisitorBase {
    private final Set<String> endpoints = new LinkedHashSet<>();

    @Override
    public void visit(ElementService el) {
      if (el.getServiceNode().isVariable()) {
        endpoints.add("?" + el.getServiceNode().getName());
      } else if (el.getServiceNode().isURI()) {
        endpoints.add(el.getServiceNode().getURI());
      }
    }

    @Override
    public void visit(ElementSubQuery el) {
      // ElementWalker stops at subquery boundaries; descend manually so a SERVICE inside an
      // inner SELECT still gets caught.
      if (el.getQuery() != null && el.getQuery().getQueryPattern() != null) {
        ElementWalker.walk(el.getQuery().getQueryPattern(), this);
      }
    }
  }

  /**
   * Thrown by {@link #enforce(String)} when a query references a disallowed endpoint. Carries the
   * effective policy so callers can include it in the error response.
   */
  public static final class FederationDisallowedException extends RuntimeException {

    private final String blockedEndpoint;
    private final boolean federationEnabled;
    private final Set<String> allowedEndpoints;

    FederationDisallowedException(
        String blockedEndpoint, boolean federationEnabled, Set<String> allowedEndpoints) {
      super(buildMessage(blockedEndpoint, federationEnabled, allowedEndpoints));
      this.blockedEndpoint = blockedEndpoint;
      this.federationEnabled = federationEnabled;
      this.allowedEndpoints = Collections.unmodifiableSet(allowedEndpoints);
    }

    public String getBlockedEndpoint() {
      return blockedEndpoint;
    }

    public boolean isFederationEnabled() {
      return federationEnabled;
    }

    public Set<String> getAllowedEndpoints() {
      return allowedEndpoints;
    }

    private static String buildMessage(
        String endpoint, boolean federationEnabled, Set<String> allowedEndpoints) {
      if (!federationEnabled) {
        return "SPARQL SERVICE clause references "
            + endpoint
            + " but federated SPARQL is disabled. "
            + "Enable rdf.federation.enabled and add the endpoint to rdf.federation.allowedEndpoints.";
      }
      return "SPARQL SERVICE clause references "
          + endpoint
          + " which is not in the allowlist. Allowed endpoints: "
          + allowedEndpoints;
    }
  }
}
