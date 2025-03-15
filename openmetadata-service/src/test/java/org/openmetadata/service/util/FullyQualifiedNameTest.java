package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.Entity;

class FullyQualifiedNameTest {
  private record FQNTest(String[] parts, String fqn) {
    public void validate(String[] actualParts, String actualFQN) {
      assertEquals(fqn, actualFQN);
      assertEquals(parts.length, actualParts.length);
      for (int i = 0; i < parts.length; i++) {
        if (parts[i].contains(".")) {
          assertEquals(FullyQualifiedName.quoteName(parts[i]), actualParts[i]);
        } else {
          assertEquals(parts[i], actualParts[i]);
        }
      }
    }
  }

  @Test
  void test_build_split() {
    List<FQNTest> list =
        List.of(
            new FQNTest(new String[] {"a", "b", "c", "d"}, "a.b.c.d"),
            new FQNTest(new String[] {"a.1", "b", "c", "d"}, "\"a.1\".b.c.d"),
            new FQNTest(new String[] {"a", "b.2", "c", "d"}, "a.\"b.2\".c.d"),
            new FQNTest(new String[] {"a", "b", "c.3", "d"}, "a.b.\"c.3\".d"),
            new FQNTest(new String[] {"a", "b", "c", "d.4"}, "a.b.c.\"d.4\""),
            new FQNTest(new String[] {"a.1", "b.2", "c", "d"}, "\"a.1\".\"b.2\".c.d"),
            new FQNTest(new String[] {"a.1", "b.2", "c.3", "d"}, "\"a.1\".\"b.2\".\"c.3\".d"),
            new FQNTest(
                new String[] {"a.1", "b.2", "c.3", "d.4"}, "\"a.1\".\"b.2\".\"c.3\".\"d.4\""));
    for (FQNTest test : list) {
      String[] actualParts = FullyQualifiedName.split(test.fqn);
      String actualFqn = FullyQualifiedName.build(test.parts);
      test.validate(actualParts, actualFqn);
    }
  }

  @Test
  void test_quoteName() {
    assertEquals("a", FullyQualifiedName.quoteName("a")); // Unquoted name remains unquoted
    assertEquals("\"a.b\"", FullyQualifiedName.quoteName("a.b")); // Add quotes when "." in the name
    assertEquals("\"a.b\"", FullyQualifiedName.quoteName("\"a.b\"")); // Leave existing valid quotes
    assertEquals("a", FullyQualifiedName.quoteName("\"a\"")); // Remove quotes when not needed
    // we now allow quotes
    assertEquals("\"a", FullyQualifiedName.quoteName("\"a"));
    assertEquals("a\"", FullyQualifiedName.quoteName("a\""));
    assertEquals("a\"b", FullyQualifiedName.quoteName("a\"b"));
  }

  @Test
  void test_unquoteName() {
    assertEquals("a", FullyQualifiedName.unquoteName("a")); // Unquoted name remains unquoted
    assertEquals("a.b", FullyQualifiedName.unquoteName("\"a.b\"")); // Leave existing valid quotes
  }

  @Test
  void test_invalid() {
    IllegalArgumentException exception1 =
        assertThrows(IllegalArgumentException.class, () -> FullyQualifiedName.split("..a"));
    assertEquals("Invalid FQN format: ..a", exception1.getMessage());

    IllegalArgumentException exception2 =
        assertThrows(IllegalArgumentException.class, () -> FullyQualifiedName.split("a.."));
    assertEquals("Invalid FQN format: a..", exception2.getMessage());
  }

  @Test
  void test_getParentFQN() {
    assertEquals("a.b.c", FullyQualifiedName.getParentFQN("a.b.c.d"));
    assertEquals("\"a.b\"", FullyQualifiedName.getParentFQN("\"a.b\".c"));
    assertEquals("a", FullyQualifiedName.getParentFQN("a.b"));
    assertEquals("a", FullyQualifiedName.getParentFQN("a.\"b.c\""));
    assertEquals("a.\"b.c\"", FullyQualifiedName.getParentFQN("a.\"b.c\".d"));
    assertNull(FullyQualifiedName.getParentFQN("a"));
  }

  @Test
  void test_getRoot() {
    assertEquals("a", FullyQualifiedName.getRoot("a.b.c.d"));
    assertEquals("a", FullyQualifiedName.getRoot("a.b.c"));
    assertEquals("a", FullyQualifiedName.getRoot("a.b"));
    assertNull(FullyQualifiedName.getRoot("a"));
  }

  @Test
  void test_isParent() {
    assertTrue(FullyQualifiedName.isParent("a.b.c", "a.b"));
    assertTrue(FullyQualifiedName.isParent("a.b.c", "a"));
    assertFalse(FullyQualifiedName.isParent("a", "a.b.c"));
    assertFalse(FullyQualifiedName.isParent("a.b", "a.b.c"));
    assertFalse(FullyQualifiedName.isParent("a.b.c", "a.b.c"));
    assertFalse(FullyQualifiedName.isParent("a.b c", "a.b"));
  }

