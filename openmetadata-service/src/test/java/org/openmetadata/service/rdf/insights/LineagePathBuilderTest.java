package org.openmetadata.service.rdf.insights;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.apache.jena.query.Query;
import org.apache.jena.query.QueryFactory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Tests for {@link LineagePathBuilder}. Covers:
 *
 * <ol>
 *   <li>Input validation — bad URI / hop / direction values must throw, not silently sanitize.
 *   <li>SPARQL well-formedness — every produced query must parse with Jena.
 *   <li>Predicate UNIONs change with direction so the caller can swap walk modes without
 *       branching elsewhere.
 * </ol>
 */
class LineagePathBuilderTest {

  @Nested
  @DisplayName("URI validation")
  class UriValidation {

    @Test
    @DisplayName("Null URI is rejected")
    void nullUri() {
      assertThrows(
          IllegalArgumentException.class, () -> LineagePathBuilder.validateNodeUri("from", null));
    }

    @Test
    @DisplayName("Blank URI is rejected")
    void blankUri() {
      assertThrows(
          IllegalArgumentException.class, () -> LineagePathBuilder.validateNodeUri("from", "   "));
    }

    @Test
    @DisplayName("Relative URI is rejected")
    void relativeUri() {
      assertThrows(
          IllegalArgumentException.class,
          () -> LineagePathBuilder.validateNodeUri("from", "/relative/path"));
    }

    @Test
    @DisplayName("Non-http scheme is rejected")
    void nonHttpScheme() {
      assertThrows(
          IllegalArgumentException.class,
          () -> LineagePathBuilder.validateNodeUri("from", "file:///etc/passwd"));
      assertThrows(
          IllegalArgumentException.class,
          () -> LineagePathBuilder.validateNodeUri("from", "ftp://example.com/x"));
    }

    @Test
    @DisplayName("URI with angle bracket is rejected (defense against SPARQL injection)")
    void angleBracketRejected() {
      assertThrows(
          IllegalArgumentException.class,
          () ->
              LineagePathBuilder.validateNodeUri(
                  "from", "https://example.com/x> ; DROP GRAPH <http://x"));
    }

    @Test
    @DisplayName("URI with newline is rejected")
    void newlineRejected() {
      assertThrows(
          IllegalArgumentException.class,
          () -> LineagePathBuilder.validateNodeUri("from", "https://x.com/y\nINSERT"));
    }

    @Test
    @DisplayName("Malformed URI is rejected")
    void malformedUri() {
      assertThrows(
          IllegalArgumentException.class,
          () -> LineagePathBuilder.validateNodeUri("from", "https://[badhost"));
    }

    @Test
    @DisplayName("Valid http(s) URIs are accepted and trimmed")
    void valid() {
      assertEquals(
          "https://open-metadata.org/instance/Table/abc",
          LineagePathBuilder.validateNodeUri(
              "from", "  https://open-metadata.org/instance/Table/abc  "));
      assertEquals(
          "http://localhost:3030/foo",
          LineagePathBuilder.validateNodeUri("from", "http://localhost:3030/foo"));
    }
  }

  @Nested
  @DisplayName("Direction parsing")
  class DirectionParsing {

    @Test
    @DisplayName("Defaults to upstream when null/blank")
    void defaultsToUpstream() {
      assertEquals(LineagePathBuilder.Direction.UPSTREAM, LineagePathBuilder.Direction.parse(null));
      assertEquals(LineagePathBuilder.Direction.UPSTREAM, LineagePathBuilder.Direction.parse(""));
      assertEquals(LineagePathBuilder.Direction.UPSTREAM, LineagePathBuilder.Direction.parse("  "));
    }

    @Test
    @DisplayName("Recognized values map case-insensitively")
    void recognized() {
      assertEquals(
          LineagePathBuilder.Direction.UPSTREAM, LineagePathBuilder.Direction.parse("UPSTREAM"));
      assertEquals(
          LineagePathBuilder.Direction.DOWNSTREAM,
          LineagePathBuilder.Direction.parse("Downstream"));
      assertEquals(LineagePathBuilder.Direction.BOTH, LineagePathBuilder.Direction.parse(" both "));
    }

    @Test
    @DisplayName("Unknown direction is rejected")
    void unknown() {
      assertThrows(
          IllegalArgumentException.class, () -> LineagePathBuilder.Direction.parse("sideways"));
    }
  }

  @Nested
  @DisplayName("Hop budget clamping")
  class HopBudgetClamping {

    @Test
    @DisplayName("Null and < 1 fall back to default")
    void defaults() {
      assertEquals(LineagePathBuilder.DEFAULT_MAX_HOPS, LineagePathBuilder.clampMaxHops(null));
      assertEquals(LineagePathBuilder.DEFAULT_MAX_HOPS, LineagePathBuilder.clampMaxHops(0));
      assertEquals(LineagePathBuilder.DEFAULT_MAX_HOPS, LineagePathBuilder.clampMaxHops(-9));
    }

