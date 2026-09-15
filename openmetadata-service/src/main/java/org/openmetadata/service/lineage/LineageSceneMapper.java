/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.lineage;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.openmetadata.schema.api.lineage.LineageBand;
import org.openmetadata.schema.api.lineage.LineageLevelKind;
import org.openmetadata.schema.api.lineage.LineageSceneField;
import org.openmetadata.schema.api.lineage.RelationshipRef;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.type.lineage.NodeInformation;
import org.openmetadata.service.Entity;

final class LineageSceneMapper {
  private LineageSceneMapper() {}

  private static final String BASE_SOURCE_FIELDS =
      "id,name,displayName,fullyQualifiedName,entityType,service,serviceType,database,"
          + "databaseSchema,domains,dataProducts,tags,tier,deleted,certification";

  private static final String FIELD_BAND_SOURCE_FIELDS =
      BASE_SOURCE_FIELDS
          + ",columns,messageSchema,charts,mlFeatures,fields,dataModel,requestSchema,responseSchema";

  private static final List<String> BASE_SOURCE_FIELD_LIST = List.of(BASE_SOURCE_FIELDS.split(","));
  private static final List<String> FIELD_BAND_SOURCE_FIELD_LIST =
      List.of(FIELD_BAND_SOURCE_FIELDS.split(","));
  private static final List<String> BASE_TRIM_FIELDS = trimFields(BASE_SOURCE_FIELD_LIST);
  private static final List<String> FIELD_BAND_TRIM_FIELDS =
      trimFields(FIELD_BAND_SOURCE_FIELD_LIST);

  static final Set<String> SERVICE_ENTITY_TYPES =
      Set.of(
          Entity.DATABASE_SERVICE,
          Entity.MESSAGING_SERVICE,
          Entity.DASHBOARD_SERVICE,
          Entity.PIPELINE_SERVICE,
          Entity.MLMODEL_SERVICE,
          Entity.STORAGE_SERVICE,
          Entity.METADATA_SERVICE,
          Entity.SEARCH_SERVICE,
          Entity.SECURITY_SERVICE,
          Entity.API_SERVICE,
          Entity.DRIVE_SERVICE,
          Entity.LLM_SERVICE,
          Entity.MCP_SERVICE);

  static String sourceFieldsForBand(LineageBand band) {
    return band == LineageBand.FIELD ? FIELD_BAND_SOURCE_FIELDS : BASE_SOURCE_FIELDS;
  }

  static List<String> sourceFieldList(LineageBand band) {
    return band == LineageBand.FIELD ? FIELD_BAND_SOURCE_FIELD_LIST : BASE_SOURCE_FIELD_LIST;
  }

  static Map<String, SceneAsset> buildAssets(SearchLineageResult lineage, LineageBand band) {
    Map<String, SceneAsset> assets = new LinkedHashMap<>();
    if (lineage == null || lineage.getNodes() == null) {
      return assets;
    }
    for (NodeInformation nodeInformation : lineage.getNodes().values()) {
      if (nodeInformation == null || nodeInformation.getEntity() == null) {
        continue;
      }
      SceneAsset asset = toAsset(nodeInformation.getEntity(), band);
      if (!nullOrEmpty(asset.self().fqn())) {
        assets.put(asset.self().fqn(), asset);
      }
    }
    return assets;
  }

  static SceneAsset toAsset(Map<String, Object> entity) {
    return toAsset(entity, LineageBand.ASSET);
  }

