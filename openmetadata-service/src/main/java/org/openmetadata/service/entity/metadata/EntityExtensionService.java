package org.openmetadata.service.entity.metadata;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.StreamSupport;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.read.ReadBundle;
import org.openmetadata.service.entity.read.ReadBundleContext;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.ExtensionRecord;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.ExtensionRecordWithId;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

/** Persists custom-property rows through the caller's existing transaction-bound DAO graph. */
public final class EntityExtensionService {
  private static final String CUSTOM_FIELD_SCHEMA = "customFieldSchema";
  private static final String COLUMN_EXTENSION_SCHEMA = "columnExtension";
  private static final String ENUM = "enum";

  public record Properties(
      String prefix,
      Function<String, String> fullyQualifiedName,
      Function<String, String> name,
      Function<String, String> type) {}

  private record Batch(List<UUID> ids, List<String> names, List<String> values) {
    private Batch() {
      this(new ArrayList<>(), new ArrayList<>(), new ArrayList<>());
    }

    private void add(final UUID id, final String name, final JsonNode value) {
      ids.add(id);
      names.add(name);
      values.add(JsonUtils.pojoToJson(value));
    }
  }

  private final Supplier<EntityExtensionDAO> extensions;
  private final Properties properties;
  private final boolean supportsExtension;

  public EntityExtensionService(
      final Supplier<EntityExtensionDAO> extensions,
      final Properties properties,
      final boolean supportsExtension) {
    this.extensions = extensions;
    this.properties = properties;
    this.supportsExtension = supportsExtension;
  }

  public void store(final EntityInterface entity) {
    if (entity.getExtension() == null) {
      return;
    }
    final JsonNode fields = JsonUtils.valueToTree(entity.getExtension());
    fields
        .fields()
        .forEachRemaining(
            field ->
                extensions
                    .get()
                    .insert(
                        entity.getId(),
                        properties.fullyQualifiedName().apply(field.getKey()),
                        CUSTOM_FIELD_SCHEMA,
                        JsonUtils.pojoToJson(field.getValue())));
  }

  public void storeMany(final List<? extends EntityInterface> entities) {
    final Batch batch = new Batch();
    for (final EntityInterface entity : entities) {
      final JsonNode fields = JsonUtils.valueToTree(entity.getExtension());
      fields
          .fields()
          .forEachRemaining(
              field ->
                  batch.add(
                      entity.getId(),
                      properties.fullyQualifiedName().apply(field.getKey()),
                      field.getValue()));
    }
    extensions.get().insertMany(batch.ids(), batch.names(), CUSTOM_FIELD_SCHEMA, batch.values());
  }

  public void storeColumn(final UUID entityId, final Column column) {
    if (canStoreColumn(entityId, column)) {
      extensions
          .get()
          .insert(
              entityId,
              FullyQualifiedName.buildHash(column.getFullyQualifiedName()),
              COLUMN_EXTENSION_SCHEMA,
              JsonUtils.pojoToJson(column.getExtension()));
    }
  }

  public void storeColumns(final UUID entityId, final List<Column> columns) {
    if (entityId != null && !nullOrEmpty(columns)) {
      EntityUtil.getFlattenedEntityField(columns).forEach(column -> storeColumn(entityId, column));
    }
  }

  public void remove(final EntityInterface entity) {
    if (entity.getExtension() != null) {
      final JsonNode fields = JsonUtils.valueToTree(entity.getExtension());
      fields
          .fieldNames()
          .forEachRemaining(
              field ->
                  extensions
                      .get()
                      .delete(entity.getId(), properties.fullyQualifiedName().apply(field)));
    }
  }

  public void removeMany(final List<? extends EntityInterface> entities) {
    final List<String> ids =
        entities.stream()
            .filter(entity -> entity.getExtension() != null)
            .map(entity -> entity.getId().toString())
            .toList();
    if (!ids.isEmpty()) {
      // Column custom properties share these entity IDs and must survive entity-level replacement.
      extensions.get().deleteByJsonSchemaBatch(ids, CUSTOM_FIELD_SCHEMA);
    }
  }

  public Object read(final EntityInterface entity) {
    if (!supportsExtension || entity == null || entity.getId() == null) {
      return null;
    }
    final ReadBundle bundle = ReadBundleContext.getCurrent();
    if (bundle != null && bundle.hasExtension(entity.getId())) {
      return bundle.getExtensionOrNull(entity.getId());
    }
    final List<ExtensionRecord> records =
        extensions.get().getExtensions(entity.getId(), properties.prefix());
    return records.isEmpty() ? null : readProperties(records);
  }

  public void populate(final List<? extends EntityInterface> entities, final boolean selected) {
    if (!selected || !supportsExtension || nullOrEmpty(entities)) {
      return;
    }
    final Map<UUID, Object> values = readMany(entities);
    for (final EntityInterface entity : entities) {
      entity.setExtension(values.get(entity.getId()));
    }
  }

  public Map<UUID, Object> readMany(final List<? extends EntityInterface> entities) {
    if (!supportsExtension || nullOrEmpty(entities)) {
      return Collections.emptyMap();
    }
    final List<String> ids = entities.stream().map(entity -> entity.getId().toString()).toList();
    final List<ExtensionRecordWithId> records =
        extensions.get().getExtensionsBatch(ids, properties.prefix());
    final Map<UUID, Object> result = new HashMap<>();
    for (final ExtensionRecordWithId record : records) {
      final ObjectNode fields =
          (ObjectNode) result.computeIfAbsent(record.id(), ignored -> JsonUtils.getObjectNode());
      fields.set(
          properties.name().apply(record.extensionName()),
          JsonUtils.readTree(record.extensionJson()));
    }
    return result;
  }

  private ObjectNode readProperties(final List<ExtensionRecord> records) {
    final ObjectNode fields = JsonUtils.getObjectNode();
    for (final ExtensionRecord record : records) {
      final String field = properties.name().apply(record.extensionName());
      final JsonNode value = JsonUtils.readTree(record.extensionJson());
      fields.set(field, normalizeValue(field, value));
    }
    return fields;
  }

  private JsonNode normalizeValue(final String field, final JsonNode value) {
    final String type = properties.type().apply(field);
    if (ENUM.equals(type) && value.isArray() && value.size() > 1) {
      return JsonUtils.valueToTree(
          StreamSupport.stream(value.spliterator(), false).map(JsonNode::asText).sorted().toList());
    }
    return value;
  }

  private boolean canStoreColumn(final UUID entityId, final Column column) {
    return entityId != null
        && column != null
        && column.getExtension() != null
        && column.getFullyQualifiedName() != null;
  }
}
