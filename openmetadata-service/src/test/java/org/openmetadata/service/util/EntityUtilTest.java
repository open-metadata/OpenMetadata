package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.*;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
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
}
