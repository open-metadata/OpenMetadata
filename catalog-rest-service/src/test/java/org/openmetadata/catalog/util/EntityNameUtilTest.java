package org.openmetadata.catalog.util;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import org.junit.jupiter.api.Test;

class EntityNameUtilTest {
  private class FQNTest {
    private final String[] parts;
    private final String fqn;

    FQNTest(String[] parts, String fqn) {
      this.parts = parts;
      this.fqn = fqn;
    }
  }

  @Test
  public void test_getFQN_splitFQN() {
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
      assertArrayEquals(test.parts, EntityNameUtil.splitFQN(test.fqn));
      assertEquals(test.fqn, EntityNameUtil.getFQN(test.parts));
    }
  }

  @Test
  public void test_quoteName() {
    assertEquals("a", EntityNameUtil.quoteName("a")); // Unquoted name remains unquoted
    assertEquals("\"a.b\"", EntityNameUtil.quoteName("a.b")); // Add quotes when "." exists in the name
    assertEquals("\"a.b\"", EntityNameUtil.quoteName("\"a.b\"")); // Leave existing valid quotes
    assertEquals("a", EntityNameUtil.quoteName("\"a\"")); // Remove quotes when not needed

    assertThrows(
        IllegalArgumentException.class,
        () -> assertEquals("a", EntityNameUtil.quoteName("\"a"))); // Error when ending quote is missing
    assertThrows(
        IllegalArgumentException.class,
        () -> assertEquals("a", EntityNameUtil.quoteName("a\""))); // Error when beginning quote is missing
    assertThrows(
        IllegalArgumentException.class,
        () -> assertEquals("a", EntityNameUtil.quoteName("a\"b"))); // Error quote in the middle of the string
  }
}
