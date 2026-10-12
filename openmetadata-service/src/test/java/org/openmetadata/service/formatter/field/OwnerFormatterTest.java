package org.openmetadata.service.formatter.field;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.feed.OwnerFeedInfo;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.formatter.TestMessageDecorator;
import org.openmetadata.service.formatter.util.FormattedMessage;

class OwnerFormatterTest {

  @Test
  void formatOwnerChangesPopulateOwnerFeedInfo() {
    FormattedMessage message = baseMessage();
    OwnerFormatter formatter =
        new OwnerFormatter(
            new TestMessageDecorator(),
            message,
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
    assertEquals(FormattedMessage.CardStyle.OWNER, message.getCardStyle());
    assertEquals(FormattedMessage.FieldOperation.DELETED, message.getFieldOperation());
    assertEquals("owners", message.getFeedInfo().getFieldName());
    assertTrue(
        message.getFeedInfo().getHeaderMessage().contains("alice deleted the owner for table"));
    assertInstanceOf(OwnerFeedInfo.class, message.getFeedInfo().getEntitySpecificInfo());
  }

  private static String ownerJson(String displayName) {
    return JsonUtils.pojoToJson(List.of(new EntityReference().withDisplayName(displayName)));
  }

  private static FormattedMessage baseMessage() {
    return new FormattedMessage()
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
