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

package org.openmetadata.service.datacontract.odcs;

import com.fasterxml.jackson.databind.JsonNode;
import com.networknt.schema.Error;
import com.networknt.schema.Schema;
import com.networknt.schema.SchemaLocation;
import com.networknt.schema.SchemaRegistry;
import com.networknt.schema.SpecificationVersion;
import java.util.List;

/** Validates exports against the upstream schema, independently of OpenMetadata's reader model. */
public final class ODCSPublishedSchema {
  private static final Schema SCHEMA =
      SchemaRegistry.withDefaultDialect(SpecificationVersion.DRAFT_2019_09)
          .getSchema(SchemaLocation.of("classpath:odcs/odcs-json-schema-v3.1.0.json"));

  private ODCSPublishedSchema() {}

  public static List<Error> validate(JsonNode document) {
    return SCHEMA.validate(document);
  }
}
