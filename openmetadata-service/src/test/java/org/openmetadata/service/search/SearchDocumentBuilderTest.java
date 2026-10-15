package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.indexes.DocBuildContext;
import org.openmetadata.service.search.indexes.SearchIndex;

class SearchDocumentBuilderTest {
  private final SearchDocumentBuilder builder =
      new SearchDocumentBuilder(new SearchIndexFactory()::buildIndex);

  @BeforeAll
  static void registerTypes() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("tag", Entity.TAG);
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("testcase", Entity.TEST_CASE);
  }

  @Test
  void singleAndBatchPreparationProduceTheSameDocument() {
    final Tag tag = tag().withDescription("A governed asset");
    final Map<String, Object> single = builder.build(Entity.TAG, tag);
    final Map<String, Object> batch = builder.build(Entity.TAG, tag, DocBuildContext.empty(), null);
    assertEquals(single, batch);
    assertEquals("COMPLETE", single.get("descriptionStatus"));
    assertFalse(single.containsKey("changeDescription"));
    batch.put("name", "modified output");
    assertEquals(tag.getName(), single.get("name"));
  }

  @Test
  void nonVersionedUpdatesAvoidFullDocumentConstruction() {
    final Tag tag =
        tag()
            .withDescription("new")
            .withChangeDescription(
                new ChangeDescription()
                    .withPreviousVersion(1.0)
                    .withFieldsUpdated(
                        List.of(
                            new FieldChange()
                                .withName(Entity.FIELD_DESCRIPTION)
                                .withNewValue("new"))));
    final var partialOnly =
        new SearchDocumentBuilder(
            (type, value) -> {
              throw new AssertionError("Partial updates must not trigger full document hydration");
            });
    final SearchDocumentUpdate update = partialOnly.prepareUpdate(tag, null);
    assertEquals("new", update.parameters().get(Entity.FIELD_DESCRIPTION));
    assertEquals("COMPLETE", update.parameters().get("descriptionStatus"));
    assertFalse(update.parameters().containsKey("name"));
  }

  @Test
  void versionedAndUnknownChangesUseCompleteDocuments() {
    final Tag tag = tag().withChangeDescription(new ChangeDescription().withPreviousVersion(0.9));
    assertEquals(builder.build(Entity.TAG, tag), builder.prepareUpdate(tag, null).parameters());
    tag.setChangeDescription(
        new ChangeDescription()
            .withPreviousVersion(1.0)
            .withFieldsUpdated(
                List.of(new FieldChange().withName("provider").withNewValue("user"))));
    assertEquals(SearchClient.DEFAULT_UPDATE_SCRIPT, builder.prepareUpdate(tag, null).script());
    assertEquals(tag.getId().toString(), builder.prepareUpdate(tag, null).parameters().get("id"));
  }

  @Test
  void explicitRelationshipRevisionOverridesOnlyTheRevisionInBatchContext() {
    final var relationshipBuilder =
        new SearchDocumentBuilder(
            (type, entity) -> new SnapshotIndex((EntityInterface<?>) entity, type));
    final TestCase test = testCase();
    final var context = DocBuildContext.of(List.of(), null, 2L);
    final var document = relationshipBuilder.build(Entity.TEST_CASE, test, context, 7L);
    assertEquals(7L, document.get("testSuitesRevision"));
    assertEquals(7L, document.get("contextRevision"));
    assertEquals(List.of(), document.get("contextLineage"));
    final var update = relationshipBuilder.prepareUpdate(test, 9L);
    assertEquals(9L, update.parameters().get("testSuitesRevision"));
    assertTrue(
        update.script().contains("params.testSuitesRevision >= ctx._source.testSuitesRevision"));
    assertTrue(relationshipBuilder.prepareUpdate(test, null).scriptedUpsert());
  }

  @Test
  void revisionsCannotBeAppliedToUnrelatedEntityTypes() {
    assertThrows(
        IllegalArgumentException.class,
        () -> builder.build(Entity.TAG, tag(), DocBuildContext.empty(), 1L));
  }

  @Test
  void versionedDeletionsExplicitlyRemoveFieldsAbsentFromTheNewDocument() {
    final Tag tag =
        tag()
            .withVersion(1.1)
            .withChangeDescription(
                new ChangeDescription()
                    .withPreviousVersion(1.0)
                    .withFieldsDeleted(
                        List.of(
                            new FieldChange()
                                .withName(Entity.FIELD_DESCRIPTION)
                                .withOldValue("stale"))));
    final Map<String, Object> parameters = builder.prepareUpdate(tag, null).parametersForIndexing();
    assertTrue(((List<?>) parameters.get("fieldsToRemove")).contains(Entity.FIELD_DESCRIPTION));
    assertFalse(parameters.values().stream().anyMatch(Objects::isNull));
  }

  @Test
  void nestedDeletionsPreserveFreshCollectionsAndMergeConfiguredRemovals() {
    final Tag tag =
        tag()
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsDeleted(List.of(new FieldChange().withName("owners.name")))
                    .withFieldsUpdated(
                        List.of(new FieldChange().withName(Entity.FIELD_DESCRIPTION))));
    final Map<String, Object> document = new HashMap<>();
    document.put("owners", List.of());
    document.put("fieldsToRemove", List.of("displayName"));
    SearchDocumentUpdates.includeFieldRemovals(tag, document);
    assertEquals(List.of("description", "displayName"), document.get("fieldsToRemove"));
    assertEquals(List.of(), document.get("owners"));
  }

  private static Tag tag() {
    return new Tag()
        .withId(UUID.randomUUID())
        .withName("classified")
        .withFullyQualifiedName("Classification.classified")
        .withVersion(1.0)
        .withUpdatedAt(100L);
  }

  private static TestCase testCase() {
    return new TestCase()
        .withId(UUID.randomUUID())
        .withName("test")
        .withFullyQualifiedName("table.test")
        .withVersion(1.0);
  }

  /** A catalog extension using the common mapping contract without repository-specific enrichments. */
  private record SnapshotIndex(EntityInterface<?> entity, String entityType)
      implements SearchIndex {
    @Override
    public Object getEntity() {
      return entity;
    }

    @Override
    public String getEntityTypeName() {
      return entityType;
    }

    @Override
    public Map<String, Object> buildSearchIndexDocInternal(final Map<String, Object> document) {
      return document;
    }

    @Override
    public Map<String, Object> buildSearchIndexDoc(final DocBuildContext context) {
      final Map<String, Object> document = SearchIndex.super.buildSearchIndexDoc(context);
      document.put("contextRevision", context.relationshipRevision());
      document.put("contextLineage", context.prefetchedUpstreamLineage());
      return document;
    }
  }
}
