package org.openmetadata.service.rdf.insights;

import static org.junit.jupiter.api.Assertions.assertTrue;

import org.apache.jena.query.Query;
import org.apache.jena.query.QueryFactory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class CoOccurrenceQueryBuilderTest {

  @Nested
  @DisplayName("Tag co-occurrence")
  class TagCoOccurrence {

    @Test
    @DisplayName("Generated query parses with Jena and selects the expected vars")
    void parses() {
      Query q = QueryFactory.create(CoOccurrenceQueryBuilder.tagCoOccurrence(2, 20));
      assertTrue(q.isSelectType());
      assertTrue(q.getResultVars().contains("tagA"));
      assertTrue(q.getResultVars().contains("tagB"));
      assertTrue(q.getResultVars().contains("count"));
    }

    @Test
    @DisplayName("Pairs are canonicalised so each pair appears once")
    void canonicalised() {
      String sparql = CoOccurrenceQueryBuilder.tagCoOccurrence(2, 20);
      assertTrue(
          sparql.contains("STR(?tagA) < STR(?tagB)"),
          "Without canonical pair filter (a, b) and (b, a) would each appear");
    }

    @Test
    @DisplayName("HAVING enforces the minimum count")
    void havingPresent() {
      String sparql = CoOccurrenceQueryBuilder.tagCoOccurrence(5, 20);
      assertTrue(sparql.contains("HAVING (COUNT(?entity) >= 5)"));
    }

    @Test
    @DisplayName("minCount below 1 is clamped to 1")
    void minCountClampedLow() {
      String sparql = CoOccurrenceQueryBuilder.tagCoOccurrence(-100, 10);
      assertTrue(sparql.contains("HAVING (COUNT(?entity) >= 1)"));
    }

    @Test
    @DisplayName("limit above MAX_LIMIT is clamped down")
    void limitClampedHigh() {
      String sparql = CoOccurrenceQueryBuilder.tagCoOccurrence(2, 9999);
      assertTrue(sparql.endsWith("LIMIT " + CoOccurrenceQueryBuilder.MAX_LIMIT));
    }

    @Test
    @DisplayName("limit below 1 is clamped to 1")
    void limitClampedLow() {
      String sparql = CoOccurrenceQueryBuilder.tagCoOccurrence(2, 0);
      assertTrue(sparql.endsWith("LIMIT 1"));
    }

    @Test
    @DisplayName("ORDER BY DESC(?count) is present")
    void orderByCount() {
      assertTrue(CoOccurrenceQueryBuilder.tagCoOccurrence(2, 20).contains("ORDER BY DESC(?count)"));
    }
  }

  @Nested
  @DisplayName("Glossary reach")
  class GlossaryReach {

    @Test
    @DisplayName("Generated query parses with Jena and counts DISTINCT domains")
    void parses() {
      Query q = QueryFactory.create(CoOccurrenceQueryBuilder.glossaryReach(2, 20));
      assertTrue(q.isSelectType());
      assertTrue(q.getResultVars().contains("term"));
      assertTrue(q.getResultVars().contains("domainCount"));
      String sparql = CoOccurrenceQueryBuilder.glossaryReach(2, 20);
      assertTrue(sparql.contains("COUNT(DISTINCT ?domain)"));
    }

    @Test
    @DisplayName("HAVING enforces minDomains floor; clamped values are used")
    void minDomainsClamped() {
      assertTrue(
          CoOccurrenceQueryBuilder.glossaryReach(-5, 20)
              .contains("HAVING (COUNT(DISTINCT ?domain) >= 1)"));
      assertTrue(
          CoOccurrenceQueryBuilder.glossaryReach(7, 20)
              .contains("HAVING (COUNT(DISTINCT ?domain) >= 7)"));
    }

    @Test
    @DisplayName("Joins om:hasGlossaryTerm with om:hasDomain on the same entity")
    void joinsCorrectly() {
      String sparql = CoOccurrenceQueryBuilder.glossaryReach(2, 20);
      assertTrue(sparql.contains("?entity om:hasGlossaryTerm ?term"));
      assertTrue(sparql.contains("?entity om:hasDomain ?domain"));
    }
  }

  @Nested
  @DisplayName("Tag popularity")
  class TagPopularity {

    @Test
    @DisplayName("Generated query parses, counts DISTINCT entities, no HAVING required")
    void parses() {
      Query q = QueryFactory.create(CoOccurrenceQueryBuilder.tagPopularity(20));
      assertTrue(q.isSelectType());
      assertTrue(q.getResultVars().contains("tag"));
      assertTrue(q.getResultVars().contains("entityCount"));
      String sparql = CoOccurrenceQueryBuilder.tagPopularity(20);
      assertTrue(sparql.contains("COUNT(DISTINCT ?entity)"));
    }

    @Test
    @DisplayName("limit clamping behaves like the other builders")
    void clamping() {
      assertTrue(CoOccurrenceQueryBuilder.tagPopularity(0).endsWith("LIMIT 1"));
      assertTrue(
          CoOccurrenceQueryBuilder.tagPopularity(9999)
              .endsWith("LIMIT " + CoOccurrenceQueryBuilder.MAX_LIMIT));
    }
  }
}