  static SceneAsset toAsset(Map<String, Object> entity, LineageBand band) {
    String entityType = stringValue(entity, "entityType");
    if (nullOrEmpty(entityType)) {
      entityType = stringValue(entity, "type");
    }
    Ref self =
        new Ref(
            stringValue(entity, "id"),
            stringValue(entity, "fullyQualifiedName"),
            entityType,
            label(entity),
            levelKind(entityType),
            stringValue(entity, "serviceType"),
            trimSourceEntity(entity, band));

    Ref service = serviceRef(entity, entityType, self, band);
    Ref database = refValue(entity, "database", LineageLevelKind.DATABASE, band);
    Ref schema = refValue(entity, "databaseSchema", LineageLevelKind.SCHEMA, band);
    Ref domain = firstRef(entity, "domains", LineageLevelKind.DOMAIN, band);
    Ref dataProduct = firstRef(entity, "dataProducts", LineageLevelKind.DATA_PRODUCT, band);

    return new SceneAsset(
        self,
        service,
        database,
        schema,
        domain,
        dataProduct,
        new LineageSceneFieldIndex(fields(entity, self), band == LineageBand.FIELD),
        count(entity),
        syntheticCount(entity));
  }

  private static Ref serviceRef(
      Map<String, Object> entity, String entityType, Ref self, LineageBand band) {
    if (SERVICE_ENTITY_TYPES.contains(entityType)) {
      return self.withKind(LineageLevelKind.SERVICE);
    }
    Ref service = refValue(entity, "service", LineageLevelKind.SERVICE, band);
    if (service != null) {
      return service.withServiceType(stringValue(entity, "serviceType"));
    }
    return null;
  }

  static SceneAsset assetForRef(Map<String, SceneAsset> assets, RelationshipRef ref) {
    if (ref == null || nullOrEmpty(ref.getFullyQualifiedName())) {
      return null;
    }
    return assets.get(ref.getFullyQualifiedName());
  }

  static String fqn(Ref ref) {
    return ref == null ? null : ref.fqn();
  }

  static List<Ref> nullableList(Ref... refs) {
    List<Ref> values = new ArrayList<>();
    for (Ref ref : refs) {
      values.add(ref);
    }
    return values;
  }

  private static LineageLevelKind levelKind(String entityType) {
    if (entityType == null) {
      return LineageLevelKind.ASSET;
    }
    if (SERVICE_ENTITY_TYPES.contains(entityType)) {
      return LineageLevelKind.SERVICE;
    }
    return switch (entityType) {
      case Entity.DATABASE -> LineageLevelKind.DATABASE;
      case Entity.DATABASE_SCHEMA -> LineageLevelKind.SCHEMA;
      case Entity.TABLE -> LineageLevelKind.TABLE;
      case Entity.TOPIC -> LineageLevelKind.TOPIC;
      case Entity.DASHBOARD -> LineageLevelKind.DASHBOARD;
      case Entity.DASHBOARD_DATA_MODEL -> LineageLevelKind.DASHBOARD_DATA_MODEL;
      case Entity.CHART -> LineageLevelKind.CHART;
      case Entity.MLMODEL -> LineageLevelKind.MODEL;
      case Entity.PIPELINE -> LineageLevelKind.PIPELINE;
      case Entity.STORED_PROCEDURE -> LineageLevelKind.STORED_PROCEDURE;
      case Entity.DOMAIN -> LineageLevelKind.DOMAIN;
      case Entity.DATA_PRODUCT -> LineageLevelKind.DATA_PRODUCT;
      case Entity.CONTAINER -> LineageLevelKind.CONTAINER;
      case Entity.SEARCH_INDEX -> LineageLevelKind.SEARCH_INDEX;
      case Entity.API_ENDPOINT -> LineageLevelKind.API_ENDPOINT;
      case Entity.METRIC -> LineageLevelKind.METRIC;
      case Entity.DIRECTORY -> LineageLevelKind.DIRECTORY;
      case Entity.FILE -> LineageLevelKind.FILE;
      case Entity.SPREADSHEET -> LineageLevelKind.SPREADSHEET;
      case Entity.WORKSHEET -> LineageLevelKind.WORKSHEET;
      default -> LineageLevelKind.ASSET;
    };
  }

