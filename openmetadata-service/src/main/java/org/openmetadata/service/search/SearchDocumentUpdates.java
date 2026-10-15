package org.openmetadata.service.search;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.search.SearchClient.FIELDS_TO_REMOVE;
import static org.openmetadata.service.search.SearchConstants.TEST_SUITES;
import static org.openmetadata.service.util.EntityUtil.isNullOrEmptyChangeDescription;

import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Supplier;
import java.util.stream.Stream;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/** Update semantics shared by single writes, bulk writes and retry delivery. */
public final class SearchDocumentUpdates {
  private SearchDocumentUpdates() {}

  private static final String TESTS = "tests";
  private static final String TEST_SUITES_REVISION = "testSuitesRevision";
  private static final String TESTS_REVISION = "testsRevision";
  private static final RelationshipRevisionSpec TEST_CASE_RELATIONSHIP_REVISION =
      relationshipRevisionSpec(TEST_SUITES, TEST_SUITES_REVISION);
  private static final RelationshipRevisionSpec TEST_SUITE_RELATIONSHIP_REVISION =
      relationshipRevisionSpec(TESTS, TESTS_REVISION);

  private record RelationshipRevisionSpec(
      String relationshipField,
      String revisionField,
      String replacementScript,
      String documentUpdateScript) {}

  private static RelationshipRevisionSpec relationshipRevisionSpec(
      String relationshipField, String revisionField) {
    String replacementScript =
        """
        if (ctx._source.%2$s == null || params.%2$s >= ctx._source.%2$s) {
          ctx._source.%1$s = params.%1$s;
          ctx._source.%2$s = params.%2$s;
        }
        """
            .formatted(relationshipField, revisionField);
    String documentUpdateScript =
        """
        def preserveRelationship = ctx._source.containsKey('%1$s') || ctx._source.containsKey('%2$s');
        for (k in params.keySet()) {
          if (k != 'fieldsToRemove' && (!preserveRelationship || (k != '%1$s' && k != '%2$s'))) {
            ctx._source.put(k, params.get(k));
          }
        }
        if (params.containsKey('fieldsToRemove')) {
          for (field in params.fieldsToRemove) {
            if (!preserveRelationship || (field != '%1$s' && field != '%2$s')) {
              ctx._source.remove(field);
            }
          }
        }
        """
            .formatted(relationshipField, revisionField);
    return new RelationshipRevisionSpec(
        relationshipField, revisionField, replacementScript, documentUpdateScript);
  }

  private static RelationshipRevisionSpec relationshipRevisionSpec(EntityInterface<?> entity) {
    if (entity == null || entity.getEntityReference() == null) {
      return null;
    }
    String entityType = entity.getEntityReference().getType();
    if (Entity.TEST_CASE.equals(entityType)) {
      return TEST_CASE_RELATIONSHIP_REVISION;
    }
    if (Entity.TEST_SUITE.equals(entityType)
        && entity instanceof TestSuite testSuite
        && Boolean.FALSE.equals(testSuite.getBasic())) {
      return TEST_SUITE_RELATIONSHIP_REVISION;
    }
    return null;
  }

  public static SearchDocumentUpdate relationshipReplacement(
      EntityInterface<?> entity, Map<String, Object> document, long revision) {
    applyRelationshipRevision(entity, document, revision);
    return new SearchDocumentUpdate(relationshipRevisionSpec(entity).replacementScript(), document);
  }

  public static void applyRelationshipRevision(
      EntityInterface<?> entity, Map<String, Object> document, Long relationshipRevision) {
    if (relationshipRevision == null) {
      return;
    }
    RelationshipRevisionSpec revisionSpec = relationshipRevisionSpec(entity);
    if (revisionSpec == null) {
      throw new IllegalArgumentException(
          "Relationship revisions can only update test cases and logical test suites");
    }
    document.put(revisionSpec.revisionField(), relationshipRevision);
  }

  public static String getScriptWithParams(
      EntityInterface<?> entity,
      Map<String, Object> fieldAddParams,
      ChangeDescription changeDescription) {
    final SearchDocumentUpdate update = SearchPartialUpdate.prepare(entity, changeDescription);
    fieldAddParams.putAll(update.parameters());
    return update.script();
  }

  public static SearchDocumentUpdate buildRelationshipDocumentUpdate(
      EntityInterface<?> entity, Map<String, Object> document) {
    RelationshipRevisionSpec revisionSpec = relationshipRevisionSpec(entity);
    if (revisionSpec == null || document == null) {
      return null;
    }
    return new SearchDocumentUpdate(
        revisionSpec.documentUpdateScript(), new HashMap<>(document), true);
  }

  public static SearchDocumentUpdate buildBulkScriptedPartialUpdate(
      EntityInterface<?> entity, Long relationshipRevision) {
    RelationshipRevisionSpec revisionSpec = relationshipRevisionSpec(entity);
    if (revisionSpec == null || relationshipRevision == null) {
      return null;
    }
    ChangeDescription changeDescription = getEffectiveChangeDescription(entity);
    if (changeDescription != null) {
      if (!Set.of(revisionSpec.relationshipField()).equals(getChangedFieldNames(changeDescription))
          || !hasRelationshipReplacement(changeDescription, revisionSpec.relationshipField())) {
        return null;
      }
      boolean isNonVersionedUpdate =
          entity.getChangeDescription() != null
              && Objects.equals(
                  entity.getVersion(), entity.getChangeDescription().getPreviousVersion());
      if (!isNonVersionedUpdate) {
        return null;
      }
    }
    return relationshipFieldsAt(entity, relationshipRevision);
  }

