package org.openmetadata.service.search;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_EXTENSION;
import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.FIELD_PIPELINE_STATUS;
import static org.openmetadata.service.Entity.FIELD_USAGE_SUMMARY;
import static org.openmetadata.service.Entity.FIELD_VOTES;
import static org.openmetadata.service.search.CustomPropertySearchFields.CUSTOM_PROPERTIES_TYPED;
import static org.openmetadata.service.search.SearchDocumentFields.DESCRIPTION_SOURCES;
import static org.openmetadata.service.search.SearchDocumentFields.DESCRIPTION_STATUS;

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/** Prepares only mutations whose complete indexed effect is known without reloading the entity. */
final class SearchPartialUpdate {
  private static final String QUERY_USED_IN = "queryUsedIn";
  private static final String UPDATED_AT = "updatedAt";
  private static final String FOLLOWERS_TO_ADD = "followersToAdd";
  private static final String FOLLOWERS_TO_REMOVE = "followersToRemove";
  private static final String REQUIRE_EXISTING_DOCUMENT_SCRIPT =
      """
      if (ctx.op == 'create') {
        throw new IllegalStateException('Partial indexing requires an existing document');
      }
      """;
  private static final Set<String> ADD_DELETE_FIELDS =
      Set.of(FIELD_DESCRIPTION, FIELD_EXTENSION, FIELD_FOLLOWERS);
  private static final Set<String> UPDATE_FIELDS =
      Set.of(
          FIELD_DESCRIPTION,
          FIELD_EXTENSION,
          FIELD_USAGE_SUMMARY,
          FIELD_VOTES,
          FIELD_PIPELINE_STATUS,
          QUERY_USED_IN);

  private final EntityInterface<?> entity;
  private final Map<String, Object> parameters = new HashMap<>();
  // Rejecting a partial upsert lets the durable retry path reload the complete database state.
  private final StringBuilder script = new StringBuilder(REQUIRE_EXISTING_DOCUMENT_SCRIPT);
  private final Set<String> addedFollowers = new LinkedHashSet<>();
  private final Set<String> removedFollowers = new LinkedHashSet<>();

  private SearchPartialUpdate(final EntityInterface<?> entity) {
    this.entity = entity;
  }

  static boolean supports(final EntityInterface<?> entity, final ChangeDescription changes) {
    return changes != null
        && !SearchDocumentUpdates.getChangedFieldNames(changes).isEmpty()
        && listOrEmpty(changes.getFieldsAdded()).stream()
            .allMatch(change -> ADD_DELETE_FIELDS.contains(change.getName()))
        && listOrEmpty(changes.getFieldsDeleted()).stream()
            .allMatch(change -> ADD_DELETE_FIELDS.contains(change.getName()))
        && listOrEmpty(changes.getFieldsUpdated()).stream()
            .allMatch(change -> supportsReplacement(entity, change.getName()));
  }

  private static boolean supportsReplacement(final EntityInterface<?> entity, final String field) {
    final String entityType = entity.getEntityReference().getType();
    return UPDATE_FIELDS.contains(field)
        && (!QUERY_USED_IN.equals(field) || Entity.QUERY.equals(entityType))
        && (!FIELD_PIPELINE_STATUS.equals(field) || Entity.PIPELINE.equals(entityType));
  }

  static SearchDocumentUpdate prepare(
      final EntityInterface<?> entity, final ChangeDescription changes) {
    if (!supports(entity, changes)) {
      throw new IllegalArgumentException("Changes require complete search document preparation");
    }
    final SearchPartialUpdate update = new SearchPartialUpdate(entity);
    update.replace(UPDATED_AT, entity.getUpdatedAt());
    listOrEmpty(changes.getFieldsAdded()).forEach(change -> update.applyDelta(change, true));
    listOrEmpty(changes.getFieldsDeleted()).forEach(change -> update.applyDelta(change, false));
    listOrEmpty(changes.getFieldsUpdated()).forEach(update::applyReplacement);
    return new SearchDocumentUpdate(update.script.toString(), update.parameters);
  }

  private void applyDelta(final FieldChange change, final boolean added) {
    if (FIELD_FOLLOWERS.equals(change.getName())) {
      applyFollowers(added ? change.getNewValue() : change.getOldValue(), added);
    } else {
      applyReplacement(change);
    }
  }

  private void applyReplacement(final FieldChange change) {
    switch (change.getName()) {
      case FIELD_DESCRIPTION -> replaceDescription();
      case FIELD_EXTENSION -> replaceExtension();
      case FIELD_VOTES -> replaceVotes();
      case FIELD_USAGE_SUMMARY -> replace(FIELD_USAGE_SUMMARY, change.getNewValue());
      case QUERY_USED_IN -> replaceQueryUsage(change.getNewValue());
      case FIELD_PIPELINE_STATUS -> replace(
          FIELD_PIPELINE_STATUS, JsonUtils.getMap(entity).get(FIELD_PIPELINE_STATUS));
      default -> throw new IllegalArgumentException(
          "Unsupported partial field: " + change.getName());
    }
  }

  private void replaceDescription() {
    replace(FIELD_DESCRIPTION, entity.getDescription());
    replace(DESCRIPTION_STATUS, SearchDocumentFields.descriptionStatus(entity));
    replace(DESCRIPTION_SOURCES, SearchDocumentFields.descriptionSources(entity));
  }

  private void replaceExtension() {
    replace(FIELD_EXTENSION, entity.getExtension());
    replace(
        CUSTOM_PROPERTIES_TYPED,
        SearchIndexUtils.buildTypedCustomProperties(
            entity.getExtension(), entity.getEntityReference().getType()));
  }

  private void replaceVotes() {
    final Map<String, Object> fields = new HashMap<>();
    fields.put(FIELD_VOTES, null);
    SearchDocumentFields.populateVotes(fields, entity.getVotes());
    fields.forEach(this::replace);
  }

  private void replaceQueryUsage(final Object value) {
    replace(QUERY_USED_IN, value);
    replace(
        FIELD_DOMAINS,
        listOrEmpty(entity.getDomains()).stream().map(SearchIndexUtils::toEntityRefMap).toList());
  }

  private void replace(final String field, final Object value) {
    if (value == null) {
      script.append("ctx._source.remove('").append(field).append("');");
    } else {
      parameters.put(field, value);
      script.append("ctx._source.").append(field).append("=params.").append(field).append(";");
    }
  }

  private void applyFollowers(final Object value, final boolean added) {
    final List<EntityReference> followers =
        JsonUtils.convertValue(value, new TypeReference<List<EntityReference>>() {});
    final String parameter = added ? FOLLOWERS_TO_ADD : FOLLOWERS_TO_REMOVE;
    final Set<String> identities = added ? addedFollowers : removedFollowers;
    listOrEmpty(followers).forEach(follower -> identities.add(follower.getId().toString()));
    parameters.put(parameter, List.copyOf(identities));
    script.append(added ? ADD_FOLLOWERS_SCRIPT : REMOVE_FOLLOWERS_SCRIPT);
  }

  private static final String ADD_FOLLOWERS_SCRIPT =
      """
      if (ctx._source.followers == null) { ctx._source.followers = []; }
      for (follower in params.followersToAdd) {
        if (!ctx._source.followers.contains(follower)) { ctx._source.followers.add(follower); }
      }
      """;
  private static final String REMOVE_FOLLOWERS_SCRIPT =
      """
      if (ctx._source.followers != null) {
        ctx._source.followers.removeAll(params.followersToRemove);
      }
      """;
}