    @Test
    @DisplayName("Values within [1, HARD_MAX_HOPS] are passed through")
    void passthrough() {
      assertEquals(1, LineagePathBuilder.clampMaxHops(1));
      assertEquals(7, LineagePathBuilder.clampMaxHops(7));
      assertEquals(
          LineagePathBuilder.HARD_MAX_HOPS,
          LineagePathBuilder.clampMaxHops(LineagePathBuilder.HARD_MAX_HOPS));
    }

    @Test
    @DisplayName("Values above HARD_MAX_HOPS are clamped down")
    void clampedHigh() {
      assertEquals(LineagePathBuilder.HARD_MAX_HOPS, LineagePathBuilder.clampMaxHops(9999));
    }
  }

  @Nested
  @DisplayName("Frontier SPARQL well-formedness")
  class FrontierSparql {

    @Test
    @DisplayName("Empty frontier is rejected before SPARQL is built")
    void emptyFrontier() {
      assertThrows(
          IllegalArgumentException.class,
          () -> LineagePathBuilder.frontierQuery(List.of(), LineagePathBuilder.Direction.UPSTREAM));
      assertThrows(
          IllegalArgumentException.class,
          () -> LineagePathBuilder.frontierQuery(null, LineagePathBuilder.Direction.UPSTREAM));
    }

    @Test
    @DisplayName("Bad URI in the frontier is rejected before SPARQL is built")
    void badFrontierUri() {
      assertThrows(
          IllegalArgumentException.class,
          () ->
              LineagePathBuilder.frontierQuery(
                  List.of("not a uri"), LineagePathBuilder.Direction.UPSTREAM));
    }

    @Test
    @DisplayName("Upstream query parses and contains both upstream predicates")
    void upstreamQueryParses() {
      String sparql =
          LineagePathBuilder.frontierQuery(
              List.of("https://x.com/a"), LineagePathBuilder.Direction.UPSTREAM);
      Query q = QueryFactory.create(sparql);
      assertTrue(q.isSelectType());
      assertTrue(q.getResultVars().contains("from"));
      assertTrue(q.getResultVars().contains("to"));
      assertTrue(q.getResultVars().contains("predicate"));
      assertTrue(sparql.contains("prov:wasDerivedFrom"));
      assertTrue(sparql.contains("om:upstream"));
    }

    @Test
    @DisplayName("Downstream query inverts prov:wasDerivedFrom")
    void downstreamInverts() {
      String sparql =
          LineagePathBuilder.frontierQuery(
              List.of("https://x.com/a"), LineagePathBuilder.Direction.DOWNSTREAM);
      QueryFactory.create(sparql);
      assertTrue(sparql.contains("?to prov:wasDerivedFrom ?from"));
      assertTrue(sparql.contains("om:downstream"));
      assertTrue(
          sparql.contains("\"^prov:wasDerivedFrom\""),
          "Inverted edge must be labelled as ^prov:wasDerivedFrom so callers can render direction");
    }

    @Test
    @DisplayName("Both direction emits all four predicate variants")
    void bothEmitsAll() {
      String sparql =
          LineagePathBuilder.frontierQuery(
              List.of("https://x.com/a"), LineagePathBuilder.Direction.BOTH);
      QueryFactory.create(sparql);
      assertTrue(sparql.contains("prov:wasDerivedFrom"));
      assertTrue(sparql.contains("om:upstream"));
      assertTrue(sparql.contains("om:downstream"));
      assertTrue(sparql.contains("^prov:wasDerivedFrom"));
    }

    @Test
    @DisplayName("Multi-node frontier produces VALUES with all URIs")
    void multiNodeValues() {
      String sparql =
          LineagePathBuilder.frontierQuery(
              List.of("https://x.com/a", "https://x.com/b", "https://x.com/c"),
              LineagePathBuilder.Direction.UPSTREAM);
      QueryFactory.create(sparql);
      assertTrue(sparql.contains("<https://x.com/a>"));
      assertTrue(sparql.contains("<https://x.com/b>"));
      assertTrue(sparql.contains("<https://x.com/c>"));
    }

    @Test
    @DisplayName("Self-loops are filtered out")
    void selfLoopsFiltered() {
      String sparql =
          LineagePathBuilder.frontierQuery(
              List.of("https://x.com/a"), LineagePathBuilder.Direction.UPSTREAM);
      assertTrue(
          sparql.contains("FILTER(?to != ?from)"),
          "Self-loops shouldn't pollute BFS — must be filtered server-side");
    }
  }

  @Nested
  @DisplayName("Types SPARQL")
  class TypesSparql {

    @Test
    @DisplayName("Empty input is rejected")
    void empty() {
      assertThrows(IllegalArgumentException.class, () -> LineagePathBuilder.typesQuery(List.of()));
      assertThrows(IllegalArgumentException.class, () -> LineagePathBuilder.typesQuery(null));
    }

    @Test
    @DisplayName("Only om: types are returned (filter is present)")
    void omFilter() {
      String sparql = LineagePathBuilder.typesQuery(List.of("https://x.com/a"));
      QueryFactory.create(sparql);
      assertTrue(sparql.contains("STRSTARTS"), "Must filter to om-namespaced types");
      assertTrue(sparql.contains("https://open-metadata.org/ontology/"));
    }
  }
}