  /**
   * Replaces the relationship field of a test case or logical suite with its value at {@code
   * relationshipRevision}, whatever the entity's last change was, as a rebuild from the database
   * writes it after the document. Null for entities without fenced relationships.
   */
  public static SearchDocumentUpdate relationshipFieldsAt(
      EntityInterface<?> entity, long relationshipRevision) {
    RelationshipRevisionSpec revisionSpec = relationshipRevisionSpec(entity);
    if (revisionSpec == null) {
      return null;
    }
    Map<String, Object> parameters = new HashMap<>();
    Object relationships = JsonUtils.getMap(entity).get(revisionSpec.relationshipField());
    parameters.put(
        revisionSpec.relationshipField(), relationships == null ? List.of() : relationships);
    parameters.put(revisionSpec.revisionField(), relationshipRevision);
    return new SearchDocumentUpdate(revisionSpec.replacementScript(), parameters);
  }

  // Clearing first drops the fields an entity no longer has, which a merge would keep forever.
  static final String REPLACE_DOCUMENT_SCRIPT =
      "ctx._source.clear();\n" + SearchClient.DEFAULT_UPDATE_SCRIPT;

  /**
   * An in-place rebuild's write. The freshly built document replaces the stored one, unless the
   * stored one was read more recently; a relationship-preserving update keeps its merge.
   */
  public static SearchDocumentUpdate forInPlaceWrite(
      final EntityInterface<?> entity,
      final SearchDocumentUpdate relationshipUpdate,
      final Supplier<Map<String, Object>> document,
      final long readAt) {
    final SearchDocumentUpdate update =
        relationshipUpdate != null
            ? relationshipUpdate
            : new SearchDocumentUpdate(REPLACE_DOCUMENT_SCRIPT, document.get(), true);
    return SearchVersionGuard.apply(update, entity, readAt);
  }

  public static SearchDocumentUpdate forBulkWrite(
      final EntityInterface<?> entity,
      final boolean relationshipUpdates,
      final Long relationshipRevision,
      final Supplier<Map<String, Object>> document) {
    final SearchDocumentUpdate partial =
        relationshipUpdates ? buildBulkScriptedPartialUpdate(entity, relationshipRevision) : null;
    if (relationshipUpdates && relationshipRevision != null && partial == null) {
      throw new IllegalStateException(
          "Missing fenced relationship update for " + entity.getEntityReference());
    }
    return partial != null
        ? partial
        : relationshipRevisionSpec(entity) == null
            ? null
            : buildRelationshipDocumentUpdate(entity, document.get());
  }

  static SearchDocumentUpdate buildScriptedPartialUpdate(
      EntityInterface<?> entity,
      ChangeDescription changeDescription,
      boolean isNonVersionedUpdate) {
    if (!isNonVersionedUpdate || !SearchPartialUpdate.supports(entity, changeDescription)) {
      return null;
    }
    return SearchPartialUpdate.prepare(entity, changeDescription);
  }

  public static ChangeDescription getEffectiveChangeDescription(EntityInterface<?> entity) {
    ChangeDescription incrementalChangeDescription = entity.getIncrementalChangeDescription();
    return !isNullOrEmptyChangeDescription(incrementalChangeDescription)
        ? incrementalChangeDescription
        : entity.getChangeDescription();
  }

  static void includeFieldRemovals(
      final EntityInterface<?> entity, final Map<String, Object> document) {
    final ChangeDescription changes = getEffectiveChangeDescription(entity);
    if (changes == null) {
      return;
    }
    final Set<String> removed = new TreeSet<>();
    if (document.get(FIELDS_TO_REMOVE) instanceof Iterable<?> configured) {
      configured.forEach(field -> removed.add(field.toString()));
    }
    removedFields(changes)
        .map(SearchDocumentUpdates::rootField)
        .filter(field -> document.get(field) == null)
        .forEach(removed::add);
    if (!removed.isEmpty()) {
      document.put(FIELDS_TO_REMOVE, List.copyOf(removed));
    }
  }

  private static Stream<String> removedFields(final ChangeDescription changes) {
    return Stream.concat(
            listOrEmpty(changes.getFieldsDeleted()).stream(),
            listOrEmpty(changes.getFieldsUpdated()).stream()
                .filter(change -> change.getNewValue() == null))
        .map(FieldChange::getName);
  }

  private static String rootField(final String path) {
    final int separator = path.indexOf('.');
    return separator < 0 ? path : path.substring(0, separator);
  }

  private static boolean hasRelationshipReplacement(
      ChangeDescription changeDescription, String relationshipField) {
    return changeDescription != null
        && listOrEmpty(changeDescription.getFieldsUpdated()).stream()
            .anyMatch(fieldChange -> relationshipField.equals(fieldChange.getName()));
  }

  static Set<String> getChangedFieldNames(ChangeDescription changeDescription) {
    if (changeDescription == null) {
      return Collections.emptySet();
    }

    Set<String> changedFields = new HashSet<>();
    listOrEmpty(changeDescription.getFieldsAdded())
        .forEach(fieldChange -> changedFields.add(fieldChange.getName()));
    listOrEmpty(changeDescription.getFieldsUpdated())
        .forEach(fieldChange -> changedFields.add(fieldChange.getName()));
    listOrEmpty(changeDescription.getFieldsDeleted())
        .forEach(fieldChange -> changedFields.add(fieldChange.getName()));
    return changedFields;
  }
}
