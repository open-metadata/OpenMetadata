/*
 *  Copyright 2025 Collate.
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
package org.openmetadata.codegen;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Stream;

/**
 * One-time bootstrap: reverse-engineers the spec from the committed index mappings.
 *
 * <p>Produces <b>one</b> {@code entities/<entity>.json} per entity. A field is declared once;
 * where a language genuinely differs, that field carries a {@code languages} delta. The
 * systematic analyzer/normalizer renames are factored out into {@code languages/<lang>.json}.
 * Every classification is verified, so the spec reproduces all committed mappings exactly.
 */
public final class SpecExtractor {
  private static final String MAPPING_SUFFIX = "_index_mapping.json";
  private static final List<String> LANGUAGES = List.of("en", "jp", "ru", "zh");
  private static final Set<String> ANALYZER_KEYS =
      Set.of("analyzer", "search_analyzer", "normalizer");
  private static final List<String> FIELD_FRAGMENTS =
      List.of(
          "entityReference",
          "tagLabel",
          "upstreamLineage",
          "entityRelationship",
          "usageSummary",
          "customPropertiesTyped",
          "certification",
          "columns");
  private static final Set<String> LIST_FIELDS =
      Set.of(
          "owners",
          "domains",
          "dataProducts",
          "tags",
          "followers",
          "reviewers",
          "experts",
          "columns",
          "columnNames",
          "classificationTags",
          "glossaryTags",
          "customPropertiesTyped",
          "upstreamLineage",
          "charts",
          "mlFeatures",
          "tasks",
          "fields",
          "tableConstraints",
          "dataModels",
          "apiEndpoints",
          "mlHyperParameters");

  /** camelCase index names whose entity schema file is named differently. */
  private static final Map<String, String> SCHEMA_ALIASES =
      Map.of("searchEntity", "searchIndex", "dataProducts", "dataProduct");

  private final Path specDir;
  private final Map<String, JsonNode> fieldTypeRecipes = new LinkedHashMap<>();
  private final Map<String, JsonNode> fragmentShapes = new LinkedHashMap<>();
  private final EntitySchemas entitySchemas;

  public SpecExtractor(Path specDir) {
    this.specDir = specDir;
    Spec spec = new Spec(specDir);
    MappingGenerator generator = new MappingGenerator(spec);
    loadFieldTypes(spec.fieldTypes());
    for (String fragment : FIELD_FRAGMENTS) {
      fragmentShapes.put(fragment, generator.resolvedFragment(fragment));
    }
    this.entitySchemas = new EntitySchemas(spec.schemaRoot());
  }

  public static void main(String[] args) {
    if (args.length < 2) {
      throw new IllegalArgumentException("usage: SpecExtractor <specDir> <committedRootDir>");
    }
    new SpecExtractor(Path.of(args[0])).extractAll(Path.of(args[1]));
  }

  public void extractAll(Path committedRoot) {
    Map<String, Map<String, ObjectNode>> mappings = loadAllMappings(committedRoot);
    Map<String, JsonNode> cores = extractCores(mappings);
    Map<String, LanguageProfile> profiles = writeLanguageFiles(mappings, cores);
    Map<String, ObjectNode> entityFields = new TreeMap<>();
    for (Map.Entry<String, Map<String, ObjectNode>> entry : mappings.entrySet()) {
      entityFields.put(entry.getKey(), buildEntityFields(entry.getValue(), profiles));
    }
    ObjectNode baseFields = computeBaseFields(entityFields);
    ObjectNode entityBase = Json.MAPPER.createObjectNode();
    entityBase.set("fields", baseFields);
    Json.writeJson(specDir.resolve("entity_base.json"), entityBase);
    for (Map.Entry<String, Map<String, ObjectNode>> entry : mappings.entrySet()) {
      writeEntity(
          entry.getKey(),
          entityFields.get(entry.getKey()),
          baseFields,
          entitySettings(entry.getValue(), cores));
    }
    System.out.println(
        "extracted "
            + mappings.size()
            + " entity specs + entity_base ("
            + baseFields.size()
            + " shared fields)");
  }

