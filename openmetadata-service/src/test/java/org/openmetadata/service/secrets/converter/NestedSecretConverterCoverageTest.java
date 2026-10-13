package org.openmetadata.service.secrets.converter;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import io.github.classgraph.ClassGraph;
import io.github.classgraph.Resource;
import io.github.classgraph.ScanResult;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Secrets that live behind a JSON-Schema {@code oneOf} are generated as a bare {@code Object} field
 * (jsonschema2pojo ignores {@code oneOf}), so at runtime they hold a {@code LinkedHashMap}. Both
 * {@code PasswordEntityMasker} and {@code SecretsManager} only recurse into values whose package is
 * {@code org.openmetadata.*}, so such a map is skipped entirely: its {@code format: password}
 * leaves are never Fernet-encrypted, never handed to the secrets manager, and never masked on read.
 *
 * <p>The {@link ClassConverter} registered for the connection is what turns that map back into a
 * typed object. This test walks every connection schema on the classpath and fails when a
 * secret-bearing {@code oneOf} property has no converter that converts it, so a new connector
 * cannot reintroduce the leak.
 */
class NestedSecretConverterCoverageTest {

  private static final String SECRET = "openmetadata-nested-secret";
  private static final String SCHEMA_ROOT = "json/schema/";
  private static final String CONNECTIONS_PATH = SCHEMA_ROOT + "entity/services/connections";

  /**
   * Secret-bearing {@code oneOf} branches that jsonschema2pojo never materialised into a class, so
   * no converter can be written until the branch is extracted into its own schema file. Shrink this
   * set; never grow it.
   */
  private static final Set<String> KNOWN_UNCONVERTIBLE =
      Set.of(
          "MetastoreConfig.connection",
          "NatsConnection.authType",
          "QlikSenseConnection.certificates",
          "SapS4HanaConnection.authType");

  @Test
  void everySecretBearingOneOfPropertyHasAConverter() {
    Map<String, JsonNode> schemas = loadSchemas();
    assertTrue(
        schemas.size() > 100, "No JSON schemas found on the classpath, found " + schemas.size());

    List<String> uncovered = new ArrayList<>();
    List<String> staleAllowlist = new ArrayList<>(KNOWN_UNCONVERTIBLE);

    for (Map.Entry<String, JsonNode> entry : schemas.entrySet()) {
      String path = entry.getKey();
      // serviceConnection.json is the union of every connection config; covered via its members.
      if (!path.startsWith(CONNECTIONS_PATH) || path.endsWith("serviceConnection.json")) {
        continue;
      }
      JsonNode schema = entry.getValue();
      String connection = simpleJavaName(schema, path);
      JsonNode properties = schema.path("properties");
      for (String property : iterable(properties.fieldNames())) {
        Ref oneOf = resolveToOneOfNode(properties.get(property), path, schemas);
        if (oneOf == null || !containsPasswordFormat(oneOf.node(), oneOf.path(), schemas)) {
          continue;
        }
        String id = connection + "." + property;
        if (staleAllowlist.remove(id)) {
          continue;
        }
        if (leavesSecretsInAMap(schema, property, oneOf, schemas)) {
          uncovered.add(id);
        }
      }
    }

    assertTrue(
        uncovered.isEmpty(),
        "These connection properties hold secrets behind a oneOf but no ClassConverter converts "
            + "them, so the secrets are stored unencrypted and returned unmasked: "
            + uncovered);
    assertTrue(
        staleAllowlist.isEmpty(),
        "KNOWN_UNCONVERTIBLE lists properties that are no longer secret-bearing oneOf properties; "
            + "remove them: "
            + staleAllowlist);
  }

  /**
   * Runs the registered converter over a payload built from the secret-bearing branch and reports
   * whether the property is still a {@link Map} afterwards. A map is exactly what the password
   * walkers skip, so a map here means the secrets below it stay in the clear.
   */
  private boolean leavesSecretsInAMap(
      JsonNode schema, String property, Ref oneOf, Map<String, JsonNode> schemas) {
    Class<?> connectionClass;
    try {
      connectionClass = Class.forName(schema.path("javaType").asText(""));
    } catch (ClassNotFoundException e) {
      return false; // Not a generated class, so nothing walks it either.
    }
    Ref branch = secretBearingBranch(oneOf.node(), oneOf.path(), schemas);
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put(property, secretPayload(branch.node(), branch.path(), schemas));
    try {
      Object converted = ClassConverterFactory.getConverter(connectionClass).convert(payload);
      String suffix = Character.toUpperCase(property.charAt(0)) + property.substring(1);
      return connectionClass.getMethod("get" + suffix).invoke(converted) instanceof Map;
    } catch (ReflectiveOperationException | RuntimeException e) {
      return true; // Cannot be converted at all, so it is certainly not typed.
    }
  }

