package org.openmetadata.service.ontology;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectReader;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.DecimalNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Map;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.utils.JsonUtils;

/** Deterministic JSON content across MySQL JSON and PostgreSQL JSONB storage. */
public final class OntologyJson {
  private static final ObjectReader READER =
      JsonUtils.getObjectMapper()
          .readerFor(JsonNode.class)
          .with(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS);

  private OntologyJson() {}

  public static JsonNode read(final String json) {
    try {
      return READER.readValue(json);
    } catch (JsonProcessingException exception) {
      throw new JsonParsingException("Unable to read ontology content", exception);
    }
  }

  public static JsonNode canonical(final JsonNode value) {
    if (value instanceof ObjectNode object) {
      final ObjectNode sorted = JsonUtils.getObjectNode();
      object.properties().stream()
          .sorted(Map.Entry.comparingByKey())
          .forEach(entry -> sorted.set(entry.getKey(), canonical(entry.getValue())));
      return sorted;
    }
    if (value instanceof ArrayNode array) {
      final ArrayNode ordered = JsonUtils.getObjectMapper().createArrayNode();
      array.forEach(item -> ordered.add(canonical(item)));
      return ordered;
    }
    if (value.isNumber()) {
      return DecimalNode.valueOf(value.decimalValue().stripTrailingZeros());
    }
    return value;
  }
}
