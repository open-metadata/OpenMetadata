package org.openmetadata.service.rdf;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.github.classgraph.ClassGraph;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.rdf.translator.JsonLdTranslator;

/** Exercises the projection with populated schema fields, including optional fields added later. */
final class RdfSchemaFixture {
  private static final ObjectMapper JSON = new ObjectMapper();
  private static final String SCHEMAS = "json/schema/entity/";
  private static final UUID ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

  private RdfSchemaFixture() {}

  static List<String> entitySchemas() {
    try (var scan = new ClassGraph().acceptPaths(SCHEMAS).scan()) {
      return scan.getAllResources().getPaths().stream()
          .filter(path -> path.endsWith(".json"))
          .filter(
              path ->
                  read(URI.create("classpath:/" + path))
                      .path("javaInterfaces")
                      .toString()
                      .contains("org.openmetadata.schema.EntityInterface"))
          .distinct()
          .sorted()
          .toList();
    }
  }

  static FixtureEntity entity(final String path) {
    final URI location = URI.create("classpath:/" + path);
    final ObjectNode fields = (ObjectNode) sample(read(location), location, new HashSet<>(), 0);
    final String type = path.substring(path.lastIndexOf('/') + 1, path.length() - ".json".length());
    fields.put("id", ID.toString());
    fields.put("fullyQualifiedName", "service.db.schema.fixture");
    return new FixtureEntity(type, fields);
  }

  static JsonLdTranslator translator() {
    final SimpleModule module = new SimpleModule();
    module.addSerializer(
        FixtureEntity.class,
        new JsonSerializer<>() {
          @Override
          public void serialize(
              final FixtureEntity value,
              final JsonGenerator generator,
              final SerializerProvider serializers)
              throws IOException {
            generator.writeTree(value.fields);
          }
        });
    return new JsonLdTranslator(
        new ObjectMapper().registerModule(module), "https://open-metadata.org/");
  }

  private static JsonNode sample(
      final JsonNode schema, final URI location, final Set<URI> references, final int depth) {
    if (schema.has("$ref")) {
      final URI target = location.resolve(schema.get("$ref").asText());
      if (!references.add(target)) {
        return JsonNodeFactory.instance.nullNode();
      }
      final JsonNode result = sample(read(target), target, references, depth);
      references.remove(target);
      return result;
    }
    if (schema.has("enum")) {
      return schema.get("enum").get(0);
    }
    for (String alternatives : List.of("oneOf", "anyOf")) {
      if (schema.has(alternatives)) {
        return sample(schema.get(alternatives).get(0), location, references, depth);
      }
    }
    String type =
        schema.path("type").isArray()
            ? schema.get("type").get(0).asText()
            : schema.path("type").asText();
    if (schema.has("properties")) {
      type = "object";
    }
    return switch (type) {
      case "object" -> sampleObject(schema, location, references, depth);
      case "array" -> depth > 4
          ? JSON.createArrayNode()
          : JSON.createArrayNode()
              .add(sample(schema.path("items"), location, references, depth + 1));
      case "integer" -> JsonNodeFactory.instance.numberNode(1000L);
      case "number" -> JsonNodeFactory.instance.numberNode(0.5);
      case "boolean" -> JsonNodeFactory.instance.booleanNode(true);
      default -> JsonNodeFactory.instance.textNode(sampleString(schema));
    };
  }

  private static ObjectNode sampleObject(
      final JsonNode schema, final URI location, final Set<URI> references, final int depth) {
    final ObjectNode object = JSON.createObjectNode();
    if (depth <= 4) {
      schema
          .path("properties")
          .fields()
          .forEachRemaining(
              field -> {
                final JsonNode value = sample(field.getValue(), location, references, depth + 1);
                if (!value.isNull()) object.set(field.getKey(), value);
              });
    }
    if (location.getPath().endsWith("/entityReference.json")) {
      object.put("id", ID.toString());
      object.put("type", "table");
    }
    return object;
  }

  private static String sampleString(final JsonNode schema) {
    return switch (schema.path("format").asText()) {
      case "uuid" -> ID.toString();
      case "uri" -> "https://example.org/fixture";
      case "date" -> "2026-09-08";
      case "date-time" -> "2026-09-08T00:00:00Z";
      default -> "fixture";
    };
  }

  private static JsonNode read(final URI resource) {
    try (InputStream input = RdfSchemaFixture.class.getResourceAsStream(resource.getPath())) {
      if (input == null) throw new IllegalStateException("Missing fixture schema: " + resource);
      final JsonNode document = JSON.readTree(input);
      return resource.getFragment() == null ? document : document.at(resource.getFragment());
    } catch (IOException exception) {
      throw new IllegalStateException("Unable to read fixture schema: " + resource, exception);
    }
  }

  static final class FixtureEntity extends Table {
    private final String entityType;
    private final ObjectNode fields;

    FixtureEntity(final String entityType, final ObjectNode fields) {
      this.entityType = entityType;
      this.fields = fields;
      setId(ID);
      setName("fixture");
      setFullyQualifiedName("service.db.schema.fixture");
      setVersion(0.1);
      setUpdatedAt(1000L);
      setDeleted(true);
    }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference().withId(ID).withType(entityType).withName("fixture");
    }
  }
}
