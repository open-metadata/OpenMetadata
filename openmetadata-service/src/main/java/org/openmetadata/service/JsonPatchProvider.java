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

import com.fasterxml.jackson.core.json.JsonReadFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr353.JSR353Module;
import jakarta.ws.rs.ext.ContextResolver;
import jakarta.ws.rs.ext.Provider;

@Provider
public class JsonPatchProvider implements ContextResolver<ObjectMapper> {
  @Override
  public ObjectMapper getContext(Class<?> type) {
    final ObjectMapper mapper = new ObjectMapper();
    mapper.registerModule(new JSR353Module());
    mapper.configure(SerializationFeature.FAIL_ON_EMPTY_BEANS, false);
    // This feature allows the parser to accept non-numeric numbers such as NaN,
    // Infinity, and -Infinity in JSON input. ref:
    // https://github.com/FasterXML/jackson-core/wiki/JsonReadFeatures
    mapper.enable(JsonReadFeature.ALLOW_NON_NUMERIC_NUMBERS.mappedFeature());
    return mapper;
  }
}