  static List<LineageSceneField> fields(Map<String, Object> entity, Ref self) {
    List<LineageSceneField> fields = new ArrayList<>();
    addFields(fields, listValue(entity, "columns"));
    addFields(fields, nestedList(entity, "dataModel", "columns"));
    addFields(fields, listValue(entity, "charts"));
    addFields(fields, listValue(entity, "mlFeatures"));
    addFields(fields, listValue(entity, "fields"));
    addFields(fields, nestedList(entity, "messageSchema", "schemaFields"));
    addFields(fields, nestedList(entity, "requestSchema", "schemaFields"));
    addFields(fields, nestedList(entity, "responseSchema", "schemaFields"));
    return fields.stream()
        .collect(
            LinkedHashMap<String, LineageSceneField>::new,
            (map, field) -> map.putIfAbsent(field.getId(), field),
            LinkedHashMap::putAll)
        .values()
        .stream()
        .map(field -> ensureFieldFqn(self, field))
        .toList();
  }

  private static LineageSceneField ensureFieldFqn(Ref self, LineageSceneField field) {
    String fqn = field.getFullyQualifiedName();
    if (!nullOrEmpty(fqn)) {
      return field;
    }
    String syntheticFqn = self.fqn() + "." + field.getName();
    return field.withId(syntheticFqn).withFullyQualifiedName(syntheticFqn);
  }

  private static void addFields(List<LineageSceneField> target, List<Map<String, Object>> fields) {
    for (Map<String, Object> field : fields) {
      String name = label(field);
      if (nullOrEmpty(name)) {
        continue;
      }
      String fqn = stringValue(field, "fullyQualifiedName");
      target.add(
          new LineageSceneField()
              .withId(firstNonBlank(fqn, name))
              .withName(name)
              .withFullyQualifiedName(fqn)
              .withDataType(
                  firstNonBlank(
                      stringValue(field, "dataTypeDisplay"), stringValue(field, "dataType"))));
    }
  }

  private static List<Map<String, Object>> nestedList(
      Map<String, Object> entity, String objectKey, String listKey) {
    Map<String, Object> object = mapValue(entity.get(objectKey));
    return object == null ? List.of() : listValue(object, listKey);
  }

  private static Ref refValue(Map<String, Object> entity, String key, LineageLevelKind kind) {
    return refValue(entity, key, kind, LineageBand.ASSET);
  }

  private static Ref refValue(
      Map<String, Object> entity, String key, LineageLevelKind kind, LineageBand band) {
    Map<String, Object> ref = mapValue(entity.get(key));
    return ref == null ? null : refFromMap(ref, kind, stringValue(entity, "serviceType"), band);
  }

  private static Ref firstRef(Map<String, Object> entity, String key, LineageLevelKind kind) {
    return firstRef(entity, key, kind, LineageBand.ASSET);
  }

  private static Ref firstRef(
      Map<String, Object> entity, String key, LineageLevelKind kind, LineageBand band) {
    List<Map<String, Object>> refs = listValue(entity, key);
    return refs.isEmpty()
        ? null
        : refFromMap(refs.get(0), kind, stringValue(entity, "serviceType"), band);
  }

  private static Ref refFromMap(
      Map<String, Object> ref, LineageLevelKind kind, String serviceType) {
    return refFromMap(ref, kind, serviceType, LineageBand.ASSET);
  }

  private static Ref refFromMap(
      Map<String, Object> ref, LineageLevelKind kind, String serviceType, LineageBand band) {
    String entityType = stringValue(ref, "type");
    if (nullOrEmpty(entityType)) {
      entityType = stringValue(ref, "entityType");
    }
    return new Ref(
        stringValue(ref, "id"),
        stringValue(ref, "fullyQualifiedName"),
        entityType,
        label(ref),
        kind,
        serviceType,
        trimSourceEntity(ref, band));
  }

  static Map<String, Object> trimSourceEntity(Map<String, Object> entity, LineageBand band) {
    List<String> allowedFields =
        band == LineageBand.FIELD ? FIELD_BAND_TRIM_FIELDS : BASE_TRIM_FIELDS;
    Map<String, Object> trimmed = new LinkedHashMap<>();
    for (String field : allowedFields) {
      if (entity.containsKey(field)) {
        trimmed.put(field, entity.get(field));
      }
    }
    return trimmed;
  }

