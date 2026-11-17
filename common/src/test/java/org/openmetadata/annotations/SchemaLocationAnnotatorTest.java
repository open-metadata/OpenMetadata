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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.codemodel.JCodeModel;
import java.io.IOException;
import java.io.Reader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;
import org.jsonschema2pojo.DefaultGenerationConfig;
import org.jsonschema2pojo.SchemaGenerator;
import org.jsonschema2pojo.SchemaMapper;
import org.jsonschema2pojo.SchemaStore;
import org.jsonschema2pojo.rules.RuleFactory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class SchemaLocationAnnotatorTest {
  private static final String ROOT = "json/schema/fixture/mlmodelServiceMetadataPipeline.json#";
  private static final String INDEX = "META-INF/openmetadata/schema-java-types.properties";

  @TempDir Path temporary;

  @Test
  void indexesActualGeneratedClassesDeterministically() throws IOException {
    Path first = generate(temporary.resolve("first"));
    Path second = generate(temporary.resolve("second"));
    assertEquals(Files.readString(first.resolve(INDEX)), Files.readString(second.resolve(INDEX)));
    Properties index = new Properties();
    try (Reader reader = Files.newBufferedReader(first.resolve(INDEX))) {
      index.load(reader);
    }
    assertEquals("fixture.custom.MlmodelServiceMetadataPipeline", index.getProperty(ROOT));
    assertEquals("fixture.explicit.InlineType", index.getProperty(ROOT + "/properties/a~1b~0c"));
    String shared = index.getProperty(ROOT + "/definitions/shared");
    assertTrue(
        shared != null && Files.isRegularFile(first.resolve(shared.replace('.', '/') + ".java")));
    assertEquals(3, index.size());
  }

  private Path generate(Path output) throws IOException {
    Files.createDirectories(output);
    String schema =
        """
        {
          "title": "A Different UI Label",
          "type": "object",
          "x-om-schema-location": "%s",
          "properties": {
            "a/b~c": {"type": "object", "javaType": "fixture.explicit.InlineType",
              "x-om-schema-location": "%s/properties/a~1b~0c",
              "properties": {"value": {"type": "string"}}},
            "first": {"$ref": "#/definitions/shared"},
            "second": {"$ref": "#/definitions/shared"}
          },
          "definitions": {"shared": {"type": "object",
            "x-om-schema-location": "%s/definitions/shared",
            "properties": {"value": {"type": "string"}}}}
        }
        """
            .formatted(ROOT, ROOT, ROOT);
    JCodeModel model = new JCodeModel();
    SchemaMapper mapper =
        new SchemaMapper(
            new RuleFactory(
                new DefaultGenerationConfig(), new OpenMetadataAnnotator(), new SchemaStore()),
            new SchemaGenerator());
    mapper.generate(model, "MlmodelServiceMetadataPipeline", "fixture.custom", schema);
    model.build(output.toFile());
    return output;
  }
}
