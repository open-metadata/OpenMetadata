package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.context.ContextMemory;

/**
 * The probe's recall query was the whole of the cross-source dedup outage: the search layer ANDs a
 * bare query string, so the candidate's prose verbatim demanded every word occur in one stored
 * memory and reliably matched nothing. These tests pin the query's shape, which is the part that
 * decides whether the probe can return a hit at all.
 */
class SearchMemoryDuplicateProbeTest {

  private final SearchMemoryDuplicateProbe probe = new SearchMemoryDuplicateProbe();

  private ContextMemory candidate(String title, String question, String answer) {
    return new ContextMemory().withTitle(title).withQuestion(question).withAnswer(answer);
  }

  private List<String> clauses(String query) {
    return Arrays.asList(query.split(" OR "));
  }

  @Test
  void joinsWordsWithOrSoOneAbsentWordCannotZeroTheQuery() {
    String query =
        probe.probeQuery(
            candidate("Tier B Vendor Requirements", "What applies to Tier B vendors?", "SOC 2."));

    assertTrue(query.contains(" OR "), "AND semantics on a bare query string find nothing");
    assertFalse(query.contains("  "), "clauses must not be padded into empty terms");
    clauses(query).forEach(clause -> assertFalse(clause.isBlank(), "no empty OR clause"));
  }

  @Test
  void drawsOnlyOnTitleAndQuestion() {
    String query =
        probe.probeQuery(
            candidate("Retention Schedule", "How long are orders kept?", "Orders live ten years."));

    assertTrue(clauses(query).contains("retention"), "title words are recall signal");
    assertTrue(clauses(query).contains("orders"), "question words are recall signal");
    // The answer's generic prose dilutes ranking and pushed an exact duplicate out of the fetched
    // window, so it is deliberately not part of recall.
    assertFalse(clauses(query).contains("live"), "answer-only words must not enter the query");
    assertFalse(clauses(query).contains("ten"), "answer-only words must not enter the query");
  }

  @Test
  void tokenizesTheWayTheSimilarityGateDoes() {
    String query = probe.probeQuery(candidate("A GDPR Note", "Is it OK to keep PII?", null));

    // >= 3 chars, lowercased, deduplicated -- so recall and the gate agree on what a word is.
    assertEquals(clauses(query).stream().distinct().count(), clauses(query).size(), "no repeats");
    clauses(query)
        .forEach(
            clause -> {
              assertTrue(clause.length() >= 3, "short tokens are dropped: " + clause);
              assertEquals(clause.toLowerCase(), clause, "clauses are lowercased");
            });
    assertFalse(clauses(query).contains("it"), "two-character words are dropped");
  }

  @Test
  void stripsCharactersThatWouldBreakOrInjectIntoTheQuery() {
    String query =
        probe.probeQuery(
            candidate("Cost (2024): \"high\"", "Why did spend +40% / -10% go up?", null));

    // Tokenizing on non-word characters leaves only [A-Za-z0-9_] runs, so candidate text can
    // neither break the query nor smuggle in a lucene operator.
    clauses(query)
        .forEach(clause -> assertTrue(clause.matches("\\w+"), "unsafe clause: " + clause));
  }

  @Test
  void handlesACandidateWithNothingToSearchOn() {
    assertEquals("", probe.probeQuery(candidate(null, null, "an answer nobody asked for")));
    assertEquals("", probe.probeQuery(candidate("", "a b c", null)), "all words too short");
  }

  @Test
  void truncatesAnOverLongQueryAtAWholeClause() {
    StringBuilder question = new StringBuilder();
    for (int i = 0; i < 400; i++) {
      question.append("word").append(i).append(' ');
    }

    String query = probe.probeQuery(candidate("Title", question.toString(), null));

    assertTrue(query.length() <= 1000, "query stays within the search layer's budget");
    assertFalse(query.endsWith(" OR"), "never truncate mid-operator");
    assertFalse(query.endsWith(" "), "never leave a dangling separator");
    clauses(query).forEach(clause -> assertTrue(clause.matches("\\w+"), "whole clauses only"));
  }
}
