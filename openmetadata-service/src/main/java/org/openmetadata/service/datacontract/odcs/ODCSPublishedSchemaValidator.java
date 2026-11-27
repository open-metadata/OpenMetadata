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
import com.networknt.schema.path.NodePath;
import java.util.List;

/** Uses the unchanged published schemas for whole documents and preserved field fragments. */
final class ODCSPublishedSchemaValidator {
  private ODCSPublishedSchemaValidator() {}

  static Schema load(String location) {
    return SchemaRegistry.withDefaultDialect(SpecificationVersion.DRAFT_2019_09)
        .getSchema(SchemaLocation.of(location));
  }

  static List<Error> validate(Schema schema, JsonNode document) {
    return List.copyOf(schema.validate(document));
  }

  static boolean validFragment(Schema schema, NodePath path, JsonNode value) {
    return schema.getSubSchema(path).validate(value).isEmpty();
  }
}
