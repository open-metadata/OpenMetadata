package org.openmetadata.service.entity.metadata;

import static org.openmetadata.service.Entity.FIELD_EXTENSION;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.getExtensionField;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import java.util.function.UnaryOperator;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.write.EntityMutationState;

/** Applies custom-property mutations through the caller's existing flush and change recorder. */
public final class EntityExtensionUpdater<T extends EntityInterface> {
  public interface Session<T extends EntityInterface> extends EntityMutationState<T> {
    <K> boolean recordChange(String field, K original, K updated);
  }

  private record Changes(List<JsonNode> added, List<JsonNode> deleted, List<JsonNode> updated) {
    private Changes() {
      this(new ArrayList<>(), new ArrayList<>(), new ArrayList<>());
    }

    private boolean isEmpty() {
      return added.isEmpty() && deleted.isEmpty() && updated.isEmpty();
    }
  }

  private final Consumer<EntityInterface> remove;
  private final Consumer<EntityInterface> store;
  private final UnaryOperator<Object> validate;

  public EntityExtensionUpdater(
      final Consumer<EntityInterface> remove,
      final Consumer<EntityInterface> store,
      final UnaryOperator<Object> validate) {
    this.remove = remove;
    this.store = store;
    this.validate = validate;
  }

  public void update(
      final Session<T> session, final boolean put, final boolean bot, final boolean consolidating) {
    final Object original = session.getOriginal().getExtension();
    final Object updated = session.getUpdated().getExtension();
    if (original == updated) {
      return;
    }
    if (put && (bot || updated == null)) {
      session.getUpdated().setExtension(original);
      return;
    }
    apply(session, original, updated, consolidating);
  }

  private void apply(
      final Session<T> session,
      final Object original,
      final Object updated,
      final boolean consolidating) {
    final JsonNode originalFields = JsonUtils.valueToTree(original);
    final JsonNode updatedFields = JsonUtils.valueToTree(updated);
    final Changes changes = diff(session, originalFields, updatedFields);
    if (!consolidating && updatedFields instanceof ObjectNode fields) {
      transform(session.getUpdated(), fields, changes);
    }
    if (!changes.isEmpty()) {
      record(session, changes);
      remove.accept(session.getOriginal());
      store.accept(session.getUpdated());
    }
  }

  private Changes diff(final Session<T> session, final JsonNode original, final JsonNode updated) {
    final Set<String> keys = new HashSet<>();
    original.fieldNames().forEachRemaining(keys::add);
    updated.fieldNames().forEachRemaining(keys::add);
    final Changes changes = new Changes();
    for (final String key : keys) {
      diffField(session, key, original.get(key), updated.get(key), changes);
    }
    return changes;
  }

  private void diffField(
      final Session<T> session,
      final String key,
      final JsonNode original,
      final JsonNode updated,
      final Changes changes) {
    if (original == null) {
      changes.added().add(JsonUtils.getObjectNode(key, updated));
    } else if (updated == null) {
      changes.deleted().add(JsonUtils.getObjectNode(key, original));
    } else if (!original.equals(updated)) {
      changes.updated().add(JsonUtils.getObjectNode(key, updated));
      session.recordChange(getExtensionField(key), original.toString(), updated.toString());
    }
  }

  private void transform(final T entity, final ObjectNode fields, final Changes changes) {
    changes.added().forEach(field -> transformField(fields, field));
    changes.updated().forEach(field -> transformField(fields, field));
    for (final JsonNode deleted : changes.deleted()) {
      deleted.fieldNames().forEachRemaining(fields::remove);
    }
    entity.setExtension(fields.isEmpty() ? null : JsonUtils.treeToValue(fields, Object.class));
  }

  private void transformField(final ObjectNode fields, final JsonNode field) {
    field
        .fields()
        .forEachRemaining(
            entry -> {
              final Map<String, Object> value = new HashMap<>();
              value.put(entry.getKey(), JsonUtils.treeToValue(entry.getValue(), Object.class));
              final JsonNode transformed = JsonUtils.valueToTree(validate.apply(value));
              if (transformed.isObject()) {
                fields.set(entry.getKey(), transformed.get(entry.getKey()));
              }
            });
  }

  private void record(final Session<T> session, final Changes changes) {
    if (!changes.added().isEmpty()) {
      fieldAdded(
          session.getChangeDescription(), FIELD_EXTENSION, JsonUtils.pojoToJson(changes.added()));
    }
    if (!changes.deleted().isEmpty()) {
      fieldDeleted(
          session.getChangeDescription(), FIELD_EXTENSION, JsonUtils.pojoToJson(changes.deleted()));
    }
  }
}
