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

package org.openmetadata.service.secrets.converter;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.metadataIngestion.SourceConfig;

class JsonSchemaRepositoryTest {
  private static final String TEST_PROBE_SCHEMAS = "json/schema/entity/driftProbe";
  private static final JsonSchemaRepository SCHEMAS = JsonSchemaRepository.getInstance();

  @Test
  void everyObjectSchemaWithoutAJavaTypeResolvesToItsGeneratedClass() {
    List<String> unresolved =
        SCHEMAS.schemaPaths().stream()
            .filter(JsonSchemaRepositoryTest::generatesARootClass)
            .filter(path -> SCHEMAS.javaClass(SCHEMAS.rootSchema(path)) == null)
            .toList();

    assertTrue(unresolved.isEmpty(), "No generated class found for " + unresolved);
  }

  /** Its branch holds no secret, so the config is kept as given. */
  @Test
  void anMlModelMetadataConfigIsAccepted() {
    Map<String, Object> config = Map.of("type", "MlModelMetadata");

    assertSame(config, ClassConverterFactory.convertProperty(SourceConfig.class, "config", config));
  }

  private static boolean generatesARootClass(String path) {
    JsonSchemaRepository.Ref schema = SCHEMAS.rootSchema(path);
    return !path.startsWith(TEST_PROBE_SCHEMAS)
        && schema.node().has("properties")
        && !schema.node().has("javaType");
  }
}
