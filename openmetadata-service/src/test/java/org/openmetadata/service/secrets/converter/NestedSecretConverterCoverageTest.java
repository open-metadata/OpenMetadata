package org.openmetadata.service.secrets.converter;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.lang.reflect.Method;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Deque;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.service.secrets.JsonSchemas;
import org.openmetadata.service.secrets.JsonSchemas.Ref;
import org.openmetadata.service.util.ReflectionUtil;

class NestedSecretConverterCoverageTest {

  private static final String SECRET = "openmetadata-nested-secret";
  private static final String SCHEMA_ROOT = "json/schema/";
  private static final List<String> SCAN_ROOTS =
      List.of("json/schema/entity/services/connections", "json/schema/metadataIngestion");

  private record SecretOneOf(Ref owner, String property, Ref oneOf) {}

  @Test
  void everySecretBearingOneOfBranchIsConvertedRecursively() {
    JsonSchemas schemas = JsonSchemas.load();
    assertTrue(
        schemas.all().size() > 100,
        "No JSON schemas found on the classpath, found " + schemas.all().size());

    List<String> uncovered = new ArrayList<>();
    for (Map.Entry<String, JsonNode> entry : schemas.all().entrySet()) {
      if (SCAN_ROOTS.stream().noneMatch(root -> entry.getKey().startsWith(root))) {
        continue;
      }
      List<SecretOneOf> properties = new ArrayList<>();
      collectSecretOneOfProperties(
          new Ref(entry.getValue(), entry.getKey()), schemas, new HashSet<>(), properties);
      for (SecretOneOf property : properties) {
        for (Ref branch : secretBearingBranches(property.oneOf(), schemas)) {
          if (leavesSecretsInAMap(property, branch, schemas)) {
            uncovered.add(describe(property) + " via " + branch.path());
          }
        }
      }
    }

    assertTrue(
        uncovered.isEmpty(),
        "These oneOf branches still hold secrets in a Map after conversion, so encryption and "
            + "masking would skip them: "
            + uncovered);
  }

  private void collectSecretOneOfProperties(
      Ref owner, JsonSchemas schemas, Set<String> visited, List<SecretOneOf> properties) {
    if (!visited.add(owner.path() + "@" + System.identityHashCode(owner.node()))) {
      return;
    }
    JsonNode fields = owner.node().path("properties");
    for (String name : iterable(fields.fieldNames())) {
      Ref property = resolve(new Ref(fields.get(name), owner.path()), schemas);
      if (property == null) {
        continue;
      }
      Ref oneOf = resolveToOneOfNode(new Ref(fields.get(name), owner.path()), schemas);
      if (oneOf != null && containsPasswordFormat(oneOf.node(), oneOf.path(), schemas)) {
        properties.add(new SecretOneOf(owner, name, oneOf));
      }
      if (oneOf != null) {
        for (Ref branch : branches(oneOf, schemas)) {
          collectSecretOneOfProperties(branch, schemas, visited, properties);
        }
      } else {
        collectSecretOneOfProperties(property, schemas, visited, properties);
      }
      collectArrayItemProperties(property, schemas, visited, properties);
    }
  }

  private void collectArrayItemProperties(
      Ref property, JsonSchemas schemas, Set<String> visited, List<SecretOneOf> properties) {
    if (property.node().path("items").isObject()) {
      Ref items = resolve(new Ref(property.node().get("items"), property.path()), schemas);
      if (items != null) {
        collectSecretOneOfProperties(items, schemas, visited, properties);
      }
    }
  }

  private boolean leavesSecretsInAMap(SecretOneOf property, Ref branch, JsonSchemas schemas) {
    String javaType = javaType(property.owner(), schemas);
    if (javaType.isEmpty()) {
      return true;
    }
    try {
      Class<?> ownerClass = Class.forName(javaType);
      Map<String, Object> payload = new LinkedHashMap<>();
      payload.put(property.property(), secretPayload(branch.node(), branch.path(), schemas));
      Object converted = ClassConverterFactory.getConverter(ownerClass).convert(payload);
      return containsSecretInAMap(converted, new IdentityHashMap<>());
    } catch (ReflectiveOperationException | RuntimeException e) {
      return true;
    }
  }

