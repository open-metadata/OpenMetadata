package org.openmetadata.service.rdf.insights;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.apache.jena.query.Query;
import org.apache.jena.query.QueryFactory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Tests for {@link ImportanceQueryBuilder}. Covers:
 *
 * <ol>
 *   <li>Input validation — bad entityType / window / limit must be rejected, not sanitized
 *       silently.
 *   <li>SPARQL well-formedness — every produced query must parse with Jena (catches typos in
 *       string interpolation).
 *   <li>Score formula — the projected SELECT contains the right predicates and the BIND for
 *       score blends usage and downstream count with the right weights.
 * </ol>
 */
class ImportanceQueryBuilderTest {

  @Nested
  @DisplayName("Input validation")
  class InputValidation {

    @Test
    @DisplayName("Null entityType is rejected")
    void nullEntityType() {
      assertThrows(
          IllegalArgumentException.class, () -> ImportanceQueryBuilder.build(null, "daily", 10));
    }

    @Test
    @DisplayName("Blank entityType is rejected")
    void blankEntityType() {
      assertThrows(
          IllegalArgumentException.class, () -> ImportanceQueryBuilder.build("   ", "daily", 10));
    }

    @Test
    @DisplayName("Non-alphanumeric entityType is rejected (defends against SPARQL injection)")
    void injectionAttemptRejected() {
      assertThrows(
          IllegalArgumentException.class,
          () -> ImportanceQueryBuilder.build("table> ; DROP --", "daily", 10));
      assertThrows(
          IllegalArgumentException.class,
          () -> ImportanceQueryBuilder.build("table OR 1=1", "daily", 10));
      assertThrows(
          IllegalArgumentException.class,
          () -> ImportanceQueryBuilder.build("ta'ble", "daily", 10));
    }

    @Test
    @DisplayName("Unknown window is rejected")
    void unknownWindow() {
      assertThrows(
          IllegalArgumentException.class,
          () -> ImportanceQueryBuilder.build("table", "yearly", 10));
    }

    @Test
    @DisplayName("Window is normalized to lowercase")
    void windowLowercased() {
      String q = ImportanceQueryBuilder.build("table", "DAILY", 10);
      assertTrue(q.contains("usageDailyPercentile"));
    }

    @Test
    @DisplayName("Empty / null window defaults to daily")
    void windowDefaults() {
      String q1 = ImportanceQueryBuilder.build("table", null, 10);
      String q2 = ImportanceQueryBuilder.build("table", "", 10);
      assertTrue(q1.contains("usageDailyPercentile"));
      assertTrue(q2.contains("usageDailyPercentile"));
    }

    @Test
    @DisplayName("Limit below 1 is clamped to 1")
    void limitClampedLow() {
      String q = ImportanceQueryBuilder.build("table", "daily", -5);
      assertTrue(q.endsWith("LIMIT 1"), "Got: " + q);
    }

    @Test
    @DisplayName("Limit above 100 is clamped to 100")
    void limitClampedHigh() {
      String q = ImportanceQueryBuilder.build("table", "daily", 9999);
      assertTrue(q.endsWith("LIMIT 100"));
    }

    @Test
    @DisplayName("Default limit is 20")
    void defaultLimit() {
      assertEquals(20, ImportanceQueryBuilder.DEFAULT_LIMIT);
    }
  }

  @Nested
  @DisplayName("Class-name capitalization")
  class ClassCapitalization {

    @Test
    @DisplayName("entityType is capitalized to match the OWL class")
    void capitalize() {
      assertTrue(ImportanceQueryBuilder.build("table", "daily", 10).contains("a om:Table"));
      assertTrue(ImportanceQueryBuilder.build("dashboard", "daily", 10).contains("a om:Dashboard"));
      assertTrue(ImportanceQueryBuilder.build("pipeline", "daily", 10).contains("a om:Pipeline"));
    }

    @Test
    @DisplayName("Already-capitalized entityType stays capitalized")
    void alreadyCapitalized() {
      assertTrue(ImportanceQueryBuilder.build("Table", "daily", 10).contains("a om:Table"));
    }
  }

  @Nested
  @DisplayName("SPARQL well-formedness")
  class WellFormed {

    @Test
    @DisplayName("Generated query parses as a valid SPARQL Query (Jena)")
    void parsesWithJena() {
      Query q = QueryFactory.create(ImportanceQueryBuilder.build("table", "daily", 20));
      assertTrue(q.isSelectType(), "Expected SELECT query");
      assertTrue(q.getResultVars().contains("entity"));
      assertTrue(q.getResultVars().contains("score"));
      assertTrue(q.getResultVars().contains("usagePct"));
      assertTrue(q.getResultVars().contains("downstreamCount"));
    }

    @Test
    @DisplayName("Generated query uses ORDER BY DESC(score)")
    void orderByScore() {
      String body = ImportanceQueryBuilder.build("table", "daily", 20);
      assertTrue(body.contains("ORDER BY DESC(?score)"), "Got: " + body);
    }
  }

  @Nested
  @DisplayName("Score formula")
  class ScoreFormula {

    @Test
    @DisplayName("Score blends usage (0.6) and downstream (0.4) with centrality reserved at 0.0")
    void weightsExpressed() {
      String body = ImportanceQueryBuilder.build("table", "daily", 20);
      assertTrue(body.contains("0.6 * ?usageNorm"), "Got: " + body);
      assertTrue(body.contains("0.4 * ?downstreamNorm"), "Got: " + body);
      assertTrue(
          body.contains("0.0 * ?centralityNorm"),
          "Centrality term must be reserved at 0.0 until 3.1.b ships its PageRank fallback");
    }

    @Test
    @DisplayName("Usage percentile is divided by 100 to land in 0-1")
    void usageNormalizedTo01() {
      assertTrue(
          ImportanceQueryBuilder.build("table", "daily", 20)
              .contains("COALESCE(?usagePct, 0.0) / 100.0"));
    }

    @Test
    @DisplayName("Downstream count is normalized by max-downstream-count via subquery")
    void downstreamNormalizedByMax() {
      String body = ImportanceQueryBuilder.build("table", "daily", 20);
      assertTrue(body.contains("MAX(?dc) AS ?maxDownstream"));
      assertTrue(body.contains("xsd:double(?downstreamCount) / xsd:double(?maxDownstream)"));
      assertTrue(
          body.contains("IF(?maxDownstream > 0,"),
          "Must guard against division by zero when no entity has downstream lineage");
    }
  }

  @Nested
  @DisplayName("Window selection")
  class WindowSelection {

    @Test
    @DisplayName("daily window queries usageDailyPercentile")
    void daily() {
      assertTrue(
          ImportanceQueryBuilder.build("table", "daily", 20)
              .contains("om:usageDailyPercentile ?usagePct"));
    }

    @Test
    @DisplayName("weekly window queries usageWeeklyPercentile")
    void weekly() {
      assertTrue(
          ImportanceQueryBuilder.build("table", "weekly", 20)
              .contains("om:usageWeeklyPercentile ?usagePct"));
    }

    @Test
    @DisplayName("monthly window queries usageMonthlyPercentile")
    void monthly() {
      assertTrue(
          ImportanceQueryBuilder.build("table", "monthly", 20)
              .contains("om:usageMonthlyPercentile ?usagePct"));
    }
  }
}
