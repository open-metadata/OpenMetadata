package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiPredicate;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.type.SearchIndexDataType;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil;

/**
 * Unit tests for the SearchIndex field "carry forward" logic in {@link
 * SearchIndexRepository.SearchIndexUpdater#updateSearchIndexFields}.
 *
 * <p>When a SearchIndex field's {@code dataType} changes between two ingestion runs, {@link
 * EntityUtil#searchIndexFieldMatch} (which matches on name AND dataType) classifies the old field as
 * deleted and the new field as added. The carry-forward block is then responsible for copying the
 * user-curated description from the deleted (old-datatype) field onto the added (new-datatype)
 * field. These tests pin that behavior and guard against regressions where the incoming field's
 * own description is incorrectly preserved (or incorrectly overwritten).
 */
class SearchIndexFieldCarryForwardTest {

  private static final String FIELD_NAME = "title";
  private static final String USER_DESCRIPTION = "user description";

  private SearchIndexRepository createRepo(MockedStatic<Entity> entityMock) {
    CollectionDAO dao = mock(CollectionDAO.class);
    when(dao.searchIndexDAO()).thenReturn(mock(CollectionDAO.SearchIndexDAO.class));
    // updateSearchIndexFields calls tagUsageDAO().deleteTagsByTarget(...) for every deleted field.
    when(dao.tagUsageDAO()).thenReturn(mock(CollectionDAO.TagUsageDAO.class));
    entityMock.when(Entity::getCollectionDAO).thenReturn(dao);
    entityMock
        .when(() -> Entity.getEntityFields(SearchIndex.class))
        .thenReturn(searchIndexEntityFields());
    return new SearchIndexRepository();
  }

  private static Set<String> searchIndexEntityFields() {
    // Mirrors SearchIndex's @JsonPropertyOrder; needed so the EntityRepository super constructor
    // (which reads allowedFields.contains(FIELD_TAGS), FIELD_FOLLOWERS, ...) does not NPE.
    return new HashSet<>(
        Arrays.asList(
            "id",
            "name",
            "fullyQualifiedName",
            "displayName",
            "description",
            "version",
            "updatedAt",
            "updatedBy",
            "impersonatedBy",
            "service",
            "serviceType",
            "fields",
            "searchIndexSettings",
            "indexType",
            "sampleData",
            "owners",
            "followers",
            "tags",
            "href",
            "changeDescription",
            "incrementalChangeDescription",
            "deleted",
            "extension",
            "domains",
            "dataProducts",
            "dataContract",
            "votes",
            "lifeCycle",
            "certification",
            "sourceHash",
            "entityStatus"));
  }

  /** Confirm the predicate used to route fields through the delete+add path matches on name+type. */
  private static void assertRoutedThroughDeleteAndAdd(
      SearchIndexField originalField, SearchIndexField updatedField) {
    BiPredicate<SearchIndexField, SearchIndexField> match = EntityUtil.searchIndexFieldMatch;
    boolean origStillMatchesUpdated = match.test(originalField, updatedField);
    assertEquals(
        false,
        origStillMatchesUpdated,
        "Test setup: the field must NOT match the predicate after a dataType change "
            + "so that recordListChange routes it through the deleted+added carry-forward branch");
  }

  private SearchIndex searchIndex(SearchIndexField field) {
    return new SearchIndex()
        .withId(UUID.randomUUID())
        .withName("reviews_index")
        .withFullyQualifiedName("elasticsearch.e2e.reviews_index")
        .withUpdatedBy("admin")
        .withVersion(0.1)
        .withFields(List.of(field));
  }

  private SearchIndexField field(String name, SearchIndexDataType type, String description) {
    return new SearchIndexField()
        .withName(name)
        .withDataType(type)
        .withDescription(description)
        .withFullyQualifiedName("elasticsearch.e2e.reviews_index." + name);
  }

