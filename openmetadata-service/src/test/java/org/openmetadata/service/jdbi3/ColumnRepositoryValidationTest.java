package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.UpdateColumn;
import org.openmetadata.service.search.elasticsearch.ElasticSearchClient;
import org.openmetadata.service.security.Authorizer;

/**
 * Covers the entity-type gate and argument checks that {@code /v1/columns} writes run before they
 * touch a repository. Consolidating the two per-type write paths merged the old null-entityType and
 * unsupported-entityType branches into one message, so the pinned prefix and the supported-type list
 * are asserted here rather than left to the integration suite.
 */
class ColumnRepositoryValidationTest {

  private ColumnRepository repository;

  @BeforeEach
  void setUp() {
    repository = new ColumnRepository(mock(Authorizer.class), mock(ElasticSearchClient.class));
  }

  @Test
  void updateColumnByFQN_unsupportedEntityTypeKeepsThePinnedPrefix() {
    // ColumnResourceIT.test_updateColumn_entityType_validation asserts on this prefix.
    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class,
            () -> update("some.table.column", "glossary", new UpdateColumn()));
    assertTrue(
        error.getMessage().startsWith("Unsupported entity type: glossary"), error.getMessage());
  }

  @Test
  void updateColumnByFQN_nullEntityTypeNowGivesTheSameMessageAsAnUnsupportedOne() {
    // Behavior change from the merge: null used to produce "Entity type is required...". Nothing
    // pinned that wording, and both inputs are the same client mistake, so they share one message.
    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class,
            () -> update("some.table.column", null, new UpdateColumn()));
    assertEquals(
        "Unsupported entity type: null. Supported types are: dashboardDataModel, table",
        error.getMessage());
  }

  @Test
  void updateColumnByFQN_messageListsEveryServedTypeInStableOrder() {
    // The list is built from the served-type set, so a type added to /v1/columns shows up here
    // without anyone remembering to edit the string. Sorted so the message does not churn.
    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class,
            () -> update("some.table.column", "topic", new UpdateColumn()));
    assertTrue(
        error.getMessage().endsWith("Supported types are: dashboardDataModel, table"),
        error.getMessage());
  }

  @Test
  void updateColumnByFQN_blankFqnIsRejectedBeforeTheEntityTypeGate() {
    // A blank FQN is rejected on its own terms; it must not surface as an entity-type complaint.
    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class, () -> update("   ", "table", new UpdateColumn()));
    assertEquals("columnFQN cannot be blank", error.getMessage());
  }

  @Test
  void updateColumnByFQN_nullArgumentsAreRejected() {
    assertThrows(NullPointerException.class, () -> update(null, "table", new UpdateColumn()));
    assertThrows(NullPointerException.class, () -> update("some.table.column", "table", null));
  }

  @Test
  void getColumnByFQN_appliesTheSameEntityTypeGate() {
    // The read path validates before resolving a parent FQN, so an unsupported type fails here and
    // not with a confusing "Invalid column FQN format" from the resolver.
    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class,
            () -> repository.getColumnByFQN(null, "some.topic.field", "topic", null, null));
    assertTrue(error.getMessage().startsWith("Unsupported entity type: topic"), error.getMessage());
  }

  private void update(String columnFQN, String entityType, UpdateColumn updateColumn) {
    repository.updateColumnByFQN(null, null, columnFQN, entityType, updateColumn);
  }
}