  private boolean containsSecretInAMap(Object value, Map<Object, Boolean> visited) {
    if (value instanceof Map<?, ?> map) {
      return map.values().stream()
          .anyMatch(child -> SECRET.equals(child) || containsSecretInAMap(child, visited));
    }
    if (value instanceof Collection<?> collection) {
      return collection.stream().anyMatch(child -> containsSecretInAMap(child, visited));
    }
    if (!Boolean.TRUE.equals(CommonUtil.isOpenMetadataObject(value))
        || visited.put(value, Boolean.TRUE) != null) {
      return false;
    }
    for (Method method : value.getClass().getMethods()) {
      if (isInstanceGetter(method)) {
        Object child = ReflectionUtil.getObjectFromMethod(method, value);
        if (containsSecretInAMap(child, visited)) {
          return true;
        }
      }
    }
    return false;
  }

  private boolean isInstanceGetter(Method method) {
    return ReflectionUtil.isGetMethodOfObject(method)
        && method.getParameterCount() == 0
        && !"getClass".equals(method.getName());
  }

  private List<Ref> secretBearingBranches(Ref oneOf, JsonSchemas schemas) {
    return branches(oneOf, schemas).stream()
        .filter(branch -> containsPasswordFormat(branch.node(), branch.path(), schemas))
        .toList();
  }

  private List<Ref> branches(Ref oneOf, JsonSchemas schemas) {
    JsonNode branches =
        oneOf.node().has("oneOf") ? oneOf.node().get("oneOf") : oneOf.node().get("anyOf");
    List<Ref> resolved = new ArrayList<>();
    for (JsonNode branch : branches) {
      Ref resolvedBranch = resolve(new Ref(branch, oneOf.path()), schemas);
      if (resolvedBranch != null) {
        resolved.add(resolvedBranch);
      }
    }
    return resolved;
  }

  private Object secretPayload(JsonNode branch, String path, JsonSchemas schemas) {
    Map<String, Object> payload = new LinkedHashMap<>();
    JsonNode properties = branch.path("properties");
    for (String name : iterable(properties.fieldNames())) {
      Ref property = resolve(new Ref(properties.get(name), path), schemas);
      if (property == null) {
        continue;
      }
      JsonNode node = property.node();
      if ("password".equals(node.path("format").asText(""))) {
        payload.put(name, SECRET);
      } else if (node.path("enum").size() == 1) {
        payload.put(name, node.get("enum").get(0).asText());
      } else if (node.has("const")) {
        payload.put(name, node.get("const").asText());
      } else if (containsPasswordFormat(node, property.path(), schemas)) {
        payload.put(name, nestedSecretPayload(property, schemas));
      }
    }
    return payload;
  }

  private Object nestedSecretPayload(Ref property, JsonSchemas schemas) {
    if (property.node().has("properties")) {
      return secretPayload(property.node(), property.path(), schemas);
    }
    if ("array".equals(property.node().path("type").asText(""))) {
      Ref items = resolve(new Ref(property.node().get("items"), property.path()), schemas);
      return List.of(nestedSecretPayload(items, schemas));
    }
    Ref oneOf = resolveToOneOfNode(property, schemas);
    if (oneOf == null) {
      return new LinkedHashMap<>();
    }
    List<Ref> branches = secretBearingBranches(oneOf, schemas);
    if (branches.isEmpty()) {
      return new LinkedHashMap<>();
    }
    Ref branch = branches.getFirst();
    return secretPayload(branch.node(), branch.path(), schemas);
  }

  private Ref resolve(Ref ref, JsonSchemas schemas) {
    String reference = ref.node().path("$ref").asText("");
    return reference.isEmpty() ? ref : schemas.resolve(reference, ref.path());
  }

  private Ref resolveToOneOfNode(Ref property, JsonSchemas schemas) {
    Ref current = property;
    for (int depth = 0; depth < 16 && current != null; depth++) {
      if (current.node().has("properties")) {
        return null;
      }
      if (current.node().has("oneOf") || current.node().has("anyOf")) {
        return current;
      }
      if (current.node().path("$ref").asText("").isEmpty()) {
        return null;
      }
      current = resolve(current, schemas);
    }
    return null;
  }

  private String javaType(Ref owner, JsonSchemas schemas) {
    String javaType = owner.node().path("javaType").asText("");
    if (!javaType.isEmpty() || schemas.all().get(owner.path()) != owner.node()) {
      return javaType;
    }
    String title = owner.node().path("title").asText("");
    if (title.isEmpty()) {
      return "";
    }
    String directory = owner.path().substring(SCHEMA_ROOT.length(), owner.path().lastIndexOf('/'));
    String className = Character.toUpperCase(title.charAt(0)) + title.substring(1);
    return "org.openmetadata.schema." + directory.replace('/', '.') + "." + className;
  }

  private String describe(SecretOneOf property) {
    String owner = property.owner().node().path("javaType").asText(property.owner().path());
    return owner + "." + property.property();
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
