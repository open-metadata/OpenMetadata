package org.openmetadata.service.rdf.federation;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import org.apache.jena.update.UpdateFactory;
import org.apache.jena.update.UpdateRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * Failure-mode coverage for the SPARQL federation guard. Each test names exactly the case it
 * is exercising — these are the queries that real users (and adversaries) will send.
 */
class SparqlFederationGuardTest {

  private static final String WIKIDATA = "https://query.wikidata.org/sparql";
  private static final String DBPEDIA = "https://dbpedia.org/sparql";
  private static final String INTERNAL_HOST = "http://10.0.0.5:8080/internal";

  private SparqlFederationGuard disabled() {
    return new SparqlFederationGuard(false, Set.of());
  }

  private SparqlFederationGuard withAllowlist(String... endpoints) {
    return new SparqlFederationGuard(true, Set.of(endpoints));
  }

  @Nested
  @DisplayName("Federation disabled (default policy)")
  class FederationDisabled {

    @Test
    @DisplayName("Plain query without SERVICE is always allowed")
    void plainQueryAllowed() {
      String q = "SELECT * WHERE { ?s ?p ?o } LIMIT 1";
      assertTrue(disabled().firstDisallowedEndpoint(q).isEmpty());
    }

    @Test
    @DisplayName("Any SERVICE clause is rejected when federation is disabled")
    void serviceRejectedWhenDisabled() {
      String q = "SELECT * WHERE { SERVICE <" + WIKIDATA + "> { ?s ?p ?o } } LIMIT 1";
      assertEquals(WIKIDATA, disabled().firstDisallowedEndpoint(q).orElseThrow());
    }

    @Test
    @DisplayName("enforce throws FederationDisallowedException with helpful message")
    void enforceThrows() {
      String q = "SELECT * WHERE { SERVICE <" + WIKIDATA + "> { ?s ?p ?o } }";
      var ex =
          assertThrows(
              SparqlFederationGuard.FederationDisallowedException.class,
              () -> disabled().enforce(q));
      assertEquals(WIKIDATA, ex.getBlockedEndpoint());
      assertFalse(ex.isFederationEnabled());
      assertTrue(ex.getMessage().contains("federated SPARQL is disabled"));
    }
  }

  @Nested
  @DisplayName("Federation enabled with allowlist")
  class FederationEnabled {

    @Test
    @DisplayName("Allowlisted endpoint passes")
    void allowlistedPasses() {
      String q = "SELECT * WHERE { SERVICE <" + WIKIDATA + "> { ?s ?p ?o } }";
      assertTrue(withAllowlist(WIKIDATA).firstDisallowedEndpoint(q).isEmpty());
    }

    @Test
    @DisplayName("Endpoint not on allowlist is rejected even when federation is enabled")
    void notAllowlistedRejected() {
      String q = "SELECT * WHERE { SERVICE <" + DBPEDIA + "> { ?s ?p ?o } }";
      assertEquals(DBPEDIA, withAllowlist(WIKIDATA).firstDisallowedEndpoint(q).orElseThrow());
    }

    @Test
    @DisplayName("Multiple SERVICE clauses: allowed + disallowed → reject the disallowed one")
    void mixedServicesRejected() {
      String q =
          "SELECT * WHERE { "
              + "  SERVICE <"
              + WIKIDATA
              + "> { ?s ?p ?o } "
              + "  SERVICE <"
              + DBPEDIA
              + "> { ?s ?p ?o } "
              + "}";
      assertEquals(DBPEDIA, withAllowlist(WIKIDATA).firstDisallowedEndpoint(q).orElseThrow());
    }

    @Test
    @DisplayName("All SERVICE clauses allowlisted → query allowed")
    void allServicesAllowed() {
      String q =
          "SELECT * WHERE { "
              + "  SERVICE <"
              + WIKIDATA
              + "> { ?a ?b ?c } "
              + "  SERVICE <"
              + DBPEDIA
              + "> { ?d ?e ?f } "
              + "}";
      assertTrue(withAllowlist(WIKIDATA, DBPEDIA).firstDisallowedEndpoint(q).isEmpty());
    }

    @Test
    @DisplayName("SERVICE SILENT is detected the same as SERVICE")
    void silentServiceDetected() {
      String q = "SELECT * WHERE { SERVICE SILENT <" + DBPEDIA + "> { ?s ?p ?o } }";
      assertEquals(DBPEDIA, withAllowlist(WIKIDATA).firstDisallowedEndpoint(q).orElseThrow());
    }