  @Test
  void test_buildHash() {
    // Test buildHash with multiple strings
    String[] parts = {"a", "b", "c", "d"};
    String expectedHash =
        String.join(
            Entity.SEPARATOR,
            EntityUtil.hash("a"),
            EntityUtil.hash("b"),
            EntityUtil.hash("c"),
            EntityUtil.hash("d"));
    assertEquals(expectedHash, FullyQualifiedName.buildHash(parts));

    // Test buildHash with a single fully qualified name
    String fqn = "a.b.c.d";
    assertEquals(expectedHash, FullyQualifiedName.buildHash(fqn));

    // Test buildHash with an empty string
    assertEquals("", FullyQualifiedName.buildHash(""));

    // Test buildHash with null
    assertNull(FullyQualifiedName.buildHash((String) null));

    // Test buildHash with special characters
    String[] specialParts = {"a.b", "c.d", "e.f"};
    String expectedSpecialHash =
        String.join(
            Entity.SEPARATOR,
            EntityUtil.hash("\"a.b\""),
            EntityUtil.hash("\"c.d\""),
            EntityUtil.hash("\"e.f\""));
    assertEquals(expectedSpecialHash, FullyQualifiedName.buildHash(specialParts));

    String specialFqn = "\"a.b\".\"c.d\".\"e.f\"";
    assertEquals(expectedSpecialHash, FullyQualifiedName.buildHash(specialFqn));

    // Test buildHash with a mix of quoted and unquoted names
    String[] mixedParts = {"a", "\"b.c\"", "d"};
    String expectedMixedHash =
        String.join(
            Entity.SEPARATOR,
            EntityUtil.hash("a"),
            EntityUtil.hash("\"b.c\""),
            EntityUtil.hash("d"));
    assertEquals(expectedMixedHash, FullyQualifiedName.buildHash(mixedParts));

    String mixedFqn = "a.\"b.c\".d";
    assertEquals(expectedMixedHash, FullyQualifiedName.buildHash(mixedFqn));

    // Test buildHash with simple quoted names, as the names have outer quotes with no . , they will
    // be considered without quotes while building hash
    // Refer to the comment in the quoteName method in FullyQualifiedName.java for more details:
    // "If unquoted string contains '.', return quoted 'sss', else unquoted sss"
    String[] simpleQuotedParts = {"\"ab\"", "\"cd\"", "\"ef\"", "\"gh\""};
    String expectedSimpleQuotedHash =
        String.join(
            Entity.SEPARATOR,
            EntityUtil.hash("ab"),
            EntityUtil.hash("cd"),
            EntityUtil.hash("ef"),
            EntityUtil.hash("gh"));
    assertEquals(expectedSimpleQuotedHash, FullyQualifiedName.buildHash(simpleQuotedParts));

    String simpleQuoteFqn = "\"ab\".\"cd\".\"ef\".\"gh\"";
    assertEquals(expectedSimpleQuotedHash, FullyQualifiedName.buildHash(simpleQuoteFqn));

    // Cases related to innerQuotes in unQuotedName
    //  1st CASE: Inner Quotes at the **End**
    String[] innerQuotePartsEnd = {
      "Power BI",
      "model",
      "be0b14b4-12d2-4a67-bad4-8bc4351e4bfc",
      "?Eingang_Tabelle_Filter_Zeit",
      "Spalte \"1\""
    };
    String expectedInnerQuoteHashEnd =
        String.join(
            Entity.SEPARATOR,
            EntityUtil.hash("Power BI"),
            EntityUtil.hash("model"),
            EntityUtil.hash("be0b14b4-12d2-4a67-bad4-8bc4351e4bfc"),
            EntityUtil.hash("?Eingang_Tabelle_Filter_Zeit"),
            EntityUtil.hash("Spalte \"1\""));
    assertEquals(expectedInnerQuoteHashEnd, FullyQualifiedName.buildHash(innerQuotePartsEnd));

    String innerQuoteFqnEnd =
        "Power BI.model.be0b14b4-12d2-4a67-bad4-8bc4351e4bfc.?Eingang_Tabelle_Filter_Zeit.Spalte \"1\"";
    assertEquals(expectedInnerQuoteHashEnd, FullyQualifiedName.buildHash(innerQuoteFqnEnd));

    //  2nd CASE: Inner Quotes in the **Middle**
    String[] innerQuotePartsMiddle = {"a \"b\" c", "d"};
    String expectedInnerQuoteHashMiddle =
        String.join(Entity.SEPARATOR, EntityUtil.hash("a \"b\" c"), EntityUtil.hash("d"));
    assertEquals(expectedInnerQuoteHashMiddle, FullyQualifiedName.buildHash(innerQuotePartsMiddle));

    String innerQuoteFqnMiddle = "a \"b\" c.d";
    assertEquals(expectedInnerQuoteHashMiddle, FullyQualifiedName.buildHash(innerQuoteFqnMiddle));

    //  3rd CASE: Inner Quotes at the **Start**
    String[] innerQuotePartsStart = {"\"FirstName\" LastName", "Department"};
    String expectedInnerQuoteHashStart =
        String.join(
            Entity.SEPARATOR,
            EntityUtil.hash("\"FirstName\" LastName"),
            EntityUtil.hash("Department"));
    assertEquals(expectedInnerQuoteHashStart, FullyQualifiedName.buildHash(innerQuotePartsStart));

    String innerQuoteFqnStart = "\"FirstName\" LastName.Department";
    assertEquals(expectedInnerQuoteHashStart, FullyQualifiedName.buildHash(innerQuoteFqnStart));

    //  4th CASE: **Complete QuotedParentName, in this case the outerQuotes removed **
    String[] innerQuotePartsQuotedStart = {"\"QuotedParentName\"", "rest of name"};
    String expectedInnerQuoteHashQuotedStart =
        String.join(
            Entity.SEPARATOR, EntityUtil.hash("QuotedParentName"), EntityUtil.hash("rest of name"));
    assertEquals(
        expectedInnerQuoteHashQuotedStart,
        FullyQualifiedName.buildHash(innerQuotePartsQuotedStart));

    String innerQuoteFqnQuotedStart = "\"QuotedParentName\".rest of name";
    assertEquals(
        expectedInnerQuoteHashQuotedStart, FullyQualifiedName.buildHash(innerQuoteFqnQuotedStart));

    //  5th CASE: Mutiple **Inner Quotes** in the name
    String[] multipleInnerQuotes = {"a", "\"c\"de\"f\"", "f"};
    String expectedSimpleMultipleInnerQuotes =
        String.join(
            Entity.SEPARATOR,
            EntityUtil.hash("a"),
            EntityUtil.hash("\"c\"de\"f\""),
            EntityUtil.hash("f"));
    assertEquals(
        expectedSimpleMultipleInnerQuotes, FullyQualifiedName.buildHash(multipleInnerQuotes));

    String multipleInnerQuotesFQN = "a.\"c\"de\"f\".f";
    assertEquals(
        expectedSimpleMultipleInnerQuotes, FullyQualifiedName.buildHash(multipleInnerQuotesFQN));

    // 6th CASE: Unpaired inner quotes at the end
    String[] unpairedInnerQuotesEnd = {"a", "b\"c", "d"};
    String expectedUnpairedInnerQuotesEnd =
        String.join(
            Entity.SEPARATOR, EntityUtil.hash("a"), EntityUtil.hash("b\"c"), EntityUtil.hash("d"));
    assertEquals(
        expectedUnpairedInnerQuotesEnd, FullyQualifiedName.buildHash(unpairedInnerQuotesEnd));

    String unpairedInnerQuotesFqnEnd = "a.b\"c.d";
    assertEquals(
        expectedUnpairedInnerQuotesEnd, FullyQualifiedName.buildHash(unpairedInnerQuotesFqnEnd));

    // 7th CASE:Unpaired inner quotes in the middle
    String[] unpairedInnerQuotesMiddle = {"a", "b\"c\"d", "e"};
    String expectedUnpairedInnerQuotesMiddle =
        String.join(
            Entity.SEPARATOR,
            EntityUtil.hash("a"),
            EntityUtil.hash("b\"c\"d"),
            EntityUtil.hash("e"));
    assertEquals(
        expectedUnpairedInnerQuotesMiddle, FullyQualifiedName.buildHash(unpairedInnerQuotesMiddle));

    String unpairedInnerQuotesFqnMiddle = "a.b\"c\"d.e";
    assertEquals(
        expectedUnpairedInnerQuotesMiddle,
        FullyQualifiedName.buildHash(unpairedInnerQuotesFqnMiddle));

    // 8th CASE:Unpaired inner quotes at the start
    String[] unpairedInnerQuotesStart = {"\"a", "b", "c"};
    String expectedUnpairedInnerQuotesStart =
        String.join(
            Entity.SEPARATOR, EntityUtil.hash("\"a"), EntityUtil.hash("b"), EntityUtil.hash("c"));
    assertEquals(
        expectedUnpairedInnerQuotesStart, FullyQualifiedName.buildHash(unpairedInnerQuotesStart));

    String unpairedInnerQuotesFqnStart = "\"a.b.c";
    assertEquals(
        expectedUnpairedInnerQuotesStart,
        FullyQualifiedName.buildHash(unpairedInnerQuotesFqnStart));
  }
}