  /**
   * For each field used by a majority of entities, the shared <em>core</em> — the keys whose
   * value is identical across the dominant group (same {@code type}/{@code fragment}). Per-entity
   * variation (e.g. {@code languages} drift) is left to the entity's own delta.
   */
  private ObjectNode computeBaseFields(Map<String, ObjectNode> entityFields) {
    Map<String, List<JsonNode>> byField = new LinkedHashMap<>();
    for (ObjectNode fields : entityFields.values()) {
      fields
          .properties()
          .forEach(
              e -> byField.computeIfAbsent(e.getKey(), k -> new ArrayList<>()).add(e.getValue()));
    }
    int threshold = entityFields.size() / 2;
    ObjectNode base = Json.MAPPER.createObjectNode();
    byField.forEach((name, defs) -> addBaseField(base, name, defs, threshold));
    return base;
  }

  private void addBaseField(ObjectNode base, String name, List<JsonNode> defs, int threshold) {
    List<JsonNode> dominant = dominantGroup(defs);
    if (dominant.size() > threshold) {
      ObjectNode core = intersect(dominant);
      if (!core.isEmpty()) {
        base.set(name, core);
      }
    }
  }

  private List<JsonNode> dominantGroup(List<JsonNode> defs) {
    Map<String, List<JsonNode>> groups = new LinkedHashMap<>();
    for (JsonNode def : defs) {
      groups.computeIfAbsent(shapeOf(def), k -> new ArrayList<>()).add(def);
    }
    return groups.values().stream().max(Comparator.comparingInt(List::size)).orElseThrow();
  }

  private String shapeOf(JsonNode def) {
    if (def.has("type")) {
      return "type:" + def.get("type").asText();
    }
    if (def.has("fragment")) {
      return "fragment:" + def.get("fragment").asText();
    }
    return "inline";
  }

  private ObjectNode intersect(List<JsonNode> defs) {
    ObjectNode result = Json.MAPPER.createObjectNode();
    defs.get(0).fieldNames().forEachRemaining(key -> intersectKey(result, key, defs));
    return result;
  }

  private void intersectKey(ObjectNode result, String key, List<JsonNode> defs) {
    // languages/overrides are opaque payloads (they carry JSON nulls for later merge stages);
    // they must stay whole on the entity, never split into entity_base.
    if (key.equals("languages") || key.equals("overrides")) {
      return;
    }
    if (!defs.stream().allMatch(def -> def.has(key))) {
      return;
    }
    List<JsonNode> values = defs.stream().map(def -> def.get(key)).toList();
    JsonNode first = values.get(0);
    if (values.stream().allMatch(value -> value.equals(first))) {
      result.set(key, first);
    } else if (values.stream().allMatch(JsonNode::isObject)) {
      ObjectNode sub = intersect(values);
      if (!sub.isEmpty()) {
        result.set(key, sub);
      }
    }
  }

  private Map<String, JsonNode> extractCores(Map<String, Map<String, ObjectNode>> mappings) {
    Map<String, JsonNode> cores = new LinkedHashMap<>();
    for (String language : LANGUAGES) {
      cores.put(language, mostCommonSettings(language, mappings));
    }
    Json.writeJson(specDir.resolve("settings").resolve("base.json"), cores.get("en"));
    return cores;
  }

  private Map<String, LanguageProfile> writeLanguageFiles(
      Map<String, Map<String, ObjectNode>> mappings, Map<String, JsonNode> cores) {
    Map<String, LanguageProfile> profiles = new LinkedHashMap<>();
    for (String language : LANGUAGES) {
      ObjectNode languageNode = Json.MAPPER.createObjectNode();
      languageNode.set("analyzers", deriveRenames(language, mappings));
      languageNode.set("settings", computeOverride(cores.get("en"), cores.get(language)));
      Json.writeJson(specDir.resolve("languages").resolve(language + ".json"), languageNode);
      profiles.put(language, new LanguageProfile(languageNode));
    }
    return profiles;
  }

  private Map<String, Map<String, ObjectNode>> loadAllMappings(Path committedRoot) {
    Map<String, Map<String, ObjectNode>> mappings = new TreeMap<>();
    for (String language : LANGUAGES) {
      loadLanguageMappings(committedRoot.resolve(language), language, mappings);
    }
    return mappings;
  }

