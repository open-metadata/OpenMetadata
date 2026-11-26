package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URL;
import java.nio.file.FileSystem;
import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.IndexMappingLanguage;
import org.openmetadata.service.search.indexes.SearchIndex;

/**
 * A schema field declared as an object with no properties holds keys that belong to a source
 * system, not to us: a topic's broker settings, a search index's settings, an MCP tool's input
 * schema. Keys like that routinely contain dots, and a search engine expands a dot in a
 * dynamically mapped field into another level of object. One document makes {@code a.b} a value,
 * the next needs it to be an object, and the engine rejects the document with "can't merge a non
 * object mapping [...] with an object mapping". The mapping also grows a field per distinct key,
 * towards the index's field limit, which then fails every later document in that index.
 *
 * <p>So such a field must either be kept out of the document — by {@code DEFAULT_EXCLUDED_FIELDS}
 * or the index's own {@code getExcludedFields()} — or be declared in the index mapping, in every
 * language, with {@code "enabled": false} (or {@code "dynamic": false}), which keeps the value in
 * {@code _source} and returns it from search without mapping anything inside it.
 * ADR:2026-11-24-free-form-config-objects-stay-out-of-the-search-mapping
 */
class FreeFormObjectIndexMappingTest {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final SearchIndexFactory INDEX_FACTORY = new SearchIndexFactory();
  private static final String SCHEMA_ROOT = "/json/schema";
  private static final String ENTITY_SCHEMAS = "entity";
  private static final String INDEX_MAPPINGS = "/elasticsearch/indexMapping.json";
  private static final String MAPPING_FILE_FIELD = "indexMappingFile";
  private static final String PROPERTIES = "properties";
  private static final String TYPE = "type";
  private static final String OBJECT = "object";
  private static final String ENABLED = "enabled";
  private static final String DYNAMIC = "dynamic";
  private static final String ADDITIONAL_PROPERTIES = "additionalProperties";
  private static final String REF = "$ref";
  private static final int MAX_SCHEMA_DEPTH = 6;
  private static final List<String> LANGUAGES =
      Arrays.stream(IndexMappingLanguage.values())
          .map(language -> language.toString().toLowerCase(Locale.ROOT))
          .toList();

  @Test
  void everyFreeFormObjectIsKeptOutOfTheDocumentOrLeftUnmapped() throws Exception {
    List<String> unshielded = new ArrayList<>();
    int checkedEntities = 0;
    try (EntitySchemas schemas = EntitySchemas.open()) {
      for (Iterator<Map.Entry<String, JsonNode>> it = readJson(INDEX_MAPPINGS).fields();
          it.hasNext(); ) {
        Map.Entry<String, JsonNode> entry = it.next();
        Path schema = schemas.forEntity(entry.getKey());
        if (schema == null) {
          continue;
        }
        checkedEntities++;
        unshielded.addAll(unshieldedPaths(entry.getKey(), entry.getValue(), schema));
      }
    }
    assertTrue(checkedEntities > 40, "the sweep found only " + checkedEntities + " entity schemas");
    assertEquals(
        List.of(),
        unshielded,
        "declare each of these in the index mapping as {\"type\": \"object\", \"enabled\": false},"
            + " or add it to its index's getExcludedFields()");
  }

  private static List<String> unshieldedPaths(String entityType, JsonNode indexConfig, Path schema)
      throws IOException {
    List<List<String>> freeForm = new ArrayList<>();
    collectFreeFormPaths(readJson(schema), schema, List.of(), freeForm, 0);
    if (freeForm.isEmpty()) {
      return List.of();
    }
    Set<String> excluded = excludedFields(entityType);
    List<String> unshielded = new ArrayList<>();
    for (String language : LANGUAGES) {
      String mappingFile = String.format(indexConfig.path(MAPPING_FILE_FIELD).asText(), language);
      JsonNode mapping = readJsonIfPresent(mappingFile);
      if (mapping == null) {
        continue;
      }
      JsonNode properties = mapping.path("mappings").path(PROPERTIES);
      for (List<String> path : freeForm) {
        if (!isExcluded(excluded, path) && !isShielded(properties, path)) {
          unshielded.add(mappingFile + " " + String.join(".", path));
        }
      }
    }
    return unshielded;
  }

  /** The fields the index drops before the document is written, so no mapping can apply to them. */
  private static Set<String> excludedFields(String entityType) {
    Set<String> excluded = new HashSet<>(SearchIndex.DEFAULT_EXCLUDED_FIELDS);
    try {
      SearchIndex probe = INDEX_FACTORY.buildIndex(entityType, null);
      if (probe != null) {
        excluded.addAll(probe.getExcludedFields());
        excluded.addAll(probe.getRetiredFields());
      }
    } catch (RuntimeException e) {
      // An index that cannot be probed without its entity keeps only the default exclusions, so
      // the sweep asks for a mapping rather than assuming the field never reaches the document.
    }
    return excluded;
  }

  /** True when the path, or any ancestor of it, is dropped from the document. */
  private static boolean isExcluded(Set<String> excluded, List<String> path) {
    for (int depth = 1; depth <= path.size(); depth++) {
      if (excluded.contains(String.join(".", path.subList(0, depth)))) {
        return true;
      }
    }
    return false;
  }

