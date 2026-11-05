package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.UpdateColumn;
import org.openmetadata.schema.type.ColumnConstraint;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.search.elasticsearch.ElasticSearchClient;
import org.openmetadata.service.security.Authorizer;

/**
 * Covers the entity-type gate and the per-type payload gating that {@code /v1/columns} writes run
 * before they touch a repository. These are the checks that decide whether a field the target type
 * has nowhere to store is rejected or silently dropped, so each one is asserted directly.
 *
 * <p>A payload that passes validation goes on to resolve a parent and fails with {@link
 * EntityNotFoundException} because no repository is registered in a unit test. That distinction is
 * what the "accepted" cases below assert: reaching the repository lookup means validation let the
 * field through.
 */
class ColumnRepositoryValidationTest {

  private ColumnRepository repository;

  @BeforeEach
  void setUp() {
    repository = new ColumnRepository(mock(Authorizer.class), mock(ElasticSearchClient.class));
  }

  @Test
  void unsupportedEntityTypeKeepsThePinnedPrefix() {
    // ColumnResourceIT.test_updateColumn_entityType_validation asserts on this prefix.
    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class,
            () -> update("a.b.c.d", "glossary", new UpdateColumn()));
    assertTrue(
        error.getMessage().startsWith("Unsupported entity type: glossary"), error.getMessage());
  }

  @Test
  void nullEntityTypeIsRejectedLikeAnUnsupportedOne() {
    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class, () -> update("a.b.c.d", null, new UpdateColumn()));
    assertTrue(error.getMessage().startsWith("Unsupported entity type: null"), error.getMessage());
  }

  @Test
  void everyRegistryTypeIsAdmittedByTheGate() {
    // The widening this endpoint exists for: a topic field no longer bounces off the type gate.
    // It reaches the repository lookup, which is as far as a unit test can take it.
    assertThrows(
        EntityNotFoundException.class,
        () -> update("service.topic.field", "topic", new UpdateColumn().withDescription("d")));
  }

  @Test
  void constraintIsRejectedForATypeWithoutConstraints() {
    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                update(
                    "service.topic.field",
                    "topic",
                    new UpdateColumn().withConstraint(ColumnConstraint.PRIMARY_KEY)));
    assertTrue(
        error.getMessage().contains("Column constraints are not supported for entity type topic"),
        error.getMessage());
  }

  @Test
  void removeConstraintIsRejectedTheSameWayAsSettingOne() {
    // removeConstraint is a separate boolean, so a gate that only looked at `constraint` would let
    // a meaningless removal through and report success.
    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                update(
                    "service.pipeline.task",
                    "pipeline",
                    new UpdateColumn().withRemoveConstraint(true)));
    assertTrue(
        error.getMessage().contains("Column constraints are not supported"), error.getMessage());
  }

  @Test
  void constraintOnDashboardDataModelStaysSilentlyIgnoredRatherThanRejected() {
    // Frozen behavior: dashboardDataModel has always accepted and dropped a constraint. Turning
    // that into a 400 would break clients that send one today.
    assertThrows(
        EntityNotFoundException.class,
        () ->
            update(
                "service.dashboard.model.column",
                "dashboardDataModel",
                new UpdateColumn().withConstraint(ColumnConstraint.PRIMARY_KEY)));
  }

  @Test
  void extensionIsRejectedForATypeWithNoCustomPropertyEntity() {
    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                update(
                    "service.index.field",
                    "searchIndex",
                    new UpdateColumn().withExtension(java.util.Map.of("anything", "x"))));
    assertTrue(
        error
            .getMessage()
            .contains("Column extension is not supported for entity type searchIndex"),
        error.getMessage());
  }

  @Test
  void extensionIsAcceptedForTheTwoTypesThatRegisterAChildExtensionEntity() {
    assertThrows(
        EntityNotFoundException.class,
        () ->
            update(
                "service.dashboard.model.column",
                "dashboardDataModel",
                new UpdateColumn().withExtension(java.util.Map.of("anything", "x"))));
  }

  @Test
  void displayNameIsAcceptedForEveryType() {
    // EntityNotFoundException, not IllegalArgumentException: the write cleared the
    // entity-type gate and only then failed to find the fixture, which is what shows
    // displayName is not rejected. mlFeature carries the property like its siblings.
    assertThrows(
        EntityNotFoundException.class,
        () -> update("service.topic.field", "topic", new UpdateColumn().withDisplayName("Field")));
    assertThrows(
        EntityNotFoundException.class,
        () ->
            update("service.model.feature", "mlmodel", new UpdateColumn().withDisplayName("Age")));
  }

  @Test
  void blankFqnIsRejectedBeforeTheEntityTypeGate() {
    // A blank FQN is rejected on its own terms; it must not surface as an entity-type complaint.
    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class, () -> update("   ", "table", new UpdateColumn()));
    assertTrue(error.getMessage().contains("columnFQN cannot be blank"), error.getMessage());
  }

  @Test
  void nullArgumentsAreRejected() {
    assertThrows(NullPointerException.class, () -> update(null, "table", new UpdateColumn()));
    assertThrows(NullPointerException.class, () -> update("a.b.c.d", "table", null));
  }

  @Test
  void readPathAppliesTheSameEntityTypeGate() {
    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class,
            () -> repository.getChildByFQN(null, "a.b.c", "chart", null, null));
    assertTrue(error.getMessage().startsWith("Unsupported entity type: chart"), error.getMessage());
  }

  @Test
  void readPathDoesNotApplyTheWriteOnlyPayloadGates() {
    // getChildByFQN has no payload, so widening the read must not inherit the write restrictions:
    // an mlmodel feature is readable even though its displayName is not writable.
    assertThrows(
        EntityNotFoundException.class,
        () -> repository.getChildByFQN(null, "service.model.feature", "mlmodel", null, null));
  }

  private void update(String columnFQN, String entityType, UpdateColumn updateColumn) {
    repository.updateChildByFQN(null, null, columnFQN, entityType, updateColumn, null);
  }
}
