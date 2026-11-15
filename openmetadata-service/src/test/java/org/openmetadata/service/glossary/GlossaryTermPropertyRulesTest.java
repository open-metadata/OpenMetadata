package org.openmetadata.service.glossary;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.glossary.GlossaryTermPropertyTestFixtures.enumProperty;
import static org.openmetadata.service.glossary.GlossaryTermPropertyTestFixtures.property;
import static org.openmetadata.service.glossary.GlossaryTermPropertyTestFixtures.term;

import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.GlossaryTermProperty;
import org.openmetadata.schema.type.GlossaryTermPropertyDatatype;
import org.openmetadata.sdk.exception.WebServiceException;

class GlossaryTermPropertyRulesTest {
  private static final GlossaryTermPropertyDatatype STRING = GlossaryTermPropertyDatatype.STRING;
  private static final GlossaryTermPropertyDatatype INTEGER = GlossaryTermPropertyDatatype.INTEGER;

  private final GlossaryTerm customer =
      term(
          "G.Customer",
          List.of(
              enumProperty("regulatoryScope", true, true, "GDPR", "CCPA"),
              property("retentionDays", INTEGER).withInheritable(false)),
          Map.of("regulatoryScope", List.of("GDPR"), "retentionDays", List.of("365")));

  private static String badRequest(final List<GlossaryTermProperty> definitions) {
    return assertThrows(
            IllegalArgumentException.class,
            () -> GlossaryTermPropertyRules.validateDefinitions(definitions))
        .getMessage();
  }

  @ParameterizedTest
  @ValueSource(strings = {"a/b", "a~b", "a\"b", "a\\b", " leading", "-dash", "a*b", ""})
  void rejectsNamesThatBreakJsonPatchPathsOrTheNamePattern(final String name) {
    assertTrue(badRequest(List.of(property(name, STRING))).startsWith("Invalid property name"));
  }

  @Test
  void acceptsNamesWithDotsAndSpacesThatMustStayQuotedInJsonPaths() {
    GlossaryTermPropertyRules.validateDefinitions(
        List.of(property("a.b c%d", STRING), property("50% (approx)", STRING)));
  }

  @Test
  void namesAreUniqueIgnoringCase() {
    assertEquals(
        "Property name 'Tier' is declared twice; names are unique ignoring case",
        badRequest(List.of(property("tier", STRING), property("Tier", STRING))));
  }

  @Test
  void atMostFiftyDefinitions() {
    final List<GlossaryTermProperty> fifty =
        IntStream.range(0, 50).mapToObj(index -> property("p" + index, STRING)).toList();
    GlossaryTermPropertyRules.validateDefinitions(fifty);
    final List<GlossaryTermProperty> fiftyOne = new ArrayList<>(fifty);
    fiftyOne.add(property("extra", STRING));
    assertEquals("A term declares at most 50 properties, got 51", badRequest(fiftyOne));
  }

  @Test
  void enumNeedsTwoToOneThousandValuesAndOtherTypesNone() {
    assertEquals(
        "Enum property 'e' needs 2 to 1000 allowed values, got 1",
        badRequest(List.of(enumProperty("e", false, true, "only"))));
    assertEquals(
        "Property 's' is not an enum, so it cannot list allowed values",
        badRequest(
            List.of(property("s", STRING).withEnumValues(new LinkedHashSet<>(Set.of("a", "b"))))));
  }

  @Test
  void onlyStringAndEnumCanBeMultiValued() {
    assertEquals(
        "Property 'n' of datatype integer cannot be multi-valued; only string and enum can",
        badRequest(List.of(property("n", INTEGER).withMultiValued(true))));
    GlossaryTermPropertyRules.validateDefinitions(
        List.of(property("s", STRING).withMultiValued(true)));
  }

  @Test
  void unitIsOneToTwoHundredFiftySixCharacters() {
    assertEquals(
        "The unit of property 'n' is 1 to 256 characters",
        badRequest(List.of(property("n", INTEGER).withUnit(""))));
    assertEquals(
        "The unit of property 'n' is 1 to 256 characters",
        badRequest(List.of(property("n", INTEGER).withUnit("u".repeat(257)))));
  }

