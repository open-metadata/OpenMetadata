package org.openmetadata.service.secrets;

import com.fasterxml.jackson.databind.JsonNode;
import io.github.classgraph.ClassGraph;
import io.github.classgraph.Resource;
import io.github.classgraph.ScanResult;
import java.io.IOException;
import java.util.ArrayDeque;
import java.util.Collections;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.utils.JsonUtils;

/** Every JSON schema on the classpath, keyed by its classpath-relative path, and their refs. */
public final class JsonSchemas {
  private static final String ROOT = "json/schema/";
  private static final String ENTITY_ROOT = ROOT + "entity/";
  private static final String ENTITY_INTERFACE = "org.openmetadata.schema.EntityInterface";

  private final Map<String, JsonNode> schemas;

  private JsonSchemas(final Map<String, JsonNode> schemas) {
    this.schemas = Collections.unmodifiableMap(schemas);
  }

  /** A schema node and the path of the file it was read from, which its own refs resolve against. */
  public record Ref(JsonNode node, String path) {}

  /** Fails on any schema it cannot read, so no schema is left out of the checks unnoticed. */
  public static JsonSchemas load() {
    final Map<String, JsonNode> schemas = new TreeMap<>();
    try (ScanResult scan = new ClassGraph().acceptPaths(ROOT).scan()) {
      for (Resource resource : scan.getResourcesWithExtension("json")) {
        schemas.put(resource.getPath(), read(resource));
      }
    }
    return new JsonSchemas(schemas);
  }

  private static JsonNode read(final Resource resource) {
    try {
      return JsonUtils.readTree(resource.getContentAsString());
    } catch (IOException | JsonParsingException e) {
      throw new IllegalStateException("Cannot read schema " + resource.getPath(), e);
    }
  }

  public Map<String, JsonNode> all() {
    return schemas;
  }

  /** The schemas of entities: the ones whose generated class implements EntityInterface. */
  public List<Ref> entities() {
    return schemas.entrySet().stream()
        .filter(entry -> entry.getKey().startsWith(ENTITY_ROOT))
        .filter(
            entry -> entry.getValue().path("javaInterfaces").toString().contains(ENTITY_INTERFACE))
        .map(entry -> new Ref(entry.getValue(), entry.getKey()))
        .toList();
  }

  /** The node {@code ref} points to from the schema at {@code base}, or null when it is missing. */
  public Ref resolve(final String ref, final String base) {
    final int hash = ref.indexOf('#');
    final String filePart = hash >= 0 ? ref.substring(0, hash) : ref;
    final String fragment = hash >= 0 ? ref.substring(hash + 1) : "";
    final String targetPath = filePart.isEmpty() ? base : normalize(base, filePart);
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
  private static String normalize(final String base, final String relative) {
    final Deque<String> segments = new ArrayDeque<>();
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
}
