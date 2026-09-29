package org.openmetadata.service.formatter.field;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.feed.FeedInfo;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.formatter.TestMessageDecorator;
import org.openmetadata.service.formatter.util.FormattedMessage;
import org.openmetadata.service.formatter.util.FormatterUtil;

class DefaultFieldFormatterTest {

  @Test
  void getFieldValueParsesSupportedJsonShapes() {
    assertEquals("", DefaultFieldFormatter.getFieldValue(null));
    assertEquals("", DefaultFieldFormatter.getFieldValue(""));
    assertEquals(
        "PII.Sensitive",
        DefaultFieldFormatter.getFieldValue(
            JsonUtils.pojoToJson(List.of(new TagLabel().withTagFQN("PII.Sensitive")))));
    assertEquals(
        "Data Steward",
        DefaultFieldFormatter.getFieldValue(
            JsonUtils.pojoToJson(List.of(new EntityReference().withDisplayName("Data Steward")))));
    assertEquals(
        "Glossary.Term",
        DefaultFieldFormatter.getFieldValue(
            JsonUtils.pojoToJson(List.of(Map.of("name", "Glossary.Term")))));
    assertEquals(
        "PRIMARY_KEY",
        DefaultFieldFormatter.getFieldValue(
            JsonUtils.pojoToJson(List.of(Map.of("constraintType", "PRIMARY_KEY")))));
    assertEquals(
        "first, second",
        DefaultFieldFormatter.getFieldValue(JsonUtils.pojoToJson(List.of(" first ", "second"))));
    assertEquals(
        "Display Name",
        DefaultFieldFormatter.getFieldValue(
            JsonUtils.pojoToJson(Map.of("displayName", "Display Name"))));
    assertEquals(
        "entity-name",
        DefaultFieldFormatter.getFieldValue(JsonUtils.pojoToJson(Map.of("name", "entity-name"))));
    assertEquals("plain text", DefaultFieldFormatter.getFieldValue("plain text"));
  }

  @Test
  void getFieldNameChangeHandlesNestedAndExtensionFields() {
    FormattedMessage message = baseMessage("<#E::table::service.sales.orders>");

    assertEquals(
        "customer_id.description",
        DefaultFieldFormatter.getFieldNameChange("columns.customer_id.description", message));
    assertEquals("extension", DefaultFieldFormatter.getFieldNameChange("extension.owner", message));
    assertEquals("description", DefaultFieldFormatter.getFieldNameChange("description", message));
  }

  @Test
  void formatterBuildsMessagesAndPopulatesThreadFeedInfo() {
    FormattedMessage message = baseMessage("<#E::table::service.sales.orders>");
    DefaultFieldFormatter formatter =
        new DefaultFieldFormatter(
            new TestMessageDecorator(),
            message,
            new FieldChange().withName("description").withOldValue("old").withNewValue("new"));

    assertEquals("Added <b>description</b>: <ins>new</ins>", formatter.formatAddedField());
    assertTrue(formatter.formatUpdatedField().contains("Updated <b>description</b>:"));
    assertTrue(formatter.formatUpdatedField().contains("<del>old</del>"));
    assertTrue(formatter.formatUpdatedField().contains("<ins>new</ins>"));
    assertEquals("Deleted <b>description</b>: <del>old</del>", formatter.formatDeletedField());
    assertEquals(
        "Added <b>description</b>: <ins>new</ins>",
        formatter.getFormattedMessage(FormatterUtil.CHANGE_TYPE.ADD));

    FeedInfo feedInfo = new FeedInfo().withHeaderMessage("header");
    DefaultFieldFormatter.populateThreadFeedInfo(
        message,
        "message",
        FormattedMessage.CardStyle.DESCRIPTION,
        FormattedMessage.FieldOperation.UPDATED,
        feedInfo);

    assertEquals("message", message.getMessage());
    assertEquals(FormattedMessage.CardStyle.DESCRIPTION, message.getCardStyle());
    assertEquals(FormattedMessage.FieldOperation.UPDATED, message.getFieldOperation());
    assertSame(feedInfo, message.getFeedInfo());
  }

  private static FormattedMessage baseMessage(String about) {
    return new FormattedMessage()
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
