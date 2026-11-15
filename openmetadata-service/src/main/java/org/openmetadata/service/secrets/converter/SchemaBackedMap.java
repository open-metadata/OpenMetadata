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

package org.openmetadata.service.secrets.converter;

import static org.openmetadata.service.secrets.converter.SchemaKeywords.ADDITIONAL_PROPERTIES;
import static org.openmetadata.service.secrets.converter.SchemaKeywords.ADDITIONAL_PROPERTIES_ACCESSOR;
import static org.openmetadata.service.secrets.converter.SchemaKeywords.ITEMS;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import java.util.stream.Collectors;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.secrets.converter.JsonSchemaRepository.Ref;

/** A lossless stored JSON object with nonserialized schema context for secret traversal. */
public final class SchemaBackedMap extends LinkedHashMap<String, Object> {
  private final transient Ref schema;
  private final transient JsonSchemaRepository schemas;

  SchemaBackedMap(Map<?, ?> value, Ref schema, JsonSchemaRepository schemas) {
    value.forEach((key, child) -> put(key.toString(), copy(child)));
    this.schema = schema;
    this.schemas = schemas;
  }

  /** A mutable JSON leaf and its existing typed-walker identity. */
  public static final class SecretSlot {
    private final Object holder;
    private final String key;
    private final List<String> path;
    private final List<String> jsonPath;
    private final List<String> fieldPath;
    private final List<Integer> ownerPathLengths;
    private final boolean mapEntry;

    private SecretSlot(Object holder, String key, Position position, boolean mapEntry) {
      this.holder = holder;
      this.key = key;
      path = position.path();
      jsonPath = position.jsonPath();
      fieldPath = position.fieldPath();
      ownerPathLengths = position.owners();
      this.mapEntry = mapEntry;
    }

    public List<String> path() {
      return path;
    }

    public List<String> fieldPath() {
      return fieldPath;
    }

    public List<String> jsonPath() {
      return jsonPath;
    }

    public List<Integer> ownerPathLengths() {
      return ownerPathLengths;
    }

    public Object value() {
      return holder instanceof List<?> values
          ? values.get(Integer.parseInt(key))
          : castMap((Map<?, ?>) holder).get(key);
    }

    public void setValue(Object value) {
      if (holder instanceof List<?> values) {
        @SuppressWarnings("unchecked")
        List<Object> mutable = (List<Object>) values;
        mutable.set(Integer.parseInt(key), value);
      } else {
        castMap((Map<?, ?>) holder).put(key, value);
      }
    }

    public boolean mapEntry() {
      return mapEntry;
    }
  }

  private record Visit(String location, List<String> jsonPath) {}

  private record Position(
      List<String> path, List<String> jsonPath, List<Integer> owners, List<String> fieldPath) {
    Position child(String suffix, String name) {
      return new Position(
          append(path, suffix), append(jsonPath, name), owners, append(fieldPath, suffix));
    }

    Position property(String suffix, String name) {
      return new Position(
          append(path, suffix),
          append(jsonPath, name),
          owners,
          append(fieldPath, suffix.toLowerCase(Locale.ROOT)));
    }

    Position holder() {
      return new Position(path, jsonPath, append(owners, path.size()), fieldPath);
    }

    Position additionalProperties() {
      return new Position(
              append(path, ADDITIONAL_PROPERTIES_ACCESSOR),
              jsonPath,
              owners,
              append(fieldPath, ADDITIONAL_PROPERTIES_ACCESSOR.toLowerCase(Locale.ROOT)))
          .holder();
    }
  }

  /** Uses a name only when the generated element type exposes the same String getter. */
  public String collectionName() {
    Object name = hasNamedClass(schema, new HashSet<>()) ? get("name") : null;
    return name instanceof String text && !text.isEmpty() ? text : null;
  }

  public void visitSecrets(Consumer<SecretSlot> visitor) {
    Map<List<String>, SecretSlot> slots = new LinkedHashMap<>();
    visit(
        this,
        schema,
        new Position(List.of(), List.of(), List.of(), List.of()),
        new HashSet<>(),
        slots);
    slots.values().forEach(visitor);
  }

  private void visit(
      Object value,
      Ref reference,
      Position position,
      Set<Visit> active,
      Map<List<String>, SecretSlot> slots) {
    if (value == null || !schemas.containsPasswordFormat(reference)) {
      return;
    }
    Ref current = schemas.dereference(reference);
    Visit identity = new Visit(current.location(), position.jsonPath());
    if (!active.add(identity)) {
      return;
    }
    JsonSchemaRepository.Facts facts = schemas.facts(current);
    facts.branches().forEach(branch -> visit(value, branch, position, active, slots));
    facts.allOf().forEach(branch -> visit(value, branch, position, active, slots));
    if (value instanceof Map<?, ?> map) {
      visitObject(castMap(map), current, position, active, slots);
    } else if (value instanceof List<?> list) {
      visitCollection(list, current, position, active, slots);
    }
    active.remove(identity);
  }

