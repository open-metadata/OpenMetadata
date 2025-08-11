package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.service.util.EntityUtil.encodeEntityFqn;
import static org.openmetadata.service.util.EntityUtil.encodeEntityFqnSafe;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.resources.feeds.MessageParser;

class EntityUtilTest {
  @Test
  void test_isDescriptionRequired() {
    assertFalse(
        EntityUtil.isDescriptionRequired(Table.class)); // Table entity does not require description
    assertTrue(
        EntityUtil.isDescriptionRequired(
            GlossaryTerm.class)); // GlossaryTerm entity requires description
  }

  @Test
  void test_entityLinkParser() {

    // Valid entity links
    Map<String, String> expected = new HashMap<>();
    expected.put("entityLink", "<#E::table::users>");
    expected.put("arrayFieldName", null);
    expected.put("arrayFieldValue", null);
    expected.put("fieldName", null);
    expected.put("entityFQN", "users");
    expected.put("entityType", "table");
    expected.put("linkType", "ENTITY");
    expected.put("fullyQualifiedFieldType", "table");
    expected.put("fullyQualifiedFieldValue", "users");
    verifyEntityLinkParser(expected);

    expected.clear();
    expected.put("entityLink", "<#E::table::users.foo.\"bar.baz\">");
    expected.put("arrayFieldName", null);
    expected.put("arrayFieldValue", null);
    expected.put("fieldName", null);
    expected.put("entityFQN", "users.foo.\"bar.baz\"");
    expected.put("entityType", "table");
    expected.put("linkType", "ENTITY");
    expected.put("fullyQualifiedFieldType", "table");
    expected.put("fullyQualifiedFieldValue", "users.foo.\"bar.baz\"");
    verifyEntityLinkParser(expected);

    expected.clear();
    expected.put("entityLink", "<#E::db::customers>");
    expected.put("arrayFieldName", null);
    expected.put("arrayFieldValue", null);
    expected.put("fieldName", null);
    expected.put("entityFQN", "customers");
    expected.put("entityType", "db");
    expected.put("linkType", "ENTITY");
    expected.put("fullyQualifiedFieldType", "db");
    expected.put("fullyQualifiedFieldValue", "customers");
    verifyEntityLinkParser(expected);

    expected.clear();
    expected.put("entityLink", "<#E::table::users::column::id>");
    expected.put("arrayFieldName", "id");
    expected.put("arrayFieldValue", null);
    expected.put("fieldName", "column");
    expected.put("entityFQN", "users");
    expected.put("entityType", "table");
    expected.put("linkType", "ENTITY_ARRAY_FIELD");
    expected.put("fullyQualifiedFieldType", "table.column.member");
    expected.put("fullyQualifiedFieldValue", "users.id");
    verifyEntityLinkParser(expected);

    expected.clear();
    expected.put("entityLink", "<#E::table::orders::column::status::type::enum>");
    expected.put("arrayFieldName", "status");
    expected.put("arrayFieldValue", "type::enum");
    expected.put("fieldName", "column");
    expected.put("entityFQN", "orders");
    expected.put("entityType", "table");
    expected.put("linkType", "ENTITY_ARRAY_FIELD");
    expected.put("fullyQualifiedFieldType", "table.column.member");
    expected.put("fullyQualifiedFieldValue", "orders.status.type::enum");
    verifyEntityLinkParser(expected);

    expected.clear();
    expected.put("entityLink", "<#E::db::schema::table::view::column>");
    expected.put("arrayFieldName", "view");
    expected.put("arrayFieldValue", "column");
    expected.put("fieldName", "table");
    expected.put("entityFQN", "schema");
    expected.put("entityType", "db");
    expected.put("linkType", "ENTITY_ARRAY_FIELD");
    expected.put("fullyQualifiedFieldType", "db.table.member");
    expected.put("fullyQualifiedFieldValue", "schema.view.column");
    verifyEntityLinkParser(expected);

    expected.clear();
    expected.put("entityLink", "<#E::table::foo@bar>");
    expected.put("arrayFieldName", null);
    expected.put("arrayFieldValue", null);
    expected.put("fieldName", null);
    expected.put("entityFQN", "foo@bar");
    expected.put("entityType", "table");
    expected.put("linkType", "ENTITY");
    expected.put("fullyQualifiedFieldType", "table");
    expected.put("fullyQualifiedFieldValue", "foo@bar");
    verifyEntityLinkParser(expected);

    expected.clear();
    expected.put("entityLink", "<#E::table::foo[bar]>");
    expected.put("arrayFieldName", null);
    expected.put("arrayFieldValue", null);
    expected.put("fieldName", null);
    expected.put("entityFQN", "foo[bar]");
    expected.put("entityType", "table");
    expected.put("linkType", "ENTITY");
    expected.put("fullyQualifiedFieldType", "table");
    expected.put("fullyQualifiedFieldValue", "foo[bar]");
    verifyEntityLinkParser(expected);

    expected.clear();
    expected.put("entityLink", "<#E::table::special!@#$%^&*()_+[]{};:\\'\",./?>");
    expected.put("arrayFieldName", null);
    expected.put("arrayFieldValue", null);
    expected.put("fieldName", null);
    expected.put("entityFQN", "special!@#$%^&*()_+[]{};:\\'\",./?");
    expected.put("entityType", "table");
    expected.put("linkType", "ENTITY");
    expected.put("fullyQualifiedFieldType", "table");
    expected.put("fullyQualifiedFieldValue", "special!@#$%^&*()_+[]{};:\\'\",./?");
    verifyEntityLinkParser(expected);

    expected.clear();
    expected.put("entityLink", "<#E::table::special!@#$%^&*()_+[]{}|;\\'\",./?>");
    expected.put("entityType", "table");
    expected.put("entityFQN", "special!@#$%^&*()_+[]{}|;\\'\",./?");
    expected.put("linkType", "ENTITY");
    expected.put("fullyQualifiedFieldType", "table");
    expected.put("fullyQualifiedFieldValue", "special!@#$%^&*()_+[]{}|;\\'\",./?");
    verifyEntityLinkParser(expected);

    expected.clear();
    expected.put("entityLink", "<#E::table::special!@:#$%^&*()_+[]{}|;\\'\",./?>");
    expected.put("entityType", "table");
    expected.put("entityFQN", "special!@:#$%^&*()_+[]{}|;\\'\",./?");
    expected.put("linkType", "ENTITY");
    expected.put("fullyQualifiedFieldType", "table");
    expected.put("fullyQualifiedFieldValue", "special!@:#$%^&*()_+[]{}|;\\'\",./?");
    verifyEntityLinkParser(expected);
    expected.clear();

    expected.put("entityLink", "<#E::table::spec::>ial!@:#$%^&*()_+[]{}|;\\'\",./?>");

    org.opentest4j.AssertionFailedError exception =
        assertThrows(
            org.opentest4j.AssertionFailedError.class, () -> verifyEntityLinkParser(expected));
    assertEquals(
        "expected: <<#E::table::spec::>ial!@:#$%^&*()_+[]{}|;\\'\",./?>> but was: <<#E::table::spec::>>",
        exception.getMessage());

    expected.clear();
    expected.put("entityLink", "<#E::table::user<name>::column>");
    IllegalArgumentException argException =
        assertThrows(IllegalArgumentException.class, () -> verifyEntityLinkParser(expected));
    assertEquals(
        "Entity link was not found in <#E::table::user<name>::column>", argException.getMessage());

    expected.clear();
    expected.put("entityLink", "<#E::table::user>name::column>");
    exception =
        assertThrows(
            org.opentest4j.AssertionFailedError.class, () -> verifyEntityLinkParser(expected));
    assertEquals(
        "expected: <<#E::table::user>name::column>> but was: <<#E::table::user>>",
        exception.getMessage());

    expected.clear();
    expected.put("entityLink", "<#E::table::foo<>bar::baz>");
    argException =
        assertThrows(IllegalArgumentException.class, () -> verifyEntityLinkParser(expected));
    assertEquals(
        "Entity link was not found in <#E::table::foo<>bar::baz>", argException.getMessage());
  }

