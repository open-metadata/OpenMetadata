package org.openmetadata.service.secrets.converter;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import io.github.classgraph.ClassGraph;
import io.github.classgraph.Resource;
import io.github.classgraph.ScanResult;
import java.io.IOException;
import java.lang.reflect.Method;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.ReflectionUtil;

/**
 * Secrets that live behind a JSON-Schema {@code oneOf} are generated as a bare {@code Object} field
 * (jsonschema2pojo ignores {@code oneOf}), so at runtime they hold a {@code LinkedHashMap}. Both
 * {@code PasswordEntityMasker} and {@code SecretsManager} only recurse into values whose package is
 * {@code org.openmetadata.*}, so such a map is skipped entirely: its {@code format: password}
 * leaves are never Fernet-encrypted, never handed to the secrets manager, and never masked on read.
 *
 * <p>The {@link ClassConverter} registered for the connection is what turns that map back into a
 * typed object. This test walks every connection schema on the classpath, converts a payload for
 * each secret-bearing branch of every {@code oneOf} property, and fails when any secret is still
 * held somewhere the walkers do not descend into, so a new connector cannot reintroduce the leak.
 */
class NestedSecretConverterCoverageTest {

  private static final String SECRET = "openmetadata-nested-secret";
  private static final String SCHEMA_ROOT = "json/schema/";
  private static final String CONNECTIONS_PATH = SCHEMA_ROOT + "entity/services/connections";

  /**
   * Secret-bearing {@code oneOf} branches that jsonschema2pojo never materialised into a class, so
   * no converter can be written until the branch is extracted into its own schema file. Shrink this
   * set; never grow it. An entry also stops the payload descending into that property where it is
   * nested in another connection, so the other branches there stay checked.
   *
   * <p>{@code SampleDataStorageConfig.config} is a 2.0-only gap: the typed {@code
   * sampleDataStorageConfig} on every database connection has no converter, so its S3 credentials
   * are never typed. The property no longer exists on main.
   */
  private static final Set<String> KNOWN_UNCONVERTIBLE = Set.of();

  private final Set<String> allowlistHits = new HashSet<>();

