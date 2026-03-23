package org.openmetadata.service.formatter.field;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.feed.OwnerFeedInfo;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.formatter.TestMessageDecorator;

class OwnerFormatterTest {

  @Test
  void formatOwnerChangesPopulateOwnerFeedInfo() {
    Thread thread = baseThread();
    OwnerFormatter formatter =
        new OwnerFormatter(
            new TestMessageDecorator(),
            thread,
            new FieldChange()
                .withName("owners")
                .withOldValue(ownerJson("Alice"))
                .withNewValue(ownerJson("Bob")));

    assertEquals("Added <b>owners</b>: <ins>Bob</ins>", formatter.formatAddedField());

    String updated = formatter.formatUpdatedField();
    assertTrue(updated.contains("Updated <b>owners</b>:"));
    assertTrue(updated.contains("<del>Alice</del>"));
    assertTrue(updated.contains("<ins>Bob</ins>"));

    assertEquals("Deleted <b>owners</b>: <del>Alice</del>", formatter.formatDeletedField());
    assertEquals(Thread.CardStyle.OWNER, thread.getCardStyle());
    assertEquals(Thread.FieldOperation.DELETED, thread.getFieldOperation());
    assertEquals("owners", thread.getFeedInfo().getFieldName());
    assertTrue(
        thread.getFeedInfo().getHeaderMessage().contains("alice deleted the owner for table"));
    assertInstanceOf(OwnerFeedInfo.class, thread.getFeedInfo().getEntitySpecificInfo());
  }

  private static String ownerJson(String displayName) {
    return JsonUtils.pojoToJson(List.of(new EntityReference().withDisplayName(displayName)));
  }

  private static Thread baseThread() {
    return new Thread()
        .withId(UUID.randomUUID())
        .withAbout("<#E::table::service.sales.orders>")
        .withUpdatedBy("alice")
        .withEntityUrlLink("/table/service.sales.orders")
        .withEntityRef(
            new EntityReference()
                .withId(UUID.randomUUID())
                .withType(Entity.TABLE)
                .withFullyQualifiedName("service.sales.orders"));
  }
}
