package org.openmetadata.core.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.ValidationMessage;
import java.io.IOException;
import java.util.Iterator;
import java.util.Map.Entry;
import java.util.Set;
import org.junit.jupiter.api.Test;

class TypeUtilTest {
  private static final String customAttributes;
  private static final ObjectMapper mapper = new ObjectMapper();

  static {
    ObjectNode node = mapper.createObjectNode();
    node.put("intValue", 1);
    node.put("stringValue", "abc");
    node.put("stringValue", "abc");
    customAttributes = node.toString();
  }

  @Test
  void testTypeValue() throws IOException {
    JsonSchema intSchema = JsonUtils.getJsonSchema("{ \"type\" : \"integer\", \"minimum\": 10}");
    JsonSchema stringSchema = JsonUtils.getJsonSchema("{ \"type\" : \"string\"}");
    JsonNode json = mapper.readTree(customAttributes);
    Iterator<Entry<String, JsonNode>> x = json.fields();
    while (x.hasNext()) {
      var entry = x.next();
      if (entry.getKey().equals("intValue")) {
        Set<ValidationMessage> result = intSchema.validate(entry.getValue());
      } else if (entry.getKey().equals("stringValue")) {
        Set<ValidationMessage> result = stringSchema.validate(entry.getValue());
      }
    }
  }
}
