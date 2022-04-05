package org.openmetadata.catalog.util;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import org.junit.jupiter.api.Test;

class FullyQualifiedNameTest {
  private static class FQNTest {
    private final String[] parts;
    private final String fqn;

    FQNTest(String[] parts, String fqn) {
      this.parts = parts;
      this.fqn = fqn;
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
            new FQNTest(new String[] {"a.1", "b.2", "c.3", "d.4"}, "\"a.1\".\"b.2\".\"c.3\".\"d.4\""));
    for (FQNTest test : list) {
      assertArrayEquals(test.parts, FullyQualifiedName.split(test.fqn));
      assertEquals(test.fqn, FullyQualifiedName.build(test.parts));
    }
  }

  @Test
  void test_quoteName() {
    assertEquals("a", FullyQualifiedName.quoteName("a")); // Unquoted name remains unquoted
    assertEquals("\"a.b\"", FullyQualifiedName.quoteName("a.b")); // Add quotes when "." exists in the name
    assertEquals("\"a.b\"", FullyQualifiedName.quoteName("\"a.b\"")); // Leave existing valid quotes
    assertEquals("a", FullyQualifiedName.quoteName("\"a\"")); // Remove quotes when not needed

    assertThrows(
        IllegalArgumentException.class,
        () -> FullyQualifiedName.quoteName("\"a")); // Error when ending quote is missing

    assertThrows(
        IllegalArgumentException.class,
        () -> FullyQualifiedName.quoteName("a\"")); // Error when beginning quote is missing

    assertThrows(
        IllegalArgumentException.class,
        () -> FullyQualifiedName.quoteName("a\"b")); // Error when invalid quote is present in the middle of the string
  }
}
