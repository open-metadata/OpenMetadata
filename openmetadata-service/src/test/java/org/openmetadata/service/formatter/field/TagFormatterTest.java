package org.openmetadata.service.formatter.field;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.feed.TagFeedInfo;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.formatter.TestMessageDecorator;

class TagFormatterTest {

  @Test
  void formatTagChangesForEntityLevelUpdates() {
    Thread thread = baseThread("<#E::table::service.sales.orders>");
    TagFormatter formatter =
        new TagFormatter(
            new TestMessageDecorator(),
            thread,
            new FieldChange()
                .withName("tags")
                .withOldValue(tagsJson("PII.Sensitive"))
                .withNewValue(tagsJson("Tier.Gold")));

    assertEquals("Added <b>tags</b>: <ins>Tier.Gold</ins>", formatter.formatAddedField());

    String updated = formatter.formatUpdatedField();
    assertTrue(updated.contains("Updated <b>tags</b>:"));
    assertTrue(updated.contains("<del>PII.Sensitive</del>"));
    assertTrue(updated.contains("<ins>Tier.Gold</ins>"));

    assertEquals("Deleted <b>tags</b>: <del>PII.Sensitive</del>", formatter.formatDeletedField());
    assertEquals(Thread.CardStyle.TAGS, thread.getCardStyle());
    assertEquals(Thread.FieldOperation.DELETED, thread.getFieldOperation());
    assertEquals("tags", thread.getFeedInfo().getFieldName());
    assertTrue(
        thread.getFeedInfo().getHeaderMessage().contains("alice deleted the tags for table"));
    assertInstanceOf(TagFeedInfo.class, thread.getFeedInfo().getEntitySpecificInfo());
  }

  @Test
  void formatTagChangesForNestedFieldLinksUsesColumnLabel() {
    Thread thread = baseThread("<#E::table::service.sales.orders::columns::order_id::description>");
    TagFormatter formatter =
        new TagFormatter(
            new TestMessageDecorator(),
            thread,
            new FieldChange().withName("tags").withNewValue(tagsJson("Glossary.Important")));

    String message = formatter.formatAddedField();

    assertTrue(message.contains("to column"));
    assertTrue(message.contains("<b>description</b>"));
    assertTrue(message.contains("<b>order_id</b>"));
    assertTrue(message.contains("<ins>Glossary.Important</ins>"));
    assertEquals(Thread.FieldOperation.ADDED, thread.getFieldOperation());
  }

  @Test
  void formatNestedTagUpdatesAndDeletesUseResolvedFieldLabels() {
    Thread thread = baseThread("<#E::table::service.sales.orders::columns::order_id::description>");
    TagFormatter formatter =
        new TagFormatter(
            new TestMessageDecorator(),
            thread,
            new FieldChange()
                .withName("tags")
                .withOldValue(tagsJson("PII.Sensitive"))
                .withNewValue(tagsJson("Tier.Gold")));

    String updated = formatter.formatUpdatedField();
    assertTrue(updated.contains("Updated <b>description</b> of column <b>order_id</b>:"));
    assertTrue(updated.contains("<del>PII.Sensitive</del>"));
    assertTrue(updated.contains("<ins>Tier.Gold</ins>"));

    String deleted = formatter.formatDeletedField();
    assertTrue(deleted.contains("Deleted <b>description</b> from column <b>order_id</b>:"));
    assertTrue(deleted.contains("<del>PII.Sensitive</del>"));
    assertEquals(Thread.FieldOperation.DELETED, thread.getFieldOperation());
  }

  @Test
  void formatNestedTagChangesPreserveNonColumnFieldNames() {
    Thread thread = baseThread("<#E::table::service.sales.orders::owners::alice::displayName>");
    TagFormatter formatter =
        new TagFormatter(
            new TestMessageDecorator(),
            thread,
            new FieldChange().withName("tags").withNewValue(tagsJson("Tier.Gold")));

    String message = formatter.formatAddedField();

    assertTrue(message.contains("to owners"));
    assertTrue(message.contains("<b>displayName</b>"));
    assertTrue(message.contains("<b>alice</b>"));
  }

  private static String tagsJson(String tagFqn) {
    return JsonUtils.pojoToJson(List.of(new TagLabel().withTagFQN(tagFqn)));
  }

  private static Thread baseThread(String about) {
    return new Thread()
        .withId(UUID.randomUUID())
        .withAbout(about)
        .withUpdatedBy("alice")
        .withEntityUrlLink("/table/service.sales.orders")
        .withEntityRef(
            new EntityReference()
                .withId(UUID.randomUUID())
                .withType(Entity.TABLE)
                .withFullyQualifiedName("service.sales.orders"));
  }
}