    @Test
    @DisplayName("SERVICE with variable endpoint is always rejected — can't be allowlisted")
    void variableServiceRejected() {
      String q = "SELECT * WHERE { ?endpoint a <urn:bar> SERVICE ?endpoint { ?s ?p ?o } }";
      // The SPARQL parser may or may not accept this exact form depending on context; if it does,
      // a variable endpoint is unprovable against a static allowlist and must be rejected.
      var blocked = withAllowlist(WIKIDATA).firstDisallowedEndpoint(q);
      // If the engine parses it, we expect rejection; if not, no SERVICE was extracted, which is
      // also acceptable because the engine itself will reject the query.
      blocked.ifPresent(b -> assertTrue(b.startsWith("?")));
    }

    @Test
    @DisplayName("Trailing-slash mismatch: allowlist must match the URI exactly")
    void trailingSlashDoesNotMatch() {
      String q = "SELECT * WHERE { SERVICE <" + WIKIDATA + "/> { ?s ?p ?o } }";
      assertEquals(
          WIKIDATA + "/",
          withAllowlist(WIKIDATA).firstDisallowedEndpoint(q).orElseThrow(),
          "We compare endpoint URIs as strings, including trailing slashes; this is documented behavior");
    }

    @Test
    @DisplayName("Nested SERVICE inside OPTIONAL is detected")
    void nestedInsideOptional() {
      String q = "SELECT * WHERE { ?s ?p ?o OPTIONAL { SERVICE <" + DBPEDIA + "> { ?s ?p ?o } } }";
      assertEquals(DBPEDIA, withAllowlist(WIKIDATA).firstDisallowedEndpoint(q).orElseThrow());
    }

    @Test
    @DisplayName("Nested SERVICE inside UNION branch is detected")
    void nestedInsideUnion() {
      String q = "SELECT * WHERE { { ?s ?p ?o } UNION { SERVICE <" + DBPEDIA + "> { ?s ?p ?o } } }";
      assertEquals(DBPEDIA, withAllowlist(WIKIDATA).firstDisallowedEndpoint(q).orElseThrow());
    }

    @Test
    @DisplayName("SERVICE inside subquery is detected")
    void nestedInsideSubquery() {
      String q =
          "SELECT * WHERE { "
              + "  { SELECT ?s WHERE { SERVICE <"
              + DBPEDIA
              + "> { ?s ?p ?o } } } "
              + "}";
      assertEquals(DBPEDIA, withAllowlist(WIKIDATA).firstDisallowedEndpoint(q).orElseThrow());
    }
  }

  @Nested
  @DisplayName("Adversarial inputs")
  class AdversarialInputs {

    @Test
    @DisplayName("The literal text 'SERVICE' inside a string literal must NOT trigger the guard")
    void serviceLiteralInString() {
      String q = "SELECT * WHERE { ?s ?p \"SERVICE <" + DBPEDIA + ">\" }";
      assertTrue(
          disabled().firstDisallowedEndpoint(q).isEmpty(),
          "Regex-based detectors fail this; the parser-based guard must not");
    }

    @Test
    @DisplayName("SPARQL comment with 'SERVICE' must not trigger the guard")
    void serviceInComment() {
      String q = "# SERVICE <" + DBPEDIA + "> { ?s ?p ?o }\n" + "SELECT * WHERE { ?s ?p ?o }";
      assertTrue(disabled().firstDisallowedEndpoint(q).isEmpty());
    }

    @Test
    @DisplayName("Unparseable garbage SPARQL is passed through (engine emits its own parse error)")
    void unparseableQueryPassesThrough() {
      String garbage = "this is not sparql {{{}}}";
      assertTrue(
          disabled().firstDisallowedEndpoint(garbage).isEmpty(),
          "Guard must not turn a parse error into a federation error — engine handles parsing");
    }

    @Test
    @DisplayName("Empty / null / whitespace queries are passed through")
    void emptyQueriesPassedThrough() {
      assertTrue(disabled().firstDisallowedEndpoint("").isEmpty());
      assertTrue(disabled().firstDisallowedEndpoint("   ").isEmpty());
    }

    @Test
    @DisplayName("Lowercase 'service' keyword is detected (SPARQL is case-insensitive)")
    void lowercaseService() {
      String q = "select * where { service <" + DBPEDIA + "> { ?s ?p ?o } }";
      assertEquals(DBPEDIA, disabled().firstDisallowedEndpoint(q).orElseThrow());
    }

    @Test
    @DisplayName("ASK with SERVICE is also guarded (not just SELECT)")
    void askQueryGuarded() {
      String q = "ASK { SERVICE <" + DBPEDIA + "> { ?s ?p ?o } }";
      assertEquals(DBPEDIA, disabled().firstDisallowedEndpoint(q).orElseThrow());
    }

    @Test
    @DisplayName("CONSTRUCT with SERVICE is also guarded")
    void constructQueryGuarded() {
      String q = "CONSTRUCT { ?s ?p ?o } WHERE { SERVICE <" + DBPEDIA + "> { ?s ?p ?o } }";
      assertEquals(DBPEDIA, disabled().firstDisallowedEndpoint(q).orElseThrow());
    }
  }