  private void loadLanguageMappings(
      Path languageDir, String language, Map<String, Map<String, ObjectNode>> mappings) {
    try (Stream<Path> files = Files.list(languageDir)) {
      files
          .filter(path -> path.getFileName().toString().endsWith(MAPPING_SUFFIX))
          .forEach(
              path -> {
                String entity = entityName(path);
                mappings
                    .computeIfAbsent(entity, key -> new LinkedHashMap<>())
                    .put(language, (ObjectNode) Json.loadFile(path));
              });
    } catch (IOException e) {
      throw new UncheckedIOException("Failed to list " + languageDir, e);
    }
  }

  // ---- language profiles (systematic analyzer/normalizer renames) ----

  private ObjectNode deriveRenames(String language, Map<String, Map<String, ObjectNode>> mappings) {
    Map<String, Map<String, Integer>> tally = new LinkedHashMap<>();
    if (!language.equals("en")) {
      for (Map<String, ObjectNode> perLanguage : mappings.values()) {
        tallyRenames(perLanguage.get("en"), perLanguage.get(language), "", tally);
      }
    }
    ObjectNode renames = Json.MAPPER.createObjectNode();
    tally.forEach((from, to) -> renames.put(from, mostFrequent(to)));
    return renames;
  }

  private void tallyRenames(
      JsonNode en, JsonNode other, String key, Map<String, Map<String, Integer>> tally) {
    if (en == null || other == null) {
      return;
    }
    if (ANALYZER_KEYS.contains(key) && en.isTextual() && other.isTextual() && !en.equals(other)) {
      tally
          .computeIfAbsent(en.asText(), k -> new LinkedHashMap<>())
          .merge(other.asText(), 1, Integer::sum);
    }
    if (en.isObject() && other.isObject()) {
      en.fieldNames()
          .forEachRemaining(name -> tallyRenames(en.get(name), other.get(name), name, tally));
    }
  }

  private String mostFrequent(Map<String, Integer> counts) {
    return counts.entrySet().stream().max(Map.Entry.comparingByValue()).orElseThrow().getKey();
  }

  // ---- settings: one base + per-language deltas + per-entity inline delta ----

  private JsonNode mostCommonSettings(
      String language, Map<String, Map<String, ObjectNode>> mappings) {
    List<JsonNode> distinct = new ArrayList<>();
    List<Integer> counts = new ArrayList<>();
    for (Map<String, ObjectNode> perLanguage : mappings.values()) {
      JsonNode settings = perLanguage.get(language).get("settings");
      int index = distinct.indexOf(settings);
      if (index < 0) {
        distinct.add(settings);
        counts.add(1);
      } else {
        counts.set(index, counts.get(index) + 1);
      }
    }
    return distinct.get(indexOfMax(counts));
  }

  /**
   * The entity's own settings delta, written inline in its spec file. {@code override} when the
   * delta is the same in every language, {@code byLanguage} when it genuinely differs.
   */
  private JsonNode entitySettings(
      Map<String, ObjectNode> perLanguage, Map<String, JsonNode> cores) {
    Map<String, JsonNode> deltas = new LinkedHashMap<>();
    for (String language : LANGUAGES) {
      JsonNode settings = perLanguage.get(language).get("settings");
      deltas.put(language, computeOverride(cores.get(language), settings));
    }
    ObjectNode result = Json.MAPPER.createObjectNode();
    if (deltas.values().stream().distinct().count() == 1) {
      result.set("override", deltas.get("en"));
    } else {
      ObjectNode byLanguage = Json.MAPPER.createObjectNode();
      deltas.forEach(byLanguage::set);
      result.set("byLanguage", byLanguage);
    }
    return result;
  }

  private int indexOfMax(List<Integer> counts) {
    int best = 0;
    for (int i = 1; i < counts.size(); i++) {
      if (counts.get(i) > counts.get(best)) {
        best = i;
      }
    }
    return best;
  }

  // ---- merged per-entity spec ----

  private ObjectNode buildEntityFields(
      Map<String, ObjectNode> perLanguage, Map<String, LanguageProfile> profiles) {
    ObjectNode fields = Json.MAPPER.createObjectNode();
    for (String field : fieldNames(perLanguage)) {
      fields.set(field, extractField(field, perLanguage, profiles));
    }
    return fields;
  }

