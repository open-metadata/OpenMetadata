package org.openmetadata.service.secrets.masker;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.secrets.JsonSchemas;
import org.openmetadata.service.secrets.JsonSchemas.Ref;

/**
 * A copy of an entity, such as a change event, leaves out the fields its generated class marks
 * {@code @MaskedField}, so a secret stays out of it only inside a masked field. The generator reads
 * {@code mask} on a property that declares its own type, or on the root of the schema a property
 * references. Next to a {@code $ref} it is dropped without a word.
 *
 * <p>The walk follows fields that have a single Java type. It stops at fields with no single Java
 * type ({@code oneOf}, {@code anyOf} and maps), whose values are kept as plain maps.
 */
class SecretFieldsAreMaskedTest {
  private static final String MASK = "mask";
  private static final String REF = "$ref";
  private static final String PASSWORD = "password";
  private static final int MAX_REF_HOPS = 16;
  private static final JsonSchemas SCHEMAS = JsonSchemas.load();

  @Test
  void noMaskSitsNextToARef() {
    final List<String> dropped = new ArrayList<>();
    SCHEMAS.all().forEach((path, schema) -> collectMasksNextToRefs(schema, path, dropped));

    assertTrue(
        dropped.isEmpty(),
        "The generator drops a mask next to a $ref: put it on the root of the referenced schema "
            + "instead. Found in "
            + dropped);
  }

  @Test
  void everySecretInAnEntityIsMasked() {
    final List<Ref> entities = SCHEMAS.entities();
    final List<String> unmasked = new ArrayList<>();
    entities.forEach(
        entity ->
            collectUnmaskedSecrets(
                entity,
                nameOf(entity.path()),
                Collections.newSetFromMap(new IdentityHashMap<>()),
                unmasked));

    assertTrue(entities.size() > 50, "Found only " + entities.size() + " entity schemas");
    assertTrue(unmasked.isEmpty(), "These secrets sit in no masked field: " + unmasked);
  }

  private static void collectMasksNextToRefs(
      final JsonNode node, final String trail, final List<String> found) {
    if (node.path(MASK).isBoolean() && node.has(REF)) {
      found.add(trail);
    }
    if (node.isObject()) {
      node.fieldNames()
          .forEachRemaining(
              name -> collectMasksNextToRefs(node.get(name), trail + "/" + name, found));
    }
    if (node.isArray()) {
      node.forEach(element -> collectMasksNextToRefs(element, trail, found));
    }
  }

  private static void collectUnmaskedSecrets(
      final Ref value, final String trail, final Set<JsonNode> seen, final List<String> found) {
    final Ref type = typeOf(value);
    if (type == null || !seen.add(type.node())) {
      return;
    }
    if (PASSWORD.equals(type.node().path("format").asText())) {
      found.add(trail);
    }
    final JsonNode properties = type.node().path("properties");
    properties
        .fieldNames()
        .forEachRemaining(
            name -> {
              final Ref property = new Ref(properties.get(name), type.path());
              if (!isMasked(property)) {
                collectUnmaskedSecrets(property, trail + " > " + name, seen, found);
              }
            });
    if (type.node().path("items").isObject()) {
      collectUnmaskedSecrets(new Ref(type.node().get("items"), type.path()), trail, seen, found);
    }
  }

  // Like the generator: a property takes the keys of the schema its $ref chain ends at.
  private static Ref typeOf(final Ref node) {
    Ref current = node;
    for (int hops = 0; current != null && current.node().has(REF) && hops < MAX_REF_HOPS; hops++) {
      current = SCHEMAS.resolve(current.node().get(REF).asText(), current.path());
    }
    return current;
  }

  private static boolean isMasked(final Ref property) {
    final Ref type = typeOf(property);
    return type != null && type.node().path(MASK).asBoolean(false);
  }

  private static String nameOf(final String path) {
    return path.substring(path.lastIndexOf('/') + 1, path.length() - ".json".length());
  }
}