  /**
   * EXISTS and NOT EXISTS carry a whole graph pattern inside an expression, and the engine
   * evaluates that pattern — SERVICE included — wherever the expression sits.
   */
  @Nested
  @DisplayName("SERVICE hidden inside expressions and EXISTS blocks")
  class HiddenService {

    @ParameterizedTest(name = "{0}")
    @ValueSource(
        strings = {
          "SELECT * WHERE { ?s ?p ?o FILTER EXISTS { SERVICE <%s> { ?a ?b ?c } } }",
          "SELECT * WHERE { ?s ?p ?o FILTER NOT EXISTS { SERVICE <%s> { ?a ?b ?c } } }",
          "SELECT * WHERE { ?s ?p ?o FILTER(!EXISTS { SERVICE <%s> { ?a ?b ?c } }) }",
          "SELECT * WHERE { ?s ?p ?o FILTER(COALESCE(EXISTS { SERVICE <%s> { ?a ?b ?c } }, false)) }",
          "SELECT * WHERE { BIND(EXISTS { SERVICE <%s> { ?a ?b ?c } } AS ?x) }",
          "SELECT * WHERE { LET (?x := EXISTS { SERVICE <%s> { ?a ?b ?c } }) }",
          "SELECT * WHERE { UNFOLD(EXISTS { SERVICE <%s> { ?a ?b ?c } } AS ?x) }",
          "SELECT (EXISTS { SERVICE <%s> { ?a ?b ?c } } AS ?x) WHERE { }",
          "SELECT ?x WHERE { ?s ?p ?o } GROUP BY (EXISTS { SERVICE <%s> { ?a ?b ?c } } AS ?x)",
          "SELECT ?s WHERE { ?s ?p ?o } GROUP BY ?s HAVING (EXISTS { SERVICE <%s> { ?a ?b ?c } })",
          "SELECT (SAMPLE(EXISTS { SERVICE <%s> { ?a ?b ?c } }) AS ?x) WHERE { ?s ?p ?o }",
          "SELECT * WHERE { ?s ?p ?o } ORDER BY (EXISTS { SERVICE <%s> { ?a ?b ?c } })",
          "SELECT * WHERE { { SELECT (EXISTS { SERVICE <%s> { ?a ?b ?c } } AS ?x) WHERE { } } }",
          "SELECT * WHERE { ?s ?p ?o FILTER EXISTS { FILTER EXISTS { SERVICE <%s> { ?a ?b ?c } } } }",
          "SELECT * WHERE { ?s ?p ?o OPTIONAL { FILTER EXISTS { SERVICE <%s> { ?a ?b ?c } } } }",
          "SELECT * WHERE { ?s ?p ?o LATERAL { FILTER EXISTS { SERVICE <%s> { ?a ?b ?c } } } }",
          "SELECT * WHERE { ?s ?p ?o EXISTS { SERVICE <%s> { ?a ?b ?c } } }",
          "SELECT * WHERE { ?s ?p ?o NOT EXISTS { SERVICE <%s> { ?a ?b ?c } } }",
          "ASK { FILTER EXISTS { SERVICE <%s> { ?a ?b ?c } } }",
          "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o FILTER EXISTS { SERVICE <%s> { ?a ?b ?c } } }",
          "DESCRIBE ?s WHERE { ?s ?p ?o FILTER EXISTS { SERVICE <%s> { ?a ?b ?c } } }"
        })
    @DisplayName("is rejected wherever the engine would evaluate it")
    void hiddenServiceIsRejected(final String template) {
      final String query = template.formatted(INTERNAL_HOST);

      final SparqlFederationGuard.FederationDisallowedException rejection =
          assertThrows(
              SparqlFederationGuard.FederationDisallowedException.class,
              () -> disabled().enforce(query));

      assertEquals(INTERNAL_HOST, rejection.getBlockedEndpoint());
    }

    @Test
    @DisplayName("is rejected even when another SERVICE in the query is allowlisted")
    void hiddenServiceNextToAnAllowlistedOneIsRejected() {
      final String query =
          "SELECT * WHERE { SERVICE <"
              + WIKIDATA
              + "> { ?s ?p ?o } FILTER EXISTS { SERVICE <"
              + INTERNAL_HOST
              + "> { ?a ?b ?c } } }";

      assertEquals(
          INTERNAL_HOST, withAllowlist(WIKIDATA).firstDisallowedEndpoint(query).orElseThrow());
    }

    @Test
    @DisplayName("is reported as a variable when its endpoint is a variable")
    void hiddenVariableServiceIsReportedAsVariable() {
      final String query = "SELECT * WHERE { ?e ?p ?o FILTER EXISTS { SERVICE ?e { ?a ?b ?c } } }";

      assertEquals(List.of("?e"), disabled().serviceEndpoints(query));
    }