  /** True when the path, or any ancestor of it, is declared with dynamic mapping turned off. */
  private static boolean isShielded(JsonNode properties, List<String> path) {
    JsonNode level = properties;
    for (String name : path) {
      JsonNode declared = level.path(name);
      if (declared.isMissingNode()) {
        return false;
      }
      if (!declared.path(ENABLED).asBoolean(true) || isDynamicOff(declared.path(DYNAMIC))) {
        return true;
      }
      level = declared.path(PROPERTIES);
    }
    return false;
  }

  private static boolean isDynamicOff(JsonNode dynamic) {
    return dynamic.isBoolean() ? !dynamic.asBoolean() : "strict".equals(dynamic.asText(""));
  }

  /** Every path under {@code schema} whose node is an object that accepts keys we never declared. */
  private static void collectFreeFormPaths(
      JsonNode node, Path schemaFile, List<String> path, List<List<String>> found, int depth)
      throws IOException {
    if (depth > MAX_SCHEMA_DEPTH || node == null || !node.isObject()) {
      return;
    }
    Resolved resolved = resolve(node, schemaFile);
    JsonNode target = resolved.node();
    if ("array".equals(target.path(TYPE).asText())) {
      collectFreeFormPaths(target.path("items"), resolved.file(), path, found, depth + 1);
      return;
    }
    if (!OBJECT.equals(target.path(TYPE).asText())) {
      return;
    }
    JsonNode properties = target.path(PROPERTIES);
    if (properties.isMissingNode() || properties.isEmpty()) {
      if (!path.isEmpty() && target.path(ADDITIONAL_PROPERTIES).asBoolean(true)) {
        found.add(path);
      }
      return;
    }
    for (Iterator<Map.Entry<String, JsonNode>> it = properties.fields(); it.hasNext(); ) {
      Map.Entry<String, JsonNode> property = it.next();
      List<String> child = new ArrayList<>(path);
      child.add(property.getKey());
      collectFreeFormPaths(property.getValue(), resolved.file(), child, found, depth + 1);
    }
  }

  /** A {@code $ref} followed to the node it names, and the schema file that node came from. */
  private record Resolved(JsonNode node, Path file) {}

  private static Resolved resolve(JsonNode node, Path schemaFile) throws IOException {
    Resolved current = new Resolved(node, schemaFile);
    for (int hop = 0; hop < MAX_SCHEMA_DEPTH; hop++) {
      JsonNode ref = current.node().path(REF);
      if (!ref.isTextual()) {
        return current;
      }
      String reference = ref.asText();
      int fragment = reference.indexOf('#');
      String file = fragment < 0 ? reference : reference.substring(0, fragment);
      String pointer = fragment < 0 ? "" : reference.substring(fragment + 1);
      Path target =
          file.isEmpty() ? current.file() : current.file().getParent().resolve(file).normalize();
      if (!Files.exists(target)) {
        return new Resolved(MAPPER.createObjectNode(), current.file());
      }
      current = new Resolved(readJson(target).at(pointer), target);
    }
    return current;
  }

  /** The entity schemas on the classpath, indexed by the entity type their filename spells. */
  private record EntitySchemas(FileSystem jar, Map<String, Path> byEntityType)
      implements AutoCloseable {

    static EntitySchemas open() throws Exception {
      URI uri = schemaRootUri();
      FileSystem jar =
          "jar".equals(uri.getScheme()) ? FileSystems.newFileSystem(uri, Map.of()) : null;
      Path root = jar == null ? Paths.get(uri) : jar.getPath(SCHEMA_ROOT);
      Map<String, Path> byEntityType = new HashMap<>();
      try (Stream<Path> files = Files.walk(root.resolve(ENTITY_SCHEMAS))) {
        files
            .filter(path -> path.toString().endsWith(".json"))
            .forEach(path -> byEntityType.putIfAbsent(stem(path), path));
      }
      return new EntitySchemas(jar, byEntityType);
    }

    private static URI schemaRootUri() throws Exception {
      URL root = FreeFormObjectIndexMappingTest.class.getResource(SCHEMA_ROOT);
      assertNotNull(root, "the entity schemas are not on the test classpath");
      return root.toURI();
    }

    private static String stem(Path path) {
      String name = path.getFileName().toString();
      return name.substring(0, name.length() - ".json".length());
    }

    Path forEntity(String entityType) {
      return byEntityType.get(entityType);
    }

    @Override
    public void close() throws IOException {
      if (jar != null) {
        jar.close();
      }
    }
  }

  private static JsonNode readJson(Path path) throws IOException {
    try (InputStream in = Files.newInputStream(path)) {
      return MAPPER.readTree(in);
    }
  }

  private static JsonNode readJson(String resource) throws IOException {
    JsonNode json = readJsonIfPresent(resource);
    assertNotNull(json, "missing classpath resource " + resource);
    return json;
  }

  private static JsonNode readJsonIfPresent(String resource) throws IOException {
    try (InputStream in = FreeFormObjectIndexMappingTest.class.getResourceAsStream(resource)) {
      return in == null ? null : MAPPER.readTree(in);
    }
  }
}