  private static List<String> trimFields(List<String> sourceFields) {
    List<String> fields = new ArrayList<>(sourceFields);
    fields.addAll(List.of("type", "lineageSceneCount", "lineageSceneSyntheticCount"));
    return List.copyOf(fields);
  }

  static List<Map<String, Object>> listValue(Map<String, Object> entity, String key) {
    Object value = entity.get(key);
    if (!(value instanceof List<?> list)) {
      return List.of();
    }
    List<Map<String, Object>> values = new ArrayList<>();
    for (Object item : list) {
      Map<String, Object> map = mapValue(item);
      if (map != null) {
        values.add(map);
      }
    }
    return values;
  }

  @SuppressWarnings("unchecked")
  static Map<String, Object> mapValue(Object value) {
    return value instanceof Map<?, ?> map ? (Map<String, Object>) map : null;
  }

  static String stringValue(Map<?, ?> map, String key) {
    if (map == null) {
      return null;
    }
    Object value = map.get(key);
    return value == null ? null : String.valueOf(value);
  }

  static int count(Map<String, Object> entity) {
    Object count = entity.get("lineageSceneCount");
    if (count instanceof Number number) {
      return Math.max(0, number.intValue());
    }
    if (count instanceof String value) {
      try {
        return Math.max(0, Integer.parseInt(value));
      } catch (NumberFormatException ignored) {
        return 1;
      }
    }
    return 1;
  }

  static boolean syntheticCount(Map<String, Object> entity) {
    Object synthetic = entity.get("lineageSceneSyntheticCount");
    return Boolean.TRUE.equals(synthetic) || "true".equalsIgnoreCase(String.valueOf(synthetic));
  }

  static String label(Map<String, Object> entity) {
    return firstNonBlank(
        stringValue(entity, "displayName"),
        stringValue(entity, "name"),
        lastFqnPart(stringValue(entity, "fullyQualifiedName")));
  }

  static String lastFqnPart(String fqn) {
    if (nullOrEmpty(fqn)) {
      return null;
    }
    int index = fqn.lastIndexOf('.');
    return index < 0 ? fqn : fqn.substring(index + 1);
  }

  static String firstNonBlank(String... values) {
    for (String value : values) {
      if (!nullOrEmpty(value)) {
        return value;
      }
    }
    return null;
  }

  record Ref(
      String id,
      String fqn,
      String entityType,
      String label,
      LineageLevelKind kind,
      String serviceType,
      Map<String, Object> sourceEntity) {
    String nodeId() {
      String raw = firstNonBlank(id, fqn, label);
      return kind.value() + ":" + raw;
    }

    Ref withKind(LineageLevelKind nextKind) {
      return new Ref(id, fqn, entityType, label, nextKind, serviceType, sourceEntity);
    }

    Ref withServiceType(String nextServiceType) {
      return new Ref(id, fqn, entityType, label, kind, nextServiceType, sourceEntity);
    }
  }

  record SceneAsset(
      Ref self,
      Ref service,
      Ref database,
      Ref schema,
      Ref domain,
      Ref dataProduct,
      LineageSceneFieldIndex fieldIndex,
      int count,
      boolean syntheticCount) {
    List<LineageSceneField> fields() {
      return fieldIndex.fields();
    }

    boolean hasFqn(String fqn) {
      return Objects.equals(fqn, fqn(self))
          || Objects.equals(fqn, fqn(service))
          || Objects.equals(fqn, fqn(database))
          || Objects.equals(fqn, fqn(schema))
          || Objects.equals(fqn, fqn(domain))
          || Objects.equals(fqn, fqn(dataProduct));
    }

    boolean isDescendantOf(Ref ref) {
      return ref != null && hasFqn(ref.fqn());
    }

    String serviceType() {
      return firstNonBlank(self.serviceType(), service == null ? null : service.serviceType());
    }

    Ref refForFqn(String fqn) {
      for (Ref ref : nullableList(service, database, schema, domain, dataProduct, self)) {
        if (ref != null && Objects.equals(fqn, ref.fqn())) {
          return ref;
        }
      }
      return null;
    }
  }
}
