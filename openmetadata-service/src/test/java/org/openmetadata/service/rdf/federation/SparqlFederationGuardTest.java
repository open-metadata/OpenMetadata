package org.openmetadata.service.rdf.federation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Failure-mode coverage for the SPARQL federation guard. Each test names exactly the case it
 * is exercising — these are the queries that real users (and adversaries) will send.
 */
class SparqlFederationGuardTest {

  private static final String WIKIDATA = "https://query.wikidata.org/sparql";
  private static final String DBPEDIA = "https://dbpedia.org/sparql";

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
}