  /**
   * Writes one entity spec as a delta over {@code entity_base}: only fields that are new,
   * overridden, or removed (JSON null) relative to the base appear in the file.
   */
  private void writeEntity(
      String entity, ObjectNode fields, ObjectNode baseFields, JsonNode settingsRef) {
    ObjectNode spec = Json.MAPPER.createObjectNode();
    spec.put("entity", entity);
    spec.put("extends", "entity_base");
    resolveJavaEntity(entity).ifPresent(javaType -> spec.put("javaEntity", javaType));
    spec.set("settings", settingsRef);
    ObjectNode delta = Json.MAPPER.createObjectNode();
    fields.properties().forEach(e -> addFieldDelta(delta, baseFields, e.getKey(), e.getValue()));
    baseFields.fieldNames().forEachRemaining(name -> removeMissingField(delta, fields, name));
    spec.set("fields", delta);
    Json.writeJson(specDir.resolve("entities").resolve(entity + ".json"), spec);
  }

  private void addFieldDelta(ObjectNode delta, ObjectNode baseFields, String name, JsonNode def) {
    JsonNode base = baseFields.get(name);
    if (base == null) {
      delta.set(name, def);
      return;
    }
    ObjectNode fieldDelta = (ObjectNode) computeOverride(base, def);
    if (!fieldDelta.isEmpty()) {
      delta.set(name, fieldDelta);
    }
  }

  private void removeMissingField(ObjectNode delta, ObjectNode fields, String name) {
    if (!fields.has(name)) {
      delta.putNull(name);
    }
  }

  private Set<String> fieldNames(Map<String, ObjectNode> perLanguage) {
    Set<String> names = new LinkedHashSet<>();
    for (String language : LANGUAGES) {
      JsonNode properties = properties(perLanguage.get(language));
      if (properties != null) {
        properties.fieldNames().forEachRemaining(names::add);
      }
    }
    return names;
  }

  private ObjectNode extractField(
      String field, Map<String, ObjectNode> perLanguage, Map<String, LanguageProfile> profiles) {
    String baseLanguage = baseLanguageFor(field, perLanguage);
    JsonNode reference = properties(perLanguage.get(baseLanguage)).get(field);
    ObjectNode fieldDef = classify(field, reference);
    ObjectNode languages = Json.MAPPER.createObjectNode();
    for (String language : LANGUAGES) {
      addLanguageDelta(languages, language, field, reference, perLanguage, profiles);
    }
    if (!languages.isEmpty()) {
      fieldDef.set("languages", languages);
    }
    return fieldDef;
  }

  private void addLanguageDelta(
      ObjectNode languages,
      String language,
      String field,
      JsonNode reference,
      Map<String, ObjectNode> perLanguage,
      Map<String, LanguageProfile> profiles) {
    JsonNode properties = properties(perLanguage.get(language));
    if (properties == null || !properties.has(field)) {
      languages.putNull(language);
      return;
    }
    ObjectNode expected = profiles.get(language).apply((ObjectNode) reference);
    ObjectNode delta = (ObjectNode) computeOverride(expected, properties.get(field));
    if (!delta.isEmpty()) {
      languages.set(language, delta);
    }
  }

  private String baseLanguageFor(String field, Map<String, ObjectNode> perLanguage) {
    for (String language : LANGUAGES) {
      JsonNode properties = properties(perLanguage.get(language));
      if (properties != null && properties.has(field)) {
        return language;
      }
    }
    throw new IllegalStateException("Field not present in any language: " + field);
  }

  private JsonNode properties(ObjectNode mapping) {
    return mapping == null ? null : mapping.get("mappings").get("properties");
  }

  /** Resolves the entity POJO an index should extend, baked into the spec as {@code javaEntity}. */
  private java.util.Optional<String> resolveJavaEntity(String entity) {
    String stem = camelCase(entity);
    return entitySchemas
        .byFileStem(SCHEMA_ALIASES.getOrDefault(stem, stem))
        .map(EntitySchemas.Info::javaType);
  }

  private String camelCase(String entity) {
    String[] parts = entity.split("_");
    StringBuilder sb = new StringBuilder(parts[0]);
    for (int i = 1; i < parts.length; i++) {
      if (!parts[i].isEmpty()) {
        sb.append(Character.toUpperCase(parts[i].charAt(0))).append(parts[i].substring(1));
      }
    }
    return sb.toString();
  }

