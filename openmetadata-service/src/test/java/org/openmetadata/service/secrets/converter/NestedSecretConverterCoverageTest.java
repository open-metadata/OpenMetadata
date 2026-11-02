package org.openmetadata.service.secrets.converter;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.lang.reflect.Method;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Deque;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.secrets.JsonSchemas;
import org.openmetadata.service.secrets.JsonSchemas.Ref;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.util.ReflectionUtil;

/**
 * Secrets that live behind a JSON-Schema {@code oneOf} are generated as a bare {@code Object} field
 * (jsonschema2pojo ignores {@code oneOf}), so at runtime they hold a {@code LinkedHashMap}. Both
 * {@code PasswordEntityMasker} and {@code SecretsManager} only recurse into values whose package is
 * {@code org.openmetadata.*}, so such a map is skipped entirely: its {@code format: password}
 * leaves are never Fernet-encrypted, never handed to the secrets manager, and never masked on read.
 *
 * <p>The {@link ClassConverter} registered for the connection is what turns that map back into a
 * typed object. This test walks every connection schema and every ingestion pipeline config on the
 * classpath, builds a payload for every secret-bearing {@code oneOf} branch below them, typed
 * children included, and fails when a secret is still inside a map after conversion, so a new
 * connector or config cannot reintroduce the leak.
 */
class NestedSecretConverterCoverageTest {

  private static final String SECRET = "openmetadata-nested-secret";
  private static final String CONNECTIONS_PATH = "json/schema/entity/services/connections";
  private static final String WORKFLOW_PATH = "json/schema/metadataIngestion/workflow.json";
  private static final String SOURCE_CONFIG = "#/definitions/sourceConfig/properties/config";
  private static final int MAX_DEPTH = 12;

  /** The pipeline type each secret-bearing ingestion pipeline config is created with. */
  private static final Map<String, PipelineType> PIPELINE_TYPES =
      Map.of(
          "dbtPipeline", PipelineType.DBT,
          "storageServiceMetadataPipeline", PipelineType.METADATA,
          "testSuitePipeline", PipelineType.TEST_SUITE);

  /**
   * Secret-bearing configs that are not typed. An application pipeline's config is copied from its
   * app, whose own config and private config are encrypted by the application framework, and its
   * {@code oneOf} branches have no discriminator to pick a class by. Shrink this set; never grow
   * it.
   */
  private static final Set<String> KNOWN_UNCONVERTIBLE = Set.of("applicationPipeline");

  @Test
  void everySecretBearingConnectionPropertyHasAConverter() {
    JsonSchemas schemas = loadSchemas();
    List<String> uncovered = new ArrayList<>();

    for (Map.Entry<String, JsonNode> entry : schemas.all().entrySet()) {
      String path = entry.getKey();
      Class<?> connectionClass = generatedClass(entry.getValue());
      if (!path.startsWith(CONNECTIONS_PATH)
          || path.endsWith("serviceConnection.json")
          || connectionClass == null) {
        continue;
      }
      JsonNode properties = entry.getValue().path("properties");
      for (String property : iterable(properties.fieldNames())) {
        Ref node = new Ref(properties.get(property), path);
        if (containsPasswordFormat(node.node(), path, schemas)) {
          leakingPayload(connectionClass, property, node, schemas)
              .ifPresent(
                  payload ->
                      uncovered.add(
                          simpleJavaName(entry.getValue(), path) + "." + property + " " + payload));
        }
      }
    }

    assertTrue(
        uncovered.isEmpty(),
        "These connection properties hold secrets behind a oneOf but no ClassConverter converts "
            + "them, so the secrets are stored unencrypted and returned unmasked: "
            + uncovered);
  }

  @Test
  void everySecretBearingPipelineConfigIsMasked() {
    JsonSchemas schemas = loadSchemas();
    List<String> uncovered = new ArrayList<>();
    List<String> staleAllowlist = new ArrayList<>(KNOWN_UNCONVERTIBLE);

    Ref configs = schemas.resolve(SOURCE_CONFIG, WORKFLOW_PATH);
    for (JsonNode branch : configs.node().get("oneOf")) {
      Ref config = schemas.resolve(branch.path("$ref").asText(), WORKFLOW_PATH);
      if (!containsPasswordFormat(config.node(), config.path(), schemas)) {
        continue;
      }
      String name = simpleJavaName(config.node(), config.path());
      if (!staleAllowlist.remove(name)) {
        leakingPipelinePayload(name, config, schemas)
            .ifPresent(payload -> uncovered.add(name + " " + payload));
      }
    }

    assertTrue(
        uncovered.isEmpty(),
        "These ingestion pipeline configs hold secrets that the masker leaves in the clear; type "
            + "them in IngestionPipelineBuilder and map their pipeline type here: "
            + uncovered);
    assertTrue(
        staleAllowlist.isEmpty(),
        "KNOWN_UNCONVERTIBLE lists configs that are no longer secret-bearing; remove them: "
            + staleAllowlist);
  }

