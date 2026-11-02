/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.schema.entity.datacontract.odcs;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.BeanDescription;
import com.fasterxml.jackson.databind.DeserializationConfig;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JavaType;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.deser.Deserializers;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;
import com.fasterxml.jackson.databind.jsontype.TypeDeserializer;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.type.CollectionType;
import java.io.IOException;
import java.util.Iterator;
import java.util.Map;

/**
 * Reads the customProperties of contracts stored before they adopted the ODCS array form. Those
 * rows keep customProperties as a {@code {name: value}} mapping; this module rewrites it into the
 * {@code [{property, value}]} array the model reads, so stored contracts keep working without a
 * migration. It only intercepts collections of {@link ODCSCustomProperty}, so nothing else the
 * mappers read is affected.
 */
public final class ODCSCustomPropertiesCompatModule extends SimpleModule {

  /** Reads the collection itself, decoupled from the registered module so it cannot recurse. */
  private static final ObjectMapper PLAIN_MAPPER =
      new ObjectMapper().disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);

  public ODCSCustomPropertiesCompatModule() {
    super("ODCSCustomPropertiesCompatModule");
  }

  @Override
  public void setupModule(SetupContext context) {
    super.setupModule(context);
    context.addDeserializers(new CompatDeserializers());
  }

  private static final class CompatDeserializers extends Deserializers.Base {

    @Override
    public JsonDeserializer<?> findCollectionDeserializer(
        CollectionType type,
        DeserializationConfig config,
        BeanDescription beanDesc,
        TypeDeserializer elementTypeDeserializer,
        JsonDeserializer<?> defaultDeserializer) {
      return ODCSCustomProperty.class.equals(type.getContentType().getRawClass())
          ? new LegacyMapFormDeserializer(type)
          : null;
    }
  }

  @SuppressWarnings("serial")
  private static final class LegacyMapFormDeserializer extends StdDeserializer<Object> {
    private final JavaType collectionType;

    private LegacyMapFormDeserializer(JavaType collectionType) {
      super(collectionType);
      this.collectionType = collectionType;
    }

    @Override
    public Object deserialize(JsonParser parser, DeserializationContext ctxt) throws IOException {
      JsonNode node = parser.readValueAsTree();
      if (node.isObject()) {
        node = toArrayForm((ObjectNode) node);
      }
      return PLAIN_MAPPER.convertValue(node, collectionType);
    }
  }

  /** {@code {name: value}} becomes {@code [{property: name, value: value}]}, values verbatim. */
  private static JsonNode toArrayForm(ObjectNode mapForm) {
    ArrayNode arrayForm = JsonNodeFactory.instance.arrayNode();
    for (Iterator<Map.Entry<String, JsonNode>> fields = mapForm.fields(); fields.hasNext(); ) {
      Map.Entry<String, JsonNode> field = fields.next();
      ObjectNode property = arrayForm.addObject();
      property.put("property", field.getKey());
      property.set("value", field.getValue());
    }
    return arrayForm;
  }
}