  private void visitObject(
      Map<String, Object> value,
      Ref current,
      Position position,
      Set<Visit> active,
      Map<List<String>, SecretSlot> slots) {
    Map<String, Ref> properties = schemas.facts(current).properties();
    for (Map.Entry<String, Ref> property : properties.entrySet()) {
      String key = property.getKey();
      if (value.get(key) != null) {
        Position child = position.property(schemas.accessorSuffix(current, key), key);
        visitProperty(value, key, property.getValue(), child, active, slots);
      }
    }
    visitAdditional(value, current, position, active, slots);
  }

  private void visitProperty(
      Map<String, Object> holder,
      String key,
      Ref property,
      Position position,
      Set<Visit> active,
      Map<List<String>, SecretSlot> slots) {
    if (hasScalarPassword(property, new HashSet<>())) {
      slots.putIfAbsent(position.jsonPath(), new SecretSlot(holder, key, position, false));
    } else {
      Object value = holder.get(key);
      visit(
          value,
          property,
          value instanceof Map<?, ?> ? position.holder() : position,
          active,
          slots);
    }
  }

  private void visitAdditional(
      Map<String, Object> value,
      Ref current,
      Position position,
      Set<Visit> active,
      Map<List<String>, SecretSlot> slots) {
    Ref additional = schemas.child(current, ADDITIONAL_PROPERTIES);
    if (additional == null || !additional.node().isObject()) {
      return;
    }
    Position container =
        schemas.hasAdditionalPropertiesHolder(current) ? position.additionalProperties() : position;
    for (String key : value.keySet()) {
      if (!schemas.facts(current).properties().containsKey(key)) {
        Position entry = container.child(key, key);
        if (hasScalarPassword(additional, new HashSet<>()) && value.get(key) instanceof String) {
          slots.putIfAbsent(entry.jsonPath(), new SecretSlot(value, key, entry, true));
        } else if (!hasScalarPassword(additional, new HashSet<>())) {
          visit(value.get(key), additional, entry.holder(), active, slots);
        }
      }
    }
  }

  private void visitCollection(
      List<?> values,
      Ref current,
      Position position,
      Set<Visit> active,
      Map<List<String>, SecretSlot> slots) {
    Ref items = schemas.child(current, ITEMS);
    if (items == null) {
      return;
    }
    List<String> keys = elementKeys(values, items);
    for (int index = 0; index < values.size(); index++) {
      Position element = position.child(keys.get(index), Integer.toString(index));
      if (hasScalarPassword(items, new HashSet<>())) {
        slots.putIfAbsent(
            element.jsonPath(), new SecretSlot(values, Integer.toString(index), element, false));
      } else {
        visit(values.get(index), items, element.holder(), active, slots);
      }
    }
  }

  private boolean hasScalarPassword(Ref reference, Set<String> visited) {
    Ref current = schemas.dereference(reference);
    if (!visited.add(current.location())) {
      return false;
    }
    return SchemaKeywords.PASSWORD.equals(reference.node().path(SchemaKeywords.FORMAT).asText())
        || schemas.facts(current).password()
        || schemas.branches(current).stream().anyMatch(branch -> hasScalarPassword(branch, visited))
        || schemas.facts(current).allOf().stream()
            .anyMatch(branch -> hasScalarPassword(branch, visited));
  }

  private List<String> elementKeys(List<?> values, Ref items) {
    List<String> names = new ArrayList<>();
    Map<String, Integer> occurrences = new HashMap<>();
    boolean named = hasNamedClass(items, new HashSet<>());
    for (Object value : values) {
      Object name = named && value instanceof Map<?, ?> map ? map.get("name") : null;
      String usable = name instanceof String text && !text.isEmpty() ? text : null;
      names.add(usable);
      if (usable != null) {
        occurrences.merge(usable, 1, Integer::sum);
      }
    }
    List<String> keys = new ArrayList<>();
    for (int index = 0; index < names.size(); index++) {
      String name = names.get(index);
      keys.add(name != null && occurrences.get(name) == 1 ? name : "#" + index);
    }
    return keys;
  }

  private boolean hasNamedClass(Ref current, Set<String> visited) {
    current = schemas.dereference(current);
    if (!visited.add(current.location())) {
      return false;
    }
    return schemas.hasName(current)
        || schemas.branches(current).stream().anyMatch(branch -> hasNamedClass(branch, visited));
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> castMap(Map<?, ?> value) {
    return (Map<String, Object>) value;
  }

  private static Object copy(Object value) {
    if (value instanceof Map<?, ?> map) {
      Map<String, Object> copied = new LinkedHashMap<>();
      map.forEach((key, child) -> copied.put(key.toString(), copy(child)));
      return copied;
    }
    if (value instanceof Collection<?> values) {
      return values.stream()
          .map(SchemaBackedMap::copy)
          .collect(Collectors.toCollection(ArrayList::new));
    }
    if (value != null && value.getClass().getPackageName().startsWith("org.openmetadata")) {
      return JsonUtils.convertValue(value, Object.class);
    }
    return value;
  }

  private static <T> List<T> append(List<T> values, T value) {
    List<T> result = new ArrayList<>(values);
    result.add(value);
    return List.copyOf(result);
  }
}