  private static JsonSchemas loadSchemas() {
    JsonSchemas schemas = JsonSchemas.load();
    assertTrue(
        schemas.all().size() > 100,
        "No JSON schemas found on the classpath, found " + schemas.all().size());
    return schemas;
  }

  /**
   * Runs the registered converter over every payload built for {@code property} and returns the
   * first one that still has a secret inside a {@link Map} afterwards. A map is exactly what the password
   * walkers skip, so a map holding a secret means that secret stays in the clear.
   */
  private Optional<String> leakingPayload(
      Class<?> connectionClass, String property, Ref node, JsonSchemas schemas) {
    for (Object value : secretPayloads(node.node(), node.path(), schemas, 0)) {
      Map<String, Object> payload = new LinkedHashMap<>();
      payload.put(property, value);
      if (leavesSecretInAMap(connectionClass, payload)) {
        return Optional.of(JsonUtils.pojoToJson(payload));
      }
    }
    return Optional.empty();
  }

  private boolean leavesSecretInAMap(Class<?> connectionClass, Map<String, Object> payload) {
    try {
      return holdsSecretInAMap(
          ClassConverterFactory.getConverter(connectionClass).convert(payload));
    } catch (RuntimeException e) {
      return true; // Cannot be converted at all, so it is certainly not typed.
    }
  }

  private Optional<String> leakingPipelinePayload(String name, Ref config, JsonSchemas schemas) {
    PipelineType pipelineType = PIPELINE_TYPES.get(name);
    if (pipelineType == null) {
      return Optional.of("(no pipeline type mapped)");
    }
    return secretPayloads(config.node(), config.path(), schemas, 0).stream()
        .filter(payload -> maskingLeavesSecret(name, pipelineType, payload))
        .map(JsonUtils::pojoToJson)
        .findFirst();
  }

  private boolean maskingLeavesSecret(String name, PipelineType pipelineType, Object payload) {
    IngestionPipeline pipeline =
        new IngestionPipeline()
            .withName(name)
            .withPipelineType(pipelineType)
            .withSourceConfig(new SourceConfig().withConfig(payload));
    try {
      EntityMaskerFactory.createEntityMasker().maskIngestionPipeline(pipeline);
    } catch (RuntimeException e) {
      return true;
    }
    return JsonUtils.pojoToJson(pipeline).contains(SECRET);
  }

  /** Whether {@code value}, or anything typed below it, holds a secret inside an untyped map. */
  private boolean holdsSecretInAMap(Object value) {
    if (value instanceof Map<?, ?> map) {
      return JsonUtils.pojoToJson(map).contains(SECRET);
    }
    if (value instanceof Collection<?> collection) {
      return collection.stream().anyMatch(this::holdsSecretInAMap);
    }
    if (value == null || !value.getClass().getPackageName().startsWith("org.openmetadata")) {
      return false;
    }
    for (Method getter : value.getClass().getMethods()) {
      if (ReflectionUtil.isGetMethodOfObject(getter)
          && holdsSecretInAMap(ReflectionUtil.getObjectFromMethod(getter, value))) {
        return true;
      }
    }
    return false;
  }

  /**
   * Payloads that between them reach every {@code format: password} leaf below {@code node},
   * through every secret-bearing {@code oneOf} branch. Each level's single-valued enums and
   * required strings are carried along, as a real config has them, so a converter's candidate list
   * can discriminate, and sibling properties are combined
   * index by index, so the number of payloads stays that of the widest {@code oneOf}.
   */
  private List<Object> secretPayloads(JsonNode node, String path, JsonSchemas schemas, int depth) {
    String ref = node.path("$ref").asText("");
    Ref resolved = ref.isEmpty() ? new Ref(node, path) : schemas.resolve(ref, path);
    if (resolved == null || depth > MAX_DEPTH) {
      return List.of();
    }
    JsonNode target = resolved.node();
    if ("password".equals(target.path("format").asText(""))) {
      return List.of(SECRET);
    }
    if (target.path("enum").size() == 1) {
      return List.of(target.get("enum").get(0).asText());
    }
    if (target.has("oneOf") || target.has("anyOf")) {
      return branchPayloads(target, resolved.path(), schemas, depth);
    }
    if (target.has("properties")) {
      return objectPayloads(target, resolved.path(), schemas, depth);
    }
    if (target.path("items").isObject()) {
      return secretPayloads(target.get("items"), resolved.path(), schemas, depth + 1).stream()
          .map(item -> (Object) List.of(item))
          .toList();
    }
    return List.of();
  }