  @Test
  void everySecretBearingOneOfPropertyHasAConverter() {
    Map<String, JsonNode> schemas = loadSchemas();
    assertTrue(
        schemas.size() > 100, "No JSON schemas found on the classpath, found " + schemas.size());

    List<String> uncovered = new ArrayList<>();
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
        String id = connection + "." + property;
        Ref oneOf = resolveToOneOfNode(properties.get(property), path, schemas);
        Ref typed =
            oneOf == null
                ? resolveToNestedOneOfHolder(properties.get(property), path, schemas)
                : null;
        boolean secretOneOf =
            oneOf != null && containsPasswordFormat(oneOf.node(), oneOf.path(), schemas);
        boolean allowlisted = KNOWN_UNCONVERTIBLE.contains(id);
        if (allowlisted && (secretOneOf || typed != null)) {
          allowlistHits.add(id);
        } else if (secretOneOf) {
          addIf(uncovered, id, leavesSecretsInAMap(schema, property, oneOf, schemas));
        } else if (typed != null) {
          addIf(uncovered, id, leavesSecretsInATypedProperty(schema, property, typed, schemas));
        }
      }
    }

    assertTrue(
        uncovered.isEmpty(),
        "These connection properties hold secrets behind a oneOf that their ClassConverter leaves "
            + "untyped, so the secrets are stored unencrypted and returned unmasked: "
            + uncovered);
    List<String> staleAllowlist = new ArrayList<>(KNOWN_UNCONVERTIBLE);
    staleAllowlist.removeAll(allowlistHits);
    assertTrue(
        staleAllowlist.isEmpty(),
        "KNOWN_UNCONVERTIBLE lists properties that are no longer secret-bearing oneOf properties; "
            + "remove them: "
            + staleAllowlist);
  }

  /**
   * Runs the registered converter over a payload built from each secret-bearing branch and reports
   * whether any secret is still held somewhere the password walkers skip, at any depth below the
   * property.
   */
  private boolean leavesSecretsInAMap(
      JsonNode schema, String property, Ref oneOf, Map<String, JsonNode> schemas) {
    Class<?> connectionClass;
    try {
      connectionClass = Class.forName(schema.path("javaType").asText(""));
    } catch (ClassNotFoundException e) {
      return false; // Not a generated class, so nothing walks it either.
    }
    boolean leaks = false;
    for (Ref branch : secretBearingBranches(oneOf.node(), oneOf.path(), schemas)) {
      Map<String, Object> payload = new LinkedHashMap<>();
      payload.put(property, secretPayload(branch.node(), branch.path(), schemas));
      leaks |= convertsWithASecretLeftUntyped(connectionClass, payload);
    }
    return leaks;
  }

  private static void addIf(List<String> list, String id, boolean condition) {
    if (condition) {
      list.add(id);
    }
  }

  /**
   * A typed property ({@code $ref} to another config, e.g. SSIS {@code databaseConnection}) is only
   * typed itself: a secret-bearing {@code oneOf} inside it is typed only if the connection's
   * converter runs it through its own converter.
   */
  private boolean leavesSecretsInATypedProperty(
      JsonNode schema, String property, Ref typed, Map<String, JsonNode> schemas) {
    Class<?> connectionClass;
    try {
      connectionClass = Class.forName(schema.path("javaType").asText(""));
    } catch (ClassNotFoundException e) {
      return false;
    }
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put(property, secretPayload(typed.node(), typed.path(), schemas));
    return convertsWithASecretLeftUntyped(connectionClass, payload);
  }

  /**
   * Returns the object schema a {@code $ref} property resolves to when that object holds a
   * secret-bearing {@code oneOf} among its own properties, or {@code null}.
   */
  private Ref resolveToNestedOneOfHolder(
      JsonNode property, String path, Map<String, JsonNode> schemas) {
    String ref = property.path("$ref").asText("");
    Ref resolved = ref.isEmpty() ? null : resolveRef(ref, path, schemas);
    boolean holdsSecretOneOf = false;
    if (resolved != null && resolved.node().has("properties")) {
      for (JsonNode child : resolved.node().get("properties")) {
        Ref oneOf = resolveToOneOfNode(child, resolved.path(), schemas);
        holdsSecretOneOf |=
            oneOf != null && containsPasswordFormat(oneOf.node(), oneOf.path(), schemas);
      }
    }
    return holdsSecretOneOf ? resolved : null;
  }

  private boolean convertsWithASecretLeftUntyped(
      Class<?> connectionClass, Map<String, Object> payload) {
    try {
      return holdsUntypedSecret(
          ClassConverterFactory.getConverter(connectionClass).convert(payload));
    } catch (ReflectiveOperationException | RuntimeException e) {
      return true; // Cannot be converted at all, so it is certainly not typed.
    }
  }

  /**
   * Walks the converted object the way the password walkers do -- through getters, into {@code
   * org.openmetadata} values only -- and reports a secret found in any other value, which is where
   * the walkers stop and leave it in the clear.
   */
  private boolean holdsUntypedSecret(Object value) throws ReflectiveOperationException {
    if (value == null || value instanceof String || value.getClass().isEnum()) {
      return false;
    }
    if (!value.getClass().getPackageName().startsWith("org.openmetadata")) {
      return JsonUtils.pojoToJson(value).contains(SECRET);
    }
    for (Method getter : value.getClass().getMethods()) {
      if (getter.getParameterCount() == 0
          && getter.getDeclaringClass() != Object.class
          && ReflectionUtil.isGetMethodOfObject(getter)
          && holdsUntypedSecret(getter.invoke(value))) {
        return true;
      }
    }
    return false;
  }

  private List<Ref> secretBearingBranches(
      JsonNode oneOf, String path, Map<String, JsonNode> schemas) {
    JsonNode branches = oneOf.has("oneOf") ? oneOf.get("oneOf") : oneOf.get("anyOf");
    List<Ref> secretBearing = new ArrayList<>();
    for (JsonNode branch : branches) {
      Ref resolved = new Ref(branch, path);
      String ref = branch.path("$ref").asText("");
      if (!ref.isEmpty()) {
        resolved = resolveRef(ref, path, schemas);
      }
      if (resolved != null && containsPasswordFormat(resolved.node(), resolved.path(), schemas)) {
        secretBearing.add(resolved);
      }
    }
    if (secretBearing.isEmpty()) {
      throw new IllegalStateException("No secret-bearing branch under " + path);
    }
    return secretBearing;
  }

  /**
   * A payload that reaches every {@code format: password} leaf of {@code branch}, with each level's
   * plain fields filled in as a real config would have them, so a converter that picks the branch
   * by its fields or by an enum discriminator sees what it would see in production.
   */
  private Object secretPayload(JsonNode branch, String path, Map<String, JsonNode> schemas) {
    Map<String, Object> payload = new LinkedHashMap<>();
    String owner = simpleJavaName(branch, path);
    JsonNode properties = branch.path("properties");
    for (String name : iterable(properties.fieldNames())) {
      JsonNode property = properties.get(name);
      if (KNOWN_UNCONVERTIBLE.contains(owner + "." + name)) {
        allowlistHits.add(owner + "." + name);
        continue;
      }
      String ref = property.path("$ref").asText("");
      Ref resolved = ref.isEmpty() ? new Ref(property, path) : resolveRef(ref, path, schemas);
      if (resolved == null) {
        continue;
      }
      JsonNode node = resolved.node();
      if ("password".equals(node.path("format").asText(""))) {
        payload.put(name, SECRET);
      } else if (node.path("enum").size() > 0) {
        payload.put(name, node.get("enum").get(0).asText());
      } else if (containsPasswordFormat(node, resolved.path(), schemas)) {
        payload.put(
            name,
            node.has("properties")
                ? secretPayload(node, resolved.path(), schemas)
                : secretPayload(
                    secretBearingBranches(node, resolved.path(), schemas).get(0).node(),
                    resolved.path(),
                    schemas));
      } else {
        plainValue(node).ifPresent(value -> payload.put(name, value));
      }
    }
    return payload;
  }

  private static Optional<Object> plainValue(JsonNode node) {
    return switch (node.path("type").asText("")) {
      case "string" -> Optional.of("value");
      case "boolean" -> Optional.of(Boolean.TRUE);
      case "integer", "number" -> Optional.of(1);
      default -> Optional.empty();
    };
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
        schemas.put(resource.getPath(), read(resource));
      }
    }
    return schemas;
  }

  private static JsonNode read(final Resource resource) {
    try {
      return JsonUtils.readTree(resource.getContentAsString());
    } catch (IOException | JsonParsingException e) {
      throw new IllegalStateException("Cannot read schema " + resource.getPath(), e);
    }
  }

  private static <T> Iterable<T> iterable(java.util.Iterator<T> iterator) {
    return () -> iterator;
  }

  private record Ref(JsonNode node, String path) {}
}