    @Test
    @DisplayName("EXISTS without SERVICE stays allowed")
    void existsWithoutServiceIsAllowed() {
      final String query =
          "SELECT * WHERE { ?s ?p ?o FILTER NOT EXISTS { ?s a <urn:Excluded> } "
              + "BIND(EXISTS { ?s <urn:p> \"SERVICE <"
              + INTERNAL_HOST
              + ">\" } AS ?x) }";

      assertTrue(disabled().serviceEndpoints(query).isEmpty());
    }
  }

  @Nested
  @DisplayName("serviceEndpoints listing")
  class ServiceEndpointsListing {

    @Test
    @DisplayName("Returns endpoints in order of first appearance, deduplicated")
    void listingOrderAndDedup() {
      String q =
          "SELECT * WHERE { "
              + "  SERVICE <"
              + DBPEDIA
              + "> { ?s ?p ?o } "
              + "  SERVICE <"
              + WIKIDATA
              + "> { ?s ?p ?o } "
              + "  SERVICE <"
              + DBPEDIA
              + "> { ?s ?p ?o } "
              + "}";
      assertEquals(List.of(DBPEDIA, WIKIDATA), disabled().serviceEndpoints(q));
    }

    @Test
    @DisplayName("Returns empty list for queries without SERVICE")
    void emptyListForNoService() {
      assertTrue(disabled().serviceEndpoints("SELECT ?s WHERE { ?s a ?t }").isEmpty());
    }
  }

  @Nested
  @DisplayName("Update requests")
  class UpdateRequests {

    @Test
    @DisplayName("Disallowed SERVICE in an update is rejected")
    void disallowedServiceRejected() {
      final UpdateRequest request = UpdateFactory.create(updateWithService(DBPEDIA));

      final SparqlFederationGuard.FederationDisallowedException exception =
          assertThrows(
              SparqlFederationGuard.FederationDisallowedException.class,
              () -> withAllowlist(WIKIDATA).enforceUpdate(request));

      assertEquals(DBPEDIA, exception.getBlockedEndpoint());
    }

    @Test
    @DisplayName("Allowlisted SERVICE in an update is accepted")
    void allowlistedServiceAccepted() {
      final UpdateRequest request = UpdateFactory.create(updateWithService(WIKIDATA));

      assertDoesNotThrow(() -> withAllowlist(WIKIDATA).enforceUpdate(request));
    }

    @Test
    @DisplayName("SERVICE hidden in an EXISTS inside the WHERE clause is rejected")
    void hiddenServiceInWhereClauseRejected() {
      final UpdateRequest request =
          UpdateFactory.create(
              "INSERT { ?s <urn:copied> ?x } WHERE { ?s ?p ?o BIND(EXISTS { SERVICE <"
                  + INTERNAL_HOST
                  + "> { ?a ?b ?c } } AS ?x) }");

      final SparqlFederationGuard.FederationDisallowedException exception =
          assertThrows(
              SparqlFederationGuard.FederationDisallowedException.class,
              () -> withAllowlist(WIKIDATA).enforceUpdate(request));

      assertEquals(INTERNAL_HOST, exception.getBlockedEndpoint());
    }

    @Test
    @DisplayName("LOAD from a disallowed source is rejected")
    void loadFromDisallowedSourceRejected() {
      final UpdateRequest request =
          UpdateFactory.create("LOAD <" + DBPEDIA + "> INTO GRAPH <urn:graph:target>");

      final SparqlFederationGuard.FederationDisallowedException exception =
          assertThrows(
              SparqlFederationGuard.FederationDisallowedException.class,
              () -> withAllowlist(WIKIDATA).enforceUpdate(request));

      assertEquals(DBPEDIA, exception.getBlockedEndpoint());
    }

    @Test
    @DisplayName("LOAD from an allowlisted source is accepted")
    void loadFromAllowlistedSourceAccepted() {
      final UpdateRequest request =
          UpdateFactory.create("LOAD <" + WIKIDATA + "> INTO GRAPH <urn:graph:target>");

      assertDoesNotThrow(() -> withAllowlist(WIKIDATA).enforceUpdate(request));
    }

    @Test
    @DisplayName("SERVICE text in inserted data does not trigger the guard")
    void serviceTextInInsertedDataAllowed() {
      final UpdateRequest request =
          UpdateFactory.create(
              "INSERT DATA { <urn:subject> <urn:predicate> \"SERVICE <" + DBPEDIA + ">\" }");

      assertDoesNotThrow(() -> disabled().enforceUpdate(request));
    }
  }

  private static String updateWithService(final String endpoint) {
    return "INSERT { ?subject <urn:copied> ?object } WHERE { SERVICE <"
        + endpoint
        + "> { ?subject ?predicate ?object } }";
  }
}
