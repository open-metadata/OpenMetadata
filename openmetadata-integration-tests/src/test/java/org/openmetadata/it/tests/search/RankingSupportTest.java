package org.openmetadata.it.tests.search;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Guards the two collision properties {@link RankingSupport#uniqueTerm()} must hold for the ranking
 * suite's controlled score-ties to stay exactly tied. Both have been broken before: first by hex
 * tokens matching the run-id in entity names, then by tokens derived from {@code
 * TestNamespace.uniqueShortId()}, which varies only in its last 4 of 16 characters and so shared a
 * 14-character prefix with every sibling token in the same test.
 *
 * <p>Either collision leaks a variable {@code *.ngram} contribution into scores the ranking cases
 * require to be equal, which silently inverts the tier-boost tie case.
 */
class RankingSupportTest {

  private static final int SAMPLE_SIZE = 200;
  private static final int MAX_SHARED_PREFIX = 8;

  @Test
  void uniqueTerm_containsNoHexCharacters() {
    for (int i = 0; i < SAMPLE_SIZE; i++) {
      String term = RankingSupport.uniqueTerm();
      assertTrue(
          term.chars().noneMatch(character -> Character.digit(character, 16) >= 0),
          "token must be hex-free or it ngram-matches the run-id in entity names: " + term);
    }
  }

  @Test
  void uniqueTerm_doesNotShareLongPrefixBetweenCalls() {
    List<String> terms = new ArrayList<>();
    for (int i = 0; i < SAMPLE_SIZE; i++) {
      terms.add(RankingSupport.uniqueTerm());
    }
    for (int i = 0; i < terms.size(); i++) {
      for (int j = i + 1; j < terms.size(); j++) {
        int shared = sharedPrefixLength(terms.get(i), terms.get(j));
        assertTrue(
            shared <= MAX_SHARED_PREFIX,
            "sibling tokens must not share a long prefix or they ngram-match each other: "
                + terms.get(i)
                + " / "
                + terms.get(j)
                + " share "
                + shared
                + " characters");
      }
    }
  }

  private static int sharedPrefixLength(String left, String right) {
    int shared = 0;
    while (shared < left.length()
        && shared < right.length()
        && left.charAt(shared) == right.charAt(shared)) {
      shared++;
    }
    return shared;
  }
}