  private String entityName(Path mappingFile) {
    String fileName = mappingFile.getFileName().toString();
    return fileName.substring(0, fileName.length() - MAPPING_SUFFIX.length());
  }

  // ---- field classification ----

  private ObjectNode classify(String fieldName, JsonNode field) {
    ObjectNode result = classifyShape(field);
    if (LIST_FIELDS.contains(fieldName)) {
      result.put("list", true);
    }
    return result;
  }

  private ObjectNode classifyShape(JsonNode field) {
    String fieldType = matchFieldType(field);
    if (fieldType != null) {
      return singleton("type", fieldType);
    }
    String exactFragment = matchExactFragment(field);
    if (exactFragment != null) {
      return singleton("fragment", exactFragment);
    }
    FragmentMatch fragmentMatch = matchFragmentWithOverride(field);
    if (fragmentMatch != null) {
      ObjectNode result = singleton("fragment", fragmentMatch.name());
      result.set("overrides", fragmentMatch.override());
      return result;
    }
    ObjectNode inline = Json.MAPPER.createObjectNode();
    inline.set("inline", field);
    return inline;
  }

  private String matchFieldType(JsonNode field) {
    for (Map.Entry<String, JsonNode> entry : fieldTypeRecipes.entrySet()) {
      if (entry.getValue().equals(field)) {
        return entry.getKey();
      }
    }
    return null;
  }

  private String matchExactFragment(JsonNode field) {
    for (Map.Entry<String, JsonNode> entry : fragmentShapes.entrySet()) {
      if (entry.getValue().equals(field)) {
        return entry.getKey();
      }
    }
    return null;
  }

  private FragmentMatch matchFragmentWithOverride(JsonNode field) {
    if (!field.isObject()) {
      return null;
    }
    FragmentMatch best = null;
    int bestCost = leafCount(field);
    for (Map.Entry<String, JsonNode> entry : fragmentShapes.entrySet()) {
      FragmentMatch candidate = tryFragment(entry.getKey(), entry.getValue(), field);
      if (candidate != null && leafCount(candidate.override()) < bestCost) {
        bestCost = leafCount(candidate.override());
        best = candidate;
      }
    }
    return best;
  }

  private FragmentMatch tryFragment(String name, JsonNode base, JsonNode field) {
    if (!base.isObject()) {
      return null;
    }
    JsonNode override = computeOverride(base, field);
    if (!override.isObject()) {
      return null;
    }
    ObjectNode merged = base.deepCopy();
    Json.deepMerge(merged, (ObjectNode) override);
    return merged.equals(field) ? new FragmentMatch(name, (ObjectNode) override) : null;
  }

  private JsonNode computeOverride(JsonNode base, JsonNode actual) {
    if (!base.isObject() || !actual.isObject()) {
      return actual;
    }
    ObjectNode override = Json.MAPPER.createObjectNode();
    actual.properties().forEach(e -> addOverrideEntry(override, base, e.getKey(), e.getValue()));
    base.fieldNames()
        .forEachRemaining(
            key -> {
              if (!actual.has(key)) {
                override.putNull(key);
              }
            });
    return override;
  }

  private void addOverrideEntry(ObjectNode override, JsonNode base, String key, JsonNode actual) {
    if (!base.has(key)) {
      override.set(key, actual);
    } else if (!base.get(key).equals(actual)) {
      override.set(key, computeOverride(base.get(key), actual));
    }
  }

  private int leafCount(JsonNode node) {
    if (!node.isContainerNode()) {
      return 1;
    }
    int sum = 0;
    for (JsonNode child : node) {
      sum += leafCount(child);
    }
    return sum;
  }

  private void loadFieldTypes(JsonNode fieldTypes) {
    fieldTypes
        .properties()
        .forEach(
            e -> {
              if (e.getValue().isObject()) {
                JsonNode recipe = e.getValue().deepCopy();
                Json.stripMeta(recipe);
                fieldTypeRecipes.put(e.getKey(), recipe);
              }
            });
  }

  private ObjectNode singleton(String key, String value) {
    ObjectNode node = Json.MAPPER.createObjectNode();
    node.put(key, value);
    return node;
  }

  private record FragmentMatch(String name, ObjectNode override) {}
}
