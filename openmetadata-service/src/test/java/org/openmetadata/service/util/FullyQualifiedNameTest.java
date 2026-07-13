package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import org.antlr.v4.runtime.misc.ParseCancellationException;
import org.junit.jupiter.api.Test;

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
    // Names containing a quote are wrapped and the internal quote is doubled ("")
    assertEquals("\"\"\"a\"", FullyQualifiedName.quoteName("\"a")); // "a   -> """a"
    assertEquals("\"a\"\"\"", FullyQualifiedName.quoteName("a\"")); // a"   -> "a"""
    assertEquals("\"a\"\"b\"", FullyQualifiedName.quoteName("a\"b")); // a"b  -> "a""b"
    // quoteName is idempotent on an already-encoded segment
    assertEquals("\"a\"\"b\"", FullyQualifiedName.quoteName("\"a\"\"b\""));
  }

  @Test
  void test_unquoteName() {
    assertEquals("a", FullyQualifiedName.unquoteName("a")); // Unquoted name remains unquoted
    assertEquals("a.b", FullyQualifiedName.unquoteName("\"a.b\"")); // Leave existing valid quotes
    assertEquals("a\"b", FullyQualifiedName.unquoteName("\"a\"\"b\"")); // Unescape doubled quote
  }

  @Test
  void test_quotedName_roundTrip() {
    // A name containing '"' must survive build -> split -> buildHash without bailing the parser.
    String taskName = "si_l'agent_existe_dans_la_base_\"agents\"_alors";
    String fqn = FullyQualifiedName.add("svc.pipeline", taskName);
    assertEquals("svc.pipeline.\"si_l'agent_existe_dans_la_base_\"\"agents\"\"_alors\"", fqn);

    String[] parts = FullyQualifiedName.split(fqn);
    assertEquals(3, parts.length);
    assertEquals(taskName, FullyQualifiedName.unquoteName(parts[2]));

    // buildHash must not throw on an FQN whose segment contains an (escaped) quote.
    assertEquals(FullyQualifiedName.buildHash(fqn), FullyQualifiedName.buildHash(fqn));
  }

  @Test
  void test_validateFqnName() {
    // Representable names (including reserved '.' and escaped '"') round-trip and are accepted.
    FullyQualifiedName.validateFqnName("plain_name");
    FullyQualifiedName.validateFqnName("name.with.dots");
    FullyQualifiedName.validateFqnName("name_with_\"quotes\"");
    FullyQualifiedName.validateFqnName("récupère_les_agents/email");
    FullyQualifiedName.validateFqnName("a\".b");
    // Null or empty names are rejected up front: they yield an unhashable empty FQN segment.
    assertThrows(IllegalArgumentException.class, () -> FullyQualifiedName.validateFqnName(null));
    assertThrows(IllegalArgumentException.class, () -> FullyQualifiedName.validateFqnName(""));
  }

  @Test
  void test_isValid() {
    assertTrue(FullyQualifiedName.isValid("svc.db.schema.table"));
    assertTrue(FullyQualifiedName.isValid("\"a.1\".b.c"));
    // Unparseable FQNs (e.g. empty segments) are detected, not thrown.
    assertFalse(FullyQualifiedName.isValid("a..b"));
    // Null / empty are invalid rather than an NPE, so repair paths re-derive them.
    assertFalse(FullyQualifiedName.isValid(null));
    assertFalse(FullyQualifiedName.isValid(""));
  }

  @Test
  void test_invalid() {
    assertThrows(ParseCancellationException.class, () -> FullyQualifiedName.split("..a"));
    assertThrows(ParseCancellationException.class, () -> FullyQualifiedName.split("a.."));
    // Empty quoted segments ("") are not valid FQN segments.
    assertThrows(ParseCancellationException.class, () -> FullyQualifiedName.split("\"\""));
    assertThrows(ParseCancellationException.class, () -> FullyQualifiedName.split("a.\"\".b"));
  }

  @Test
  void test_buildHash_rejectsEntityLink() {
    // Plain FQNs (including quoted-dot names) are hashed as before.
    assertEquals(
        FullyQualifiedName.buildHash("svc.db.schema.table"),
        FullyQualifiedName.buildHash("svc.db.schema.table"));
    // Should not throw — quoted-dot FQN is a valid FQN.
    FullyQualifiedName.buildHash("\"a.1\".b.c");

    // EntityLink-shaped input is rejected fast with a clear message,
    // rather than bailing inside the ANTLR parser with a null message.
    IllegalArgumentException ex =
        assertThrows(
            IllegalArgumentException.class,
            () -> FullyQualifiedName.buildHash("<#E::table::svc.db.s.t::description>"));
    assertTrue(ex.getMessage().contains("EntityLink"));
    assertTrue(ex.getMessage().contains("MessageParser"));
    assertThrows(
        IllegalArgumentException.class,
        () -> FullyQualifiedName.buildHash("<#E::table::\"PW%domain.x\">"));
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
  void test_getAllParts() {
    Set<String> parts = FullyQualifiedName.getAllParts("a.b.c.d");
    assertTrue(parts.contains("a"));
    assertTrue(parts.contains("b"));
    assertTrue(parts.contains("c"));
    assertTrue(parts.contains("d"));
    // Should contain top-down hierarchy
    assertTrue(parts.contains("a"));
    assertTrue(parts.contains("a.b"));
    assertTrue(parts.contains("a.b.c"));
    assertTrue(parts.contains("a.b.c.d"));
    // Should contain bottom-up combinations
    assertTrue(parts.contains("b.c.d"));
    assertTrue(parts.contains("c.d"));
    assertEquals(10, parts.size()); // 4 individual + 4 top-down + 2 bottom-up

    // Test with quoted names
    Set<String> quotedParts = FullyQualifiedName.getAllParts("\"a.1\".\"b.2\".c.d");
    assertTrue(quotedParts.contains("\"a.1\""));
    assertTrue(quotedParts.contains("\"b.2\""));
    assertTrue(quotedParts.contains("c"));
    assertTrue(quotedParts.contains("d"));
    assertTrue(quotedParts.contains("\"a.1\".\"b.2\".c.d"));
    assertTrue(quotedParts.contains("\"b.2\".c.d"));

    // Test with single part
    Set<String> singlePart = FullyQualifiedName.getAllParts("service");
    assertEquals(1, singlePart.size());
    assertTrue(singlePart.contains("service"));
  }

  @Test
  void test_getHierarchicalParts() {
    List<String> hierarchy = FullyQualifiedName.getHierarchicalParts("a.b.c.d");
    assertEquals(4, hierarchy.size());
    assertEquals("a", hierarchy.get(0));
    assertEquals("a.b", hierarchy.get(1));
    assertEquals("a.b.c", hierarchy.get(2));
    assertEquals("a.b.c.d", hierarchy.get(3));

    // Test with quoted names
    List<String> quotedHierarchy = FullyQualifiedName.getHierarchicalParts("\"a.1\".b.\"c.3\"");
    assertEquals(3, quotedHierarchy.size());
    assertEquals("\"a.1\"", quotedHierarchy.get(0));
    assertEquals("\"a.1\".b", quotedHierarchy.get(1));
    assertEquals("\"a.1\".b.\"c.3\"", quotedHierarchy.get(2));

    // Test with single part
    List<String> singleHierarchy = FullyQualifiedName.getHierarchicalParts("service");
    assertEquals(1, singleHierarchy.size());
    assertEquals("service", singleHierarchy.getFirst());
  }

  @Test
  void test_getAncestors() {
    List<String> ancestors = FullyQualifiedName.getAncestors("a.b.c.d");
    assertEquals(3, ancestors.size());
    assertEquals("a.b.c", ancestors.get(0));
    assertEquals("a.b", ancestors.get(1));
    assertEquals("a", ancestors.get(2));

    List<String> twoPartAncestors = FullyQualifiedName.getAncestors("a.b");
    assertEquals(1, twoPartAncestors.size());
    assertEquals("a", twoPartAncestors.getFirst());

    // Test with single part (no ancestors)
    List<String> noAncestors = FullyQualifiedName.getAncestors("service");
    assertEquals(0, noAncestors.size());

    // Test with quoted names
    List<String> quotedAncestors = FullyQualifiedName.getAncestors("\"a.1\".b.\"c.3\".d");
    assertEquals(3, quotedAncestors.size());
    assertEquals("\"a.1\".b.\"c.3\"", quotedAncestors.get(0));
    assertEquals("\"a.1\".b", quotedAncestors.get(1));
    assertEquals("\"a.1\"", quotedAncestors.get(2));
  }

  @Test
  void test_getDashboardDataModelFQN() {
    // Standard case
    assertEquals(
        "service.model.dataModel",
        FullyQualifiedName.getDashboardDataModelFQN("service.model.dataModel.col1"));
    // Nested column
    assertEquals(
        "service.model.dataModel",
        FullyQualifiedName.getDashboardDataModelFQN("service.model.dataModel.col1.child1"));
    // Quoted names
    assertEquals(
        "service.model.\"data.model\"",
        FullyQualifiedName.getDashboardDataModelFQN("service.model.\"data.model\".col1"));
    // Error: too few segments
    assertThrows(
        IllegalArgumentException.class,
        () -> FullyQualifiedName.getDashboardDataModelFQN("service.model"));
  }

  @Test
  void test_getParentEntityFQN() {
    // Table case
    assertEquals(
        "service.db.schema.table",
        FullyQualifiedName.getParentEntityFQN("service.db.schema.table.col1", "table"));
    // Table with nested column
    assertEquals(
        "service.db.schema.table",
        FullyQualifiedName.getParentEntityFQN("service.db.schema.table.col1.child1", "table"));
    // DashboardDataModel case
    assertEquals(
        "service.model.dataModel",
        FullyQualifiedName.getParentEntityFQN(
            "service.model.dataModel.col1", "dashboardDataModel"));
    // DashboardDataModel with nested column
    assertEquals(
        "service.model.dataModel",
        FullyQualifiedName.getParentEntityFQN(
            "service.model.dataModel.col1.child1", "dashboardDataModel"));
    // Error: unsupported entity type
    assertThrows(
        IllegalArgumentException.class,
        () -> FullyQualifiedName.getParentEntityFQN("service.model.dataModel.col1", "mlmodel"));
  }

  @Test
  void test_getParentEntityFQN_failure_cases() {
    // Using 'table' entityType for a dashboard data model column FQN (should throw)
    assertThrows(
        IllegalArgumentException.class,
        () -> FullyQualifiedName.getParentEntityFQN("service.model.dataModel.col1", "table"));

    // Too short for dashboard data model
    assertThrows(
        IllegalArgumentException.class,
        () -> FullyQualifiedName.getParentEntityFQN("service.db", "dashboardDataModel"));

    // Too short for table
    assertThrows(
        IllegalArgumentException.class,
        () -> FullyQualifiedName.getParentEntityFQN("service.db.schema", "table"));
  }
}
