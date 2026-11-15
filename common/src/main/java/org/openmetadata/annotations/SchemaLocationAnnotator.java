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
package org.openmetadata.annotations;

import com.fasterxml.jackson.databind.JsonNode;
import com.sun.codemodel.JDefinedClass;
import com.sun.codemodel.JPackage;
import com.sun.codemodel.JResourceFile;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.TreeMap;
import org.jsonschema2pojo.AbstractAnnotator;

public class SchemaLocationAnnotator extends AbstractAnnotator {
  private static final String LOCATION = "x-om-schema-location";
  private static final String RESOURCE = "schema-java-types.properties";
  private final Map<String, String> types = new TreeMap<>();

  @Override
  public void typeInfo(JDefinedClass clazz, JsonNode schema) {
    JsonNode location = schema.get(LOCATION);
    if (location == null || !location.isTextual()) {
      return;
    }
    String previous = types.putIfAbsent(location.asText(), clazz.fullName());
    if (previous != null && !previous.equals(clazz.fullName())) {
      throw new IllegalStateException("Conflicting generated types for " + location.asText());
    }
    JPackage resourcePackage = clazz.owner()._package("META-INF.openmetadata");
    if (!resourcePackage.hasResourceFile(RESOURCE)) {
      resourcePackage.addResourceFile(new Index());
    }
  }

  private class Index extends JResourceFile {
    private Index() {
      super(RESOURCE);
    }

    @Override
    protected void build(OutputStream output) throws IOException {
      for (Map.Entry<String, String> entry : types.entrySet()) {
        String line = escape(entry.getKey()) + "=" + escape(entry.getValue()) + "\n";
        output.write(line.getBytes(StandardCharsets.US_ASCII));
      }
    }
  }

  private static String escape(String value) {
    StringBuilder escaped = new StringBuilder();
    for (char character : value.toCharArray()) {
      if (character < 0x20 || character > 0x7e) {
        escaped.append(String.format("\\u%04x", (int) character));
      } else {
        if ("\\ :=#!".indexOf(character) >= 0) {
          escaped.append('\\');
        }
        escaped.append(character);
      }
    }
    return escaped.toString();
  }
}