  @Test
  void datatypeNeverChanges() {
    final var before = List.of(property("n", INTEGER));
    final var after = List.of(property("n", GlossaryTermPropertyDatatype.DECIMAL));
    assertEquals(
        "The datatype of property 'n' cannot change from integer to decimal; delete the property and declare it again",
        assertThrows(
                IllegalArgumentException.class,
                () -> GlossaryTermPropertyRules.validateDatatypesUnchanged(before, after))
            .getMessage());
  }

  @Test
  void ownedAndInheritedStoredBytesAreCapped() {
    final Map<String, List<String>> values = Map.of("note", List.of("x".repeat(2048)));
    final List<GlossaryTermProperty> definitions =
        List.of(property("note", STRING).withMultiValued(true));
    GlossaryTermPropertyRules.validateStoredSize(definitions, values);
    final Map<String, List<String>> huge = new java.util.LinkedHashMap<>();
    IntStream.range(0, 200).forEach(index -> huge.put("k" + index, List.of("x".repeat(2048))));
    assertTrue(
        assertThrows(
                IllegalArgumentException.class,
                () -> GlossaryTermPropertyRules.validateStoredSize(definitions, huge))
            .getMessage()
            .startsWith("A term's property definitions and values take at most 262144 bytes"));
  }

  @Test
  void declaringANameAnAncestorMakesInheritableIsAConflictNamingTheAncestor() {
    final GlossaryTerm email =
        term("G.Customer.Email", List.of(property("RegulatoryScope", STRING)), null);

    final WebServiceException conflict =
        assertThrows(
            WebServiceException.class,
            () -> GlossaryTermPropertyRules.validateNoAncestorClash(email, List.of(customer)));

    assertEquals(Response.Status.CONFLICT.getStatusCode(), conflict.getResponse().getStatus());
    assertEquals(
        "Term 'G.Customer.Email' declares 'RegulatoryScope', which ancestor 'G.Customer' already makes inheritable as 'regulatoryScope'",
        conflict.getMessage());
  }

  @Test
  void aNameTheAncestorKeepsToItselfDoesNotClash() {
    final GlossaryTerm email =
        term("G.Customer.Email", List.of(property("retentionDays", STRING)), null);
    assertTrue(GlossaryTermPropertyRules.ancestorClash(email, List.of(customer)).isEmpty());
  }

  @Test
  void keyMustNameAnEffectivePropertyOfTheTerm() {
    final GlossaryTerm email =
        term("G.Customer.Email", null, Map.of("retentionDays", List.of("5")));
    assertEquals(
        "Term 'G.Customer.Email' has no property named 'retentionDays'; declare it on the term or an ancestor that makes it inheritable",
        GlossaryTermPropertyRules.keyProblem(email, List.of(customer), Set.of("retentionDays"))
            .orElseThrow());
  }

  @Test
  void keyValuesAreCheckedAgainstTheDefinition() {
    final GlossaryTerm phone =
        term("G.Customer.Phone", null, Map.of("regulatoryScope", List.of("HIPAA")));
    assertEquals(
        "Value 'HIPAA' is not a valid enum for property 'regulatoryScope'",
        GlossaryTermPropertyRules.keyProblem(phone, List.of(customer), Set.of("regulatoryScope"))
            .orElseThrow());
  }

  @Test
  void changedKeysAreTheOnesWhoseListsDifferOrAreNew() {
    final Map<String, List<String>> before = Map.of("a", List.of("1"), "b", List.of("2"));
    final Map<String, List<String>> after =
        Map.of("a", List.of("1"), "b", List.of(), "c", List.of("3"));
    assertEquals(Set.of("b", "c"), GlossaryTermPropertyRules.changedKeys(before, after));
    assertEquals(Set.of(), GlossaryTermPropertyRules.changedKeys(null, null));
  }

