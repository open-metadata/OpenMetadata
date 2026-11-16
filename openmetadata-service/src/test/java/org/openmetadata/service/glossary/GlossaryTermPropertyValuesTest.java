package org.openmetadata.service.glossary;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.glossary.GlossaryTermPropertyTestFixtures.enumProperty;
import static org.openmetadata.service.glossary.GlossaryTermPropertyTestFixtures.property;

import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.type.GlossaryTermPropertyDatatype;

class GlossaryTermPropertyValuesTest {
  static Stream<Arguments> validValues() {
    return Stream.of(
        Arguments.of(GlossaryTermPropertyDatatype.STRING, "Payments team"),
        Arguments.of(GlossaryTermPropertyDatatype.INTEGER, "365"),
        Arguments.of(GlossaryTermPropertyDatatype.INTEGER, "-7"),
        Arguments.of(GlossaryTermPropertyDatatype.DECIMAL, "99.95"),
        Arguments.of(GlossaryTermPropertyDatatype.DECIMAL, "3"),
        Arguments.of(GlossaryTermPropertyDatatype.BOOLEAN, "true"),
        Arguments.of(GlossaryTermPropertyDatatype.BOOLEAN, "false"),
        Arguments.of(GlossaryTermPropertyDatatype.DATE, "2026-11-12"),
        Arguments.of(GlossaryTermPropertyDatatype.DATE_TIME, "2026-11-12T09:30:00Z"),
        Arguments.of(GlossaryTermPropertyDatatype.URL, "https://wiki.example.com/gdpr"),
        Arguments.of(GlossaryTermPropertyDatatype.URL, "http://localhost:8585/docs?x=1"));
  }

  static Stream<Arguments> invalidValues() {
    return Stream.of(
        Arguments.of(GlossaryTermPropertyDatatype.INTEGER, "abc"),
        Arguments.of(GlossaryTermPropertyDatatype.INTEGER, "1.5"),
        Arguments.of(GlossaryTermPropertyDatatype.DECIMAL, "1,5"),
        Arguments.of(GlossaryTermPropertyDatatype.BOOLEAN, "yes"),
        Arguments.of(GlossaryTermPropertyDatatype.BOOLEAN, "1"),
        Arguments.of(GlossaryTermPropertyDatatype.DATE, "12/11/2026"),
        Arguments.of(GlossaryTermPropertyDatatype.DATE, "2026-13-40"),
        Arguments.of(GlossaryTermPropertyDatatype.DATE_TIME, "2026-11-12"),
        Arguments.of(GlossaryTermPropertyDatatype.URL, "wiki.example.com"),
        Arguments.of(GlossaryTermPropertyDatatype.URL, "ftp://files.example.com/a"),
        Arguments.of(GlossaryTermPropertyDatatype.URL, "https://"),
        Arguments.of(GlossaryTermPropertyDatatype.URL, "javascript:alert(1)"),
        Arguments.of(GlossaryTermPropertyDatatype.URL, "https://exa mple.com"));
  }

  @ParameterizedTest
  @MethodSource("validValues")
  void acceptsValidLexicalForms(final GlossaryTermPropertyDatatype datatype, final String value) {
    assertEquals(
        Optional.empty(),
        GlossaryTermPropertyValues.problem(property("p", datatype), List.of(value)));
  }

  @ParameterizedTest
  @MethodSource("invalidValues")
  void rejectsInvalidLexicalForms(final GlossaryTermPropertyDatatype datatype, final String value) {
    final String reason =
        GlossaryTermPropertyValues.problem(property("p", datatype), List.of(value)).orElseThrow();
    assertTrue(reason.contains("property 'p'"), reason);
  }

  @Test
  void enumValueMustBeAllowed() {
    final var scope = enumProperty("scope", true, true, "GDPR", "CCPA");
    assertTrue(GlossaryTermPropertyValues.problem(scope, List.of("GDPR", "CCPA")).isEmpty());
    assertEquals(
        "Value 'HIPAA' is not a valid enum for property 'scope'",
        GlossaryTermPropertyValues.problem(scope, List.of("GDPR", "HIPAA")).orElseThrow());
  }

  @Test
  void singleValuedPropertyHoldsOneValue() {
    assertEquals(
        "Property 'days' holds at most 1 value, got 2",
        GlossaryTermPropertyValues.problem(
                property("days", GlossaryTermPropertyDatatype.INTEGER), List.of("1", "2"))
            .orElseThrow());
  }

  @Test
  void emptyListIsTheDeliberateNoValue() {
    assertTrue(
        GlossaryTermPropertyValues.problem(
                property("days", GlossaryTermPropertyDatatype.INTEGER), List.of())
            .isEmpty());
  }

  @Test
  void multiValuedPropertyHoldsAtMostOneHundredValues() {
    final var tags = property("tags", GlossaryTermPropertyDatatype.STRING).withMultiValued(true);
    assertTrue(
        GlossaryTermPropertyValues.problem(tags, java.util.Collections.nCopies(100, "a"))
            .isEmpty());
    assertEquals(
        "Property 'tags' holds at most 100 values, got 101",
        GlossaryTermPropertyValues.problem(tags, java.util.Collections.nCopies(101, "a"))
            .orElseThrow());
  }

  @Test
  void aValueHoldsAtMost2048Characters() {
    final var text = property("note", GlossaryTermPropertyDatatype.STRING);
    assertTrue(GlossaryTermPropertyValues.problem(text, List.of("a".repeat(2048))).isEmpty());
    assertTrue(GlossaryTermPropertyValues.problem(text, List.of("a".repeat(2049))).isPresent());
  }
}
