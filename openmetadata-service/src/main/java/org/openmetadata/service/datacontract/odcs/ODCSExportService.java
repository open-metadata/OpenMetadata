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
import com.networknt.schema.Schema;
import com.networknt.schema.SchemaLocation;
import com.networknt.schema.SchemaRegistry;
import com.networknt.schema.SpecificationVersion;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;

/** Selects an explicit export profile and validates the complete merged wire document. */
public final class ODCSExportService {
  public static final String DEFAULT_VERSION = "v3.1.0";
  private static final Map<String, ODCSVersionAdapter> ADAPTERS =
      Map.of(
          DEFAULT_VERSION,
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
  private final Function<DataContract, List<ODCSQualityRule>> qualityRules;

  public record Result(String version, JsonNode document, List<String> issues) {
    public Result {
      issues = List.copyOf(issues);
    }

    public boolean valid() {
      return issues.isEmpty();
    }

    public JsonNode requireValid() {
      if (!valid())
        throw new IllegalArgumentException(
            "Cannot export ODCS " + version + ": " + String.join("; ", issues));
      return document;
    }
  }

  public ODCSExportService(Function<DataContract, List<ODCSQualityRule>> qualityRules) {
    this.qualityRules = qualityRules;
  }

  public Result export(DataContract contract, String version) {
    ODCSVersionAdapter adapter = adapter(version);
    JsonNode nativeDocument = adapter.write(contract, qualityRules.apply(contract));
    JsonNode restored =
        ODCSMetadataOverlay.apply(contract, adapter.preservationView(nativeDocument), Set.of());
    JsonNode document = adapter.materialize(restored, contract);
    List<String> issues =
        SCHEMAS.get(version).validate(document).stream().map(Object::toString).toList();
    return new Result(version, document, issues);
  }

  public static JsonNode nativeDocument(DataContract contract, List<ODCSQualityRule> rules) {
    return adapter(DEFAULT_VERSION).write(contract, rules);
  }

  /** The compatibility reader uses v3.1; its baseline must precede target entity resolution. */
  public static JsonNode importBaseline(DataContract contract, String sourceObject) {
    return new ODCSV31Mapper().write(contract, List.of(), sourceObject);
  }

  public static JsonNode document(
      DataContract contract, List<ODCSQualityRule> rules, Set<String> managedNames) {
    return ODCSMetadataOverlay.apply(contract, nativeDocument(contract, rules), managedNames);
  }

  private static ODCSVersionAdapter adapter(String version) {
    ODCSVersionAdapter adapter = ADAPTERS.get(version);
    if (adapter == null)
      throw new IllegalArgumentException(
          "Unsupported ODCS export version `"
              + version
              + "`. Supported versions: "
              + ADAPTERS.keySet());
    return adapter;
  }
}