  @Test
  void nameClashBelowListsEveryTermThatDeclaresTheNameIgnoringCase() {
    final GlossaryTerm clash =
        term("G.Customer.Email", List.of(property("REGULATORYSCOPE", STRING)), null);
    final GlossaryTerm fine = term("G.Customer.Phone", List.of(property("other", STRING)), null);
    final TermPropertyViolations violations = new TermPropertyViolations();

    GlossaryTermPropertyRules.collectNameClashes(
        List.of(enumProperty("regulatoryScope", true, true, "GDPR", "CCPA")),
        List.of(clash, fine),
        violations);

    assertEquals(List.of("G.Customer.Email"), violations.sample());
  }

  @Test
  void brokenValuesAreTheStoredEntriesTheNewShapeRejects() {
    final var narrowed = enumProperty("regulatoryScope", false, true, "GDPR", "CCPA");
    final GlossaryTerm twoValues =
        term("G.Customer.A", null, Map.of("regulatoryScope", List.of("GDPR", "CCPA")));
    final GlossaryTerm oneValue =
        term("G.Customer.B", null, Map.of("regulatoryScope", List.of("CCPA")));
    final GlossaryTerm noEntry = term("G.Customer.C", null, null);
    final TermPropertyViolations violations = new TermPropertyViolations();

    GlossaryTermPropertyRules.collectBrokenValues(
        narrowed, List.of(twoValues, oneValue, noEntry), violations);

    assertEquals(List.of("G.Customer.A"), violations.sample());
  }

  @Test
  void violationsKeepTwentyNamesAndCountTheRest() {
    final TermPropertyViolations violations = new TermPropertyViolations();
    IntStream.range(0, 25).forEach(index -> violations.add("G.T" + index));

    assertEquals(20, violations.sample().size());
    assertEquals(25, violations.total());
    assertTrue(violations.describe().endsWith(", G.T19 and 5 more"));
  }

  @Test
  void movedTermFitsOnlyAncestorsThatStillCoverItsEntries() {
    final GlossaryTerm phone =
        term("G.Customer.Phone", null, Map.of("regulatoryScope", List.of("CCPA")));

    assertTrue(GlossaryTermPropertyRules.fitsAncestors(phone, List.of(customer)));
    assertFalse(GlossaryTermPropertyRules.fitsAncestors(phone, List.of()));
  }

  @Test
  void definitionChangeSeparatesAddedRemovedAndInheritanceChanges() {
    final var kept = property("kept", STRING);
    final var gone = property("gone", STRING);
    final var turnedOn = property("turnedOn", STRING).withInheritable(false);
    final var turnedOff = property("turnedOff", STRING);
    final var narrowed = enumProperty("narrowed", true, true, "a", "b");

    final GlossaryTermPropertyChange change =
        GlossaryTermPropertyChange.between(
            List.of(kept, gone, turnedOn, turnedOff, narrowed),
            List.of(
                kept,
                property("turnedOn", STRING),
                property("turnedOff", STRING).withInheritable(false),
                enumProperty("narrowed", false, true, "a", "b"),
                property("fresh", STRING)));

    assertEquals(List.of("gone"), names(change.removed()));
    assertEquals(List.of("fresh"), names(change.added()));
    assertEquals(List.of("turnedOn"), names(change.becameInheritable()));
    assertEquals(List.of("turnedOff"), names(change.lostInheritance()));
    assertEquals(List.of("narrowed"), names(change.shapeChanged()));
    assertEquals(List.of("fresh", "turnedOn"), names(change.startingToReachBelow()));
    assertEquals(List.of("gone", "turnedOff"), names(change.stoppingToReachBelow()));
  }

  @Test
  void removingANonInheritablePropertyReachesNothingBelow() {
    final GlossaryTermPropertyChange change =
        GlossaryTermPropertyChange.between(
            List.of(property("local", STRING).withInheritable(false)), List.of());

    assertEquals(List.of("local"), names(change.removed()));
    assertEquals(List.of(), names(change.stoppingToReachBelow()));
  }

  private static List<String> names(final List<GlossaryTermProperty> definitions) {
    return definitions.stream().map(GlossaryTermProperty::getName).sorted().toList();
  }
}
