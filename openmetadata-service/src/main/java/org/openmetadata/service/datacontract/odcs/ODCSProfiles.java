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
import java.util.Map;
import java.util.stream.Collectors;

/** The published schemas and adapters shared by import and export. */
public final class ODCSProfiles {
  private static final Map<String, ODCSVersionAdapter> ADAPTERS =
      Map.of(
          ODCSExportService.DEFAULT_VERSION,
          new ODCSV31Mapper(),
          "v3.0.2",
          new ODCSV30Mapper("v3.0.2"),
          "v3.0.1",
          new ODCSV30Mapper("v3.0.1"),
          "v3.0.0",
          new ODCSV30Mapper("v3.0.0"),
          "v2.2.2",
          new ODCSV22Mapper("v2.2.2"),
          "v2.2.1",
          new ODCSV22Mapper("v2.2.1"));
  // Generated POJOs cannot enforce every conditional ODCS constraint, and preserved metadata is
  // merged as raw JSON after serialization. Validate the complete export against the pinned schema
  // for its target version; these bundled validators are loaded once and reused.
  private static final Map<String, Schema> SCHEMAS =
      ADAPTERS.entrySet().stream()
          .collect(
              Collectors.toUnmodifiableMap(
                  Map.Entry::getKey,
                  entry ->
                      SchemaRegistry.withDefaultDialect(SpecificationVersion.DRAFT_2019_09)
                          .getSchema(SchemaLocation.of(entry.getValue().schemaLocation()))));

  private ODCSProfiles() {}

  public static ODCSVersionAdapter adapter(String version) {
    ODCSVersionAdapter adapter = ADAPTERS.get(version);
    if (adapter == null)
      throw new IllegalArgumentException(
          "Unsupported ODCS version `" + version + "`. Supported versions: " + supportedVersions());
    return adapter;
  }

  public static List<String> supportedVersions() {
    return ADAPTERS.keySet().stream().sorted().toList();
  }

  public static List<String> validate(String version, JsonNode document) {
    return validationErrors(version, document).stream().map(Object::toString).toList();
  }

  public static List<Error> validationErrors(String version, JsonNode document) {
    adapter(version);
    return List.copyOf(SCHEMAS.get(version).validate(document));
  }

  static boolean validFragment(String version, NodePath path, JsonNode value) {
    return SCHEMAS.get(version).getSubSchema(path).validate(value).isEmpty();
  }
}