  /**
   * Reproduction for the bug report: a user-set description on a field whose dataType changes
   * between two ingestion runs must be carried forward onto the re-added (new-datatype) field
   * rather than being dropped to null.
   */
  @Test
  void carryForwardPreservesUserDescriptionWhenDataTypeChanges() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      SearchIndexRepository repo = createRepo(entityMock);

      SearchIndexField originalField =
          field(FIELD_NAME, SearchIndexDataType.TEXT, USER_DESCRIPTION);
      SearchIndexField updatedField = field(FIELD_NAME, SearchIndexDataType.KEYWORD, null);
      assertRoutedThroughDeleteAndAdd(originalField, updatedField);

      SearchIndex original = searchIndex(originalField);
      SearchIndex updated = searchIndex(updatedField);

      SearchIndexRepository.SearchIndexUpdater updater =
          repo.new SearchIndexUpdater(original, updated, EntityRepository.Operation.PUT);

      updater.entitySpecificUpdate(false);

      SearchIndexField reAdded = updated.getFields().get(0);
      assertEquals(
          USER_DESCRIPTION,
          reAdded.getDescription(),
          "User-curated description must be carried forward from the deleted (old-datatype) "
              + "field onto the added (new-datatype) field — it must NOT be lost");
    }
  }

  /**
   * Non-regression: when the incoming (re-added) field already has its own description, the
   * deleted field's description must NOT overwrite it. The carry-forward only fires when the
   * incoming field lacks a description, mirroring {@code EntityRepository.updateColumns}.
   */
  @Test
  void carryForwardDoesNotOverwriteIncomingDescriptionWhenDataTypeChanges() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      SearchIndexRepository repo = createRepo(entityMock);

      SearchIndexField originalField =
          field(FIELD_NAME, SearchIndexDataType.TEXT, USER_DESCRIPTION);
      SearchIndexField updatedField =
          field(FIELD_NAME, SearchIndexDataType.KEYWORD, "incoming description");
      assertRoutedThroughDeleteAndAdd(originalField, updatedField);

      SearchIndex original = searchIndex(originalField);
      SearchIndex updated = searchIndex(updatedField);

      SearchIndexRepository.SearchIndexUpdater updater =
          repo.new SearchIndexUpdater(original, updated, EntityRepository.Operation.PUT);

      updater.entitySpecificUpdate(false);

      SearchIndexField reAdded = updated.getFields().get(0);
      assertEquals(
          "incoming description",
          reAdded.getDescription(),
          "An incoming description must NOT be overwritten by the deleted field's description");
    }
  }

  /**
   * Recursion guard: a child field whose dataType changes between runs also has its description
   * carried forward, because {@code updateSearchIndexFields} recurses into children.
   */
  @Test
  void carryForwardPreservesChildDescriptionWhenChildDataTypeChanges() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      SearchIndexRepository repo = createRepo(entityMock);

      SearchIndexField originalChild =
          field("title.subfield", SearchIndexDataType.TEXT, USER_DESCRIPTION);
      SearchIndexField originalParent =
          field(FIELD_NAME, SearchIndexDataType.OBJECT, null).withChildren(List.of(originalChild));
      SearchIndexField updatedChild = field("title.subfield", SearchIndexDataType.KEYWORD, null);
      SearchIndexField updatedParent =
          field(FIELD_NAME, SearchIndexDataType.OBJECT, null).withChildren(List.of(updatedChild));
      assertRoutedThroughDeleteAndAdd(originalChild, updatedChild);

      SearchIndex original = searchIndex(originalParent);
      SearchIndex updated = searchIndex(updatedParent);

      SearchIndexRepository.SearchIndexUpdater updater =
          repo.new SearchIndexUpdater(original, updated, EntityRepository.Operation.PUT);

      updater.entitySpecificUpdate(false);

      SearchIndexField reAddedChild = updated.getFields().get(0).getChildren().get(0);
      assertEquals(
          USER_DESCRIPTION,
          reAddedChild.getDescription(),
          "User-curated description must be carried forward for child fields whose dataType "
              + "changes during re-ingestion");
    }
  }
}
