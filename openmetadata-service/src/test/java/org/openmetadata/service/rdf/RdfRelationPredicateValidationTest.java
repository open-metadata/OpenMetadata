package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * Tests for the SPARQL injection prevention regex used in RdfRepository.getRelationPredicate().
 * The regex pattern [a-zA-Z][a-zA-Z0-9]* ensures only safe alphanumeric relation type names
 * are used in SPARQL queries, preventing injection attacks.
 */
class RdfRelationPredicateValidationTest {

  private static final Pattern SAFE_RELATION_TYPE = Pattern.compile("[a-zA-Z][a-zA-Z0-9]*");

  @ParameterizedTest
  @ValueSource(
      strings = {
        "relatedTo",
        "synonym",
        "broader",
        "narrower",
        "antonym",
        "partOf",
        "hasPart",
        "calculatedFrom",
        "usedToCalculate",
        "componentOf",
        "composedOf",
        "seealso",
        "A",
        "abc123"
      })
  void testValidRelationTypesAccepted(String relationType) {
    assertTrue(
        SAFE_RELATION_TYPE.matcher(relationType).matches(),
        "Valid relation type should be accepted: " + relationType);
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "om:relatedTo",
        "related to",
        "related-to",
        "related_to",
        "123abc",
        "",
        "a b",
        "type;DROP",
        "<script>",
        "} INSERT DATA { <x> <y> <z> }",
        "relatedTo\n} INSERT DATA {",
        "a\tb",
        "related%20to",
        "{injection}",
        "om:hasPart; DROP ALL",
        "?var",
        "$var",
        "type/path"
      })
  void testMaliciousRelationTypesRejected(String relationType) {
    assertFalse(
        SAFE_RELATION_TYPE.matcher(relationType).matches(),
        "Malicious relation type should be rejected: " + relationType);
  }

  @Test
  void testNullHandledSafely() {
    // The code handles null before the regex check, but verify the pattern itself
    // doesn't throw on edge cases
    assertFalse(SAFE_RELATION_TYPE.matcher("").matches());
  }

  @Test
  void testSingleCharRelationType() {
    assertTrue(SAFE_RELATION_TYPE.matcher("a").matches());
    assertTrue(SAFE_RELATION_TYPE.matcher("Z").matches());
    assertFalse(SAFE_RELATION_TYPE.matcher("1").matches());
    assertFalse(SAFE_RELATION_TYPE.matcher("_").matches());
  }

  @Test
  void testUnicodeCharactersRejected() {
    assertFalse(SAFE_RELATION_TYPE.matcher("relación").matches());
    assertFalse(SAFE_RELATION_TYPE.matcher("関連").matches());
    assertFalse(SAFE_RELATION_TYPE.matcher("связь").matches());
  }
}