  private Ref secretBearingBranch(JsonNode oneOf, String path, Map<String, JsonNode> schemas) {
    JsonNode branches = oneOf.has("oneOf") ? oneOf.get("oneOf") : oneOf.get("anyOf");
    for (JsonNode branch : branches) {
      Ref resolved = new Ref(branch, path);
      String ref = branch.path("$ref").asText("");
      if (!ref.isEmpty()) {
        resolved = resolveRef(ref, path, schemas);
      }
      if (resolved != null && containsPasswordFormat(resolved.node(), resolved.path(), schemas)) {
        return resolved;
      }
    }
    throw new IllegalStateException("No secret-bearing branch under " + path);
  }

  /**
   * The smallest payload that reaches every {@code format: password} leaf of {@code branch}, with
   * each level's single-valued enum carried along so a converter candidate list can discriminate.
   */
  private Object secretPayload(JsonNode branch, String path, Map<String, JsonNode> schemas) {
    Map<String, Object> payload = new LinkedHashMap<>();
    JsonNode properties = branch.path("properties");
    for (String name : iterable(properties.fieldNames())) {
      JsonNode property = properties.get(name);
      String ref = property.path("$ref").asText("");
      Ref resolved = ref.isEmpty() ? new Ref(property, path) : resolveRef(ref, path, schemas);
      if (resolved == null) {
        continue;
      }
      JsonNode node = resolved.node();
      if ("password".equals(node.path("format").asText(""))) {
        payload.put(name, SECRET);
      } else if (node.path("enum").size() == 1) {
        payload.put(name, node.get("enum").get(0).asText());
      } else if (containsPasswordFormat(node, resolved.path(), schemas)) {
        payload.put(
            name,
            node.has("properties")
                ? secretPayload(node, resolved.path(), schemas)
                : secretPayload(
                    secretBearingBranch(node, resolved.path(), schemas).node(),
                    resolved.path(),
                    schemas));
      }
    }
    return payload;
  }

  private String simpleJavaName(JsonNode schema, String path) {
    String javaType = schema.path("javaType").asText("");
    if (!javaType.isEmpty()) {
      return javaType.substring(javaType.lastIndexOf('.') + 1);
    }
    String file = path.substring(path.lastIndexOf('/') + 1);
    return file.substring(0, file.length() - ".json".length());
  }

  /**
   * Returns the {@code oneOf}/{@code anyOf} node a property resolves to, or {@code null} when the
   * property is not generated as a bare {@code Object} because it declares its own properties.
   */
  private Ref resolveToOneOfNode(JsonNode property, String path, Map<String, JsonNode> schemas) {
    JsonNode node = property;
    String base = path;
    for (int depth = 0; depth < 8 && node != null; depth++) {
      if (node.has("properties")) {
        return null;
      }
      if (node.has("oneOf") || node.has("anyOf")) {
        return new Ref(node, base);
      }
      String ref = node.path("$ref").asText("");
      if (ref.isEmpty()) {
        return null;
      }
      Ref resolved = resolveRef(ref, base, schemas);
      if (resolved == null) {
        return null;
      }
      node = resolved.node();
      base = resolved.path();
    }
    return null;
  }

  private boolean containsPasswordFormat(
      JsonNode node, String path, Map<String, JsonNode> schemas) {
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
          Ref resolved = resolveRef(ref, current.path(), schemas);
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

  private Ref resolveRef(String ref, String base, Map<String, JsonNode> schemas) {
    int hash = ref.indexOf('#');
    String filePart = hash >= 0 ? ref.substring(0, hash) : ref;
    String fragment = hash >= 0 ? ref.substring(hash + 1) : "";
    String targetPath = filePart.isEmpty() ? base : normalize(base, filePart);
    JsonNode node = schemas.get(targetPath);
    if (node == null) {
      return null;
    }
    for (String segment : fragment.split("/")) {
      if (!segment.isEmpty()) {
        node = node.path(segment);
      }
    }
    return node.isMissingNode() ? null : new Ref(node, targetPath);
  }

  /** Resolves a schema-relative {@code $ref} file path against the referring schema's path. */
  private String normalize(String base, String relative) {
    Deque<String> segments = new ArrayDeque<>();
    for (String segment : base.substring(0, base.lastIndexOf('/')).split("/")) {
      segments.addLast(segment);
    }
    for (String segment : relative.split("/")) {
      if (segment.equals("..")) {
        segments.pollLast();
      } else if (!segment.equals(".") && !segment.isEmpty()) {
        segments.addLast(segment);
      }
    }
    return String.join("/", segments);
  }

  /** Every schema under {@code json/schema/}, keyed by its classpath-relative path. */
  private Map<String, JsonNode> loadSchemas() {
    Map<String, JsonNode> schemas = new TreeMap<>();
    try (ScanResult scan = new ClassGraph().acceptPaths(SCHEMA_ROOT).scan()) {
      for (Resource resource : scan.getResourcesWithExtension("json")) {
        try {
          schemas.put(resource.getPath(), JsonUtils.readTree(resource.getContentAsString()));
        } catch (Exception ignored) {
          // Not every JSON under json/schema parses as a schema; those cannot declare secrets.
        }
      }
    }
    return schemas;
  }

  private static <T> Iterable<T> iterable(java.util.Iterator<T> iterator) {
    return () -> iterator;
  }

  private record Ref(JsonNode node, String path) {}
}
