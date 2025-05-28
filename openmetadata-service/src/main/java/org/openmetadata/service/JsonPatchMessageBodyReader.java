/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonPatch;
import jakarta.json.JsonReader;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.ext.MessageBodyReader;
import jakarta.ws.rs.ext.Provider;
import java.io.IOException;
import java.io.InputStream;
import java.io.StringReader;
import java.lang.annotation.Annotation;
import java.lang.reflect.Type;

@Provider
@Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
public class JsonPatchMessageBodyReader implements MessageBodyReader<JsonPatch> {

  @Override
  public boolean isReadable(
      Class<?> type, Type genericType, Annotation[] annotations, MediaType mediaType) {
    return JsonPatch.class.isAssignableFrom(type);
  }

  @Override
  public JsonPatch readFrom(
      Class<JsonPatch> type,
      Type genericType,
      Annotation[] annotations,
      MediaType mediaType,
      MultivaluedMap<String, String> httpHeaders,
      InputStream entityStream)
      throws IOException, WebApplicationException {
    try {
      // Use Jackson to read the JSON content first to avoid JsonStructure deserialization issues
      ObjectMapper mapper = new ObjectMapper();
      JsonNode jsonNode = mapper.readTree(entityStream);
      String jsonString = jsonNode.toString();

      // Now parse using Jakarta JSON API
      try (JsonReader reader = Json.createReader(new StringReader(jsonString))) {
        JsonArray jsonArray = reader.readArray();
        return Json.createPatch(jsonArray);
      }
    } catch (Exception e) {
      throw new WebApplicationException("Failed to parse JsonPatch", e);
    }
  }
}