  private List<Object> branchPayloads(JsonNode oneOf, String path, JsonSchemas schemas, int depth) {
    List<Object> payloads = new ArrayList<>();
    JsonNode branches = oneOf.has("oneOf") ? oneOf.get("oneOf") : oneOf.get("anyOf");
    for (JsonNode branch : branches) {
      if (containsPasswordFormat(branch, path, schemas)) {
        payloads.addAll(secretPayloads(branch, path, schemas, depth + 1));
      }
    }
    return payloads;
  }

  private List<Object> objectPayloads(
      JsonNode object, String path, JsonSchemas schemas, int depth) {
    Map<String, List<Object>> alternatives = new LinkedHashMap<>();
    JsonNode properties = object.get("properties");
    Set<String> required = new HashSet<>();
    object.path("required").forEach(name -> required.add(name.asText()));
    for (String name : iterable(properties.fieldNames())) {
      JsonNode property = properties.get(name);
      if (required.contains(name) && isPlainString(property, path, schemas)) {
        alternatives.put(name, List.of(name));
      } else if (isSingleValuedEnum(property, path, schemas)
          || containsPasswordFormat(property, path, schemas)) {
        List<Object> values = secretPayloads(property, path, schemas, depth + 1);
        if (!values.isEmpty()) {
          alternatives.put(name, values);
        }
      }
    }
    int count = alternatives.values().stream().mapToInt(List::size).max().orElse(0);
    List<Object> payloads = new ArrayList<>();
    for (int index = 0; index < count; index++) {
      Map<String, Object> payload = new LinkedHashMap<>();
      for (Map.Entry<String, List<Object>> entry : alternatives.entrySet()) {
        payload.put(entry.getKey(), entry.getValue().get(index % entry.getValue().size()));
      }
      payloads.add(payload);
    }
    return payloads;
  }

  private boolean isPlainString(JsonNode property, String path, JsonSchemas schemas) {
    String ref = property.path("$ref").asText("");
    Ref resolved = ref.isEmpty() ? new Ref(property, path) : schemas.resolve(ref, path);
    return resolved != null
        && "string".equals(resolved.node().path("type").asText(""))
        && !resolved.node().has("enum")
        && !"password".equals(resolved.node().path("format").asText(""));
  }

  private boolean isSingleValuedEnum(JsonNode property, String path, JsonSchemas schemas) {
    String ref = property.path("$ref").asText("");
    Ref resolved = ref.isEmpty() ? new Ref(property, path) : schemas.resolve(ref, path);
    return resolved != null && resolved.node().path("enum").size() == 1;
  }

  private static Class<?> generatedClass(JsonNode schema) {
    try {
      return Class.forName(schema.path("javaType").asText(""));
    } catch (ClassNotFoundException e) {
      return null; // Not a generated class, so nothing walks it either.
    }
  }

  private String simpleJavaName(JsonNode schema, String path) {
    String javaType = schema.path("javaType").asText("");
    if (!javaType.isEmpty()) {
      return javaType.substring(javaType.lastIndexOf('.') + 1);
    }
    String file = path.substring(path.lastIndexOf('/') + 1);
    return file.substring(0, file.length() - ".json".length());
  }

  private boolean containsPasswordFormat(JsonNode node, String path, JsonSchemas schemas) {
    Deque<Ref> queue = new ArrayDeque<>();
    Set<String> visited = new HashSet<>();
    queue.add(new Ref(node, path));
    while (!queue.isEmpty()) {
      Ref current = queue.poll();
      JsonNode value = current.node();
      if (value == null || !value.isObject()) {
        continue;
      }
      if ("password".equals(value.path("format").asText(""))) {
        return true;
      }
      String ref = value.path("$ref").asText("");
      if (!ref.isEmpty()) {
        if (visited.add(current.path() + "|" + ref)) {
          Ref resolved = schemas.resolve(ref, current.path());
          if (resolved != null) {
            queue.add(resolved);
          }
        }
        continue;
      }
      for (String keyword : List.of("oneOf", "anyOf", "allOf")) {
        value.path(keyword).forEach(branch -> queue.add(new Ref(branch, current.path())));
      }
      value.path("properties").forEach(child -> queue.add(new Ref(child, current.path())));
      if (value.path("items").isObject()) {
        queue.add(new Ref(value.get("items"), current.path()));
      }
    }
    return false;
  }

  private static <T> Iterable<T> iterable(java.util.Iterator<T> iterator) {
    return () -> iterator;
  }
}