  void verifyEntityLinkParser(Map<String, String> expected) {
    MessageParser.EntityLink entityLink =
        MessageParser.EntityLink.parse(expected.get("entityLink"));
    assertEquals(expected.get("entityLink"), entityLink.getLinkString());
    assertEquals(expected.get("arrayFieldName"), entityLink.getArrayFieldName());
    assertEquals(expected.get("arrayFieldValue"), entityLink.getArrayFieldValue());
    assertEquals(expected.get("entityType"), entityLink.getEntityType());
    assertEquals(expected.get("fieldName"), entityLink.getFieldName());
    assertEquals(expected.get("entityFQN"), entityLink.getEntityFQN());
    assertEquals(expected.get("linkType"), entityLink.getLinkType().toString());
    assertEquals(expected.get("fullyQualifiedFieldType"), entityLink.getFullyQualifiedFieldType());
    assertEquals(
        expected.get("fullyQualifiedFieldValue"), entityLink.getFullyQualifiedFieldValue());
  }

  // URL Encoding Tests for Slack Event Fix

  @Test
  void testEncodeEntityFqnSafe_NullAndEmpty() {
    // Test null input
    assertEquals("", encodeEntityFqnSafe(null));

    // Test empty input
    assertEquals("", encodeEntityFqnSafe(""));

    // Test whitespace only
    assertEquals("", encodeEntityFqnSafe("   "));
  }

  @Test
  void testEncodeEntityFqnSafe_SimpleNames() {
    // Test simple names without special characters
    assertEquals("simple", encodeEntityFqnSafe("simple"));
    assertEquals("database.table", encodeEntityFqnSafe("database.table"));
    assertEquals(
        "service.database.schema.table", encodeEntityFqnSafe("service.database.schema.table"));
  }

