/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.openmetadata.catalog.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.JsonMetaSchema;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.ValidationMessage;
import com.networknt.schema.urn.URNFactory;

import javax.json.Json;
import javax.json.JsonPatch;
import javax.json.JsonValue;
import javax.json.JsonWriter;
import javax.json.JsonWriterFactory;
import javax.json.stream.JsonGenerator;
import java.io.IOException;
import java.io.InputStream;
import java.io.StringReader;
import java.io.StringWriter;
import java.io.Writer;
import java.util.Collections;
import java.util.Map;
import java.util.Set;

public final class JsonSchemaUtil {

  private JsonSchemaUtil() {

  }

  public static Set<ValidationMessage> validate(InputStream schemaStream, String jsonPayload) throws IOException {
    return validate(schemaStream, jsonPayload, null);
  }

  public static Set<ValidationMessage> validate(InputStream schemaStream, String jsonPayload, URNFactory urnFactory)
          throws IOException {
    JsonSchemaFactory.Builder builder = new JsonSchemaFactory.Builder();
    JsonMetaSchema metaSchema = JsonMetaSchema.getV7();
    builder.defaultMetaSchemaURI(metaSchema.getUri()).addMetaSchema(metaSchema);
    if (urnFactory != null) {
      builder.addUrnFactory(urnFactory);
    }

    JsonSchemaFactory factory = builder.build();
    JsonSchema schema = factory.getSchema(schemaStream);

    ObjectMapper mapper = new ObjectMapper();
    JsonNode node = mapper.readTree(jsonPayload);
    return schema.validate(node);
  }

  public static String diffTwoJson(String v1, String v2) {
    JsonValue source = Json.createReader(new StringReader(v1)).readValue();
    JsonValue dest = Json.createReader(new StringReader(v2)).readValue();

    JsonPatch diff = Json.createDiff(source.asJsonObject(), dest.asJsonObject());
    return formatJson(diff.toJsonArray());
  }

  public static String formatJson(JsonValue jsonValue) {
    StringWriter stringWriter = new StringWriter();
    prettyPrintString(jsonValue, stringWriter);
    return stringWriter.toString();
  }

  public static void prettyPrintString(JsonValue jsonValue, Writer writer) {
    Map<String, Object> config = Collections.singletonMap(JsonGenerator.PRETTY_PRINTING, true);
    JsonWriterFactory writerFactory = Json.createWriterFactory(config);
    try (JsonWriter jsonWriter = writerFactory.createWriter(writer)) {
      jsonWriter.write(jsonValue);
    }
  }
}
