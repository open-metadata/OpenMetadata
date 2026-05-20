package org.openmetadata.service.rdf.insights;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.apache.jena.query.Query;
import org.apache.jena.query.QueryFactory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class RecommendationsQueryBuilderTest {

  private static final String URI = "https://open-metadata.org/instance/Table/abc";

  @Nested
  @DisplayName("Input validation")
  class InputValidation {

    @Test
    @DisplayName("Bad URI is rejected before SPARQL is generated")
    void badUri() {
      assertThrows(
          IllegalArgumentException.class, () -> RecommendationsQueryBuilder.build(null, 10));
      assertThrows(
          IllegalArgumentException.class, () -> RecommendationsQueryBuilder.build("   ", 10));
      assertThrows(
          IllegalArgumentException.class,
          () -> RecommendationsQueryBuilder.build("ftp://x.com/y", 10));
      assertThrows(
          IllegalArgumentException.class,
          () -> RecommendationsQueryBuilder.build("http://x.com/y> ; DROP", 10));
    }

    @Test
    @DisplayName("Limit below 1 is clamped to 1")
    void limitClampedLow() {
      String sparql = RecommendationsQueryBuilder.build(URI, -10);
      assertTrue(sparql.endsWith("LIMIT 1"));
    }

    @Test
    @DisplayName("Limit above MAX_LIMIT is clamped down")
    void limitClampedHigh() {
      String sparql = RecommendationsQueryBuilder.build(URI, 9999);
      assertTrue(sparql.endsWith("LIMIT " + RecommendationsQueryBuilder.MAX_LIMIT));
    }
  }

  @Nested
  @DisplayName("SPARQL well-formedness")
  class WellFormed {

    @Test
    @DisplayName("Generated query parses with Jena and selects the expected vars")
    void parses() {
      Query q = QueryFactory.create(RecommendationsQueryBuilder.build(URI, 10));
      assertTrue(q.isSelectType());
      assertTrue(q.getResultVars().contains("candidate"));
      assertTrue(q.getResultVars().contains("tagOverlap"));
      assertTrue(q.getResultVars().contains("glossaryOverlap"));
      assertTrue(q.getResultVars().contains("lineageOverlap"));
      assertTrue(q.getResultVars().contains("score"));
    }

    @Test
    @DisplayName("Lineage neighbour predicates cover both directions and the prov inverse")
    void lineagePredicates() {
      String sparql = RecommendationsQueryBuilder.build(URI, 10);
      assertTrue(sparql.contains("om:upstream"));
      assertTrue(sparql.contains("om:downstream"));
      assertTrue(sparql.contains("prov:wasDerivedFrom"));
      assertTrue(sparql.contains("^prov:wasDerivedFrom"));
    }

    @Test
    @DisplayName("Score formula uses the documented weights and adds three terms")
    void scoreFormula() {
      String sparql = RecommendationsQueryBuilder.build(URI, 10);
      assertTrue(sparql.contains(Double.toString(RecommendationsQueryBuilder.WEIGHT_TAG)));
      assertTrue(sparql.contains(Double.toString(RecommendationsQueryBuilder.WEIGHT_GLOSSARY)));
      assertTrue(sparql.contains(Double.toString(RecommendationsQueryBuilder.WEIGHT_LINEAGE)));
      assertTrue(sparql.contains("ORDER BY DESC(?score)"));
    }

    @Test
    @DisplayName("Each sub-SELECT excludes the seed itself")
    void excludesSeed() {
      String sparql = RecommendationsQueryBuilder.build(URI, 10);
      long filterCount =
          sparql
              .lines()
              .filter(line -> line.contains("FILTER(?candidate != <" + URI + ">)"))
              .count();
      assertTrue(filterCount >= 3, "All three sub-SELECTs must filter out the seed itself");
    }

    @Test
    @DisplayName("Outer GROUP BY/SUM combines per-dimension partial counts")
    void groupBySum() {
      String sparql = RecommendationsQueryBuilder.build(URI, 10);
      assertTrue(sparql.contains("SUM(?t)"));
      assertTrue(sparql.contains("SUM(?g)"));
      assertTrue(sparql.contains("SUM(?l)"));
      assertTrue(sparql.contains("GROUP BY ?candidate"));
    }
  }
}
