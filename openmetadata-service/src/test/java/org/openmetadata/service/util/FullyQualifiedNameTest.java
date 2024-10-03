package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEqual;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.antlr.v4.runtime.misc.ParseCancellationException;
import org.junit.jupiter.api.Test;

class FullyQualifiedNameTest {
  private record FQNTest(String[] parts, String fqn) {
    public void validate(String[] actualParts, String actualFQN) {
      assertEqual(fqn, actualFQN);
      assertEqual(parts.length, actualParts.length);
      for (int i = 0; i < parts.length; i++) {
        if (parts[i].contains(".")) {
          assertEqual(FullyQualifiedName.quoteName(parts[i]), actualParts[i]);
        } else {
          assertEqual(parts[i], actualParts[i]);
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
    assertEqual("a", FullyQualifiedName.quoteName("a")); // Unquoted name remains unquoted
    assertEqual("\"a.b\"", FullyQualifiedName.quoteName("a.b")); // Add quotes when "." in the name
    assertEqual("\"a.b\"", FullyQualifiedName.quoteName("\"a.b\"")); // Leave existing valid quotes
    assertEqual("a", FullyQualifiedName.quoteName("\"a\"")); // Remove quotes when not needed

    assertThrows(
        IllegalArgumentException.class,
        () -> FullyQualifiedName.quoteName("\"a")); // Error when ending quote is missing

    assertThrows(
        IllegalArgumentException.class,
        () -> FullyQualifiedName.quoteName("a\"")); // Error when beginning quote is missing

    assertThrows(
        IllegalArgumentException.class,
        () ->
            FullyQualifiedName.quoteName(
                "a\"b")); // Error when invalid quote is present in the middle of the string
  }

  @Test
  void test_unquoteName() {
    assertEqual("a", FullyQualifiedName.unquoteName("a")); // Unquoted name remains unquoted
    assertEqual("a.b", FullyQualifiedName.unquoteName("\"a.b\"")); // Leave existing valid quotes
  }

  @Test
  void test_invalid() {
    assertThrows(ParseCancellationException.class, () -> FullyQualifiedName.split("a\""));
  }

  @Test
  void test_getParentFQN() {
    assertEqual("a.b.c", FullyQualifiedName.getParentFQN("a.b.c.d"));
    assertEqual("\"a.b\"", FullyQualifiedName.getParentFQN("\"a.b\".c"));
    assertEqual("a", FullyQualifiedName.getParentFQN("a.b"));
    assertEqual("a", FullyQualifiedName.getParentFQN("a.\"b.c\""));
    assertEqual("a.\"b.c\"", FullyQualifiedName.getParentFQN("a.\"b.c\".d"));
    assertNull(FullyQualifiedName.getParentFQN("a"));
  }

  @Test
  void test_getRoot() {
    assertEqual("a", FullyQualifiedName.getRoot("a.b.c.d"));
    assertEqual("a", FullyQualifiedName.getRoot("a.b.c"));
    assertEqual("a", FullyQualifiedName.getRoot("a.b"));
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
}