  @ParameterizedTest
  @CsvSource({
    "'hello world', 'hello%20world'",
    "'test#hash', 'test%23hash'",
    "'query?param', 'query%3Fparam'",
    "'data&info', 'data%26info'",
    "'value+plus', 'value%2Bplus'",
    "'key=value', 'key%3Dvalue'",
    "'path/to/resource', 'path%2Fto%2Fresource'",
    "'back\\slash', 'back%5Cslash'",
    "'pipe|separated', 'pipe%7Cseparated'",
    "'\"quoted\"', '%22quoted%22'",
    "'''single''', '%27single%27'",
    "'<tag>', '%3Ctag%3E'",
    "'[bracket]', '%5Bbracket%5D'",
    "'{brace}', '%7Bbrace%7D'"
  })
  void testEncodeEntityFqnSafe_SpecialCharacters(String input, String expected) {
    assertEquals(expected, encodeEntityFqnSafe(input));
  }

  @Test
  void testEncodeEntityFqnSafe_ComplexFqn() {
    // Test complex FQN with spaces and special characters (similar to Databricks example)
    String complexFqn = "Random.pro.silver.l0_purchase_order.TOs con curr INR tery dd ser INR";
    String encoded = encodeEntityFqnSafe(complexFqn);

    // Verify spaces are encoded
    assertTrue(encoded.contains("%20"));

    // Verify the encoded string doesn't contain unencoded spaces
    assertFalse(encoded.contains(" "));

    // Verify the result
    assertEquals(
        "Random.pro.silver.l0_purchase_order.TOs%20con%20curr%20INR%20tery%20dd%20ser%20INR",
        encoded);
  }

  @Test
  void testEncodeEntityFqnSafe_AvoidDoubleEncoding() {
    // Test that already encoded percent signs are handled correctly
    String inputWithPercent = "test%already%encoded";
    String encoded = encodeEntityFqnSafe(inputWithPercent);

    // The percent signs should be encoded to %25
    assertEquals("test%25already%25encoded", encoded);
  }

  @Test
  void testEncodeEntityFqnSafe_PreservesRegularCharacters() {
    // Test that alphanumeric characters and dots are preserved
    String regularFqn = "service123.database_name.schema-name.table.column";
    assertEquals(regularFqn, encodeEntityFqnSafe(regularFqn));
  }

  @Test
  void testEncodeEntityFqnSafe_MixedContent() {
    // Test mixed content with various special characters
    String mixed = "Test Table & Data #1 with (special) chars?";
    String encoded = encodeEntityFqnSafe(mixed);
    String expected = "Test%20Table%20%26%20Data%20%231%20with%20(special)%20chars%3F";
    assertEquals(expected, encoded);
  }

  @Test
  void testEncodeEntityFqnSafe_CompareWithOriginal() {
    // Compare the new safe encoding with the original encoding method
    String testFqn = "Databricks.pro.silver.table with spaces";

    String originalEncoding = encodeEntityFqn(testFqn);
    String safeEncoding = encodeEntityFqnSafe(testFqn);

    // Both should handle spaces, but safe encoding should be more conservative
    assertTrue(originalEncoding.contains("%20"));
    assertTrue(safeEncoding.contains("%20"));

    // Safe encoding should not contain plus signs (which can cause issues)
    assertFalse(safeEncoding.contains("+"));
  }

  @Test
  void testEncodeEntityFqnSafe_EmailSecurityCompatibility() {
    // Test FQNs that would be problematic with email security systems
    String problematicFqn = "Table Name & Data #1 + Test?param=value";
    String encoded = encodeEntityFqnSafe(problematicFqn);

    // Verify all problematic characters are encoded
    assertFalse(encoded.contains(" ")); // spaces
    assertFalse(encoded.contains("&")); // ampersand
    assertFalse(encoded.contains("#")); // hash
    assertFalse(encoded.contains("?")); // question mark
    assertFalse(encoded.contains("=")); // equals
    assertFalse(encoded.contains("+")); // plus

    String expected = "Table%20Name%20%26%20Data%20%231%20%2B%20Test%3Fparam%3Dvalue";
    assertEquals(expected, encoded);
  }

  @Test
  void testEncodeEntityFqnSafe_WhitespaceHandling() {
    // Test various whitespace scenarios
    assertEquals("test%20name", encodeEntityFqnSafe("test name"));
    assertEquals("test%20%20double", encodeEntityFqnSafe("test  double"));
    assertEquals("leading%20space", encodeEntityFqnSafe(" leading space"));
    assertEquals("trailing%20space", encodeEntityFqnSafe("trailing space "));
  }

  @Test
  void testEncodeEntityFqnSafe_UnicodeCharacters() {
    // Test that regular Unicode characters are preserved
    String unicodeFqn = "测试.データ.тест";
    assertEquals(unicodeFqn, encodeEntityFqnSafe(unicodeFqn));
  }
}
