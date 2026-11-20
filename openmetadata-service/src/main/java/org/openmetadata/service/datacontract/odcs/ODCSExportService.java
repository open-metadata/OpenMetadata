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
import java.util.List;
import java.util.Set;
import java.util.function.Function;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;

/** Selects an explicit export profile and validates the complete merged wire document. */
public final class ODCSExportService {
  public static final String DEFAULT_VERSION = "v3.1.0";
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
    ODCSVersionAdapter adapter = ODCSProfiles.adapter(version);
    JsonNode nativeDocument = adapter.write(contract, qualityRules.apply(contract));
    JsonNode restored =
        ODCSMetadataOverlay.applyVersioned(contract, adapter.preservationView(nativeDocument));
    JsonNode document =
        ODCSVersionMetadata.materialize(adapter.materialize(restored, contract), version);
    List<String> issues = ODCSProfiles.validate(version, document);
    return new Result(version, document, issues);
  }

  public static JsonNode nativeDocument(DataContract contract, List<ODCSQualityRule> rules) {
    return ODCSProfiles.adapter(DEFAULT_VERSION).write(contract, rules);
  }

  /** The compatibility reader uses v3.1; its baseline must precede target entity resolution. */
  public static JsonNode importBaseline(DataContract contract, String sourceObject) {
    return new ODCSV31Mapper().write(contract, List.of(), sourceObject);
  }

  public static JsonNode document(
      DataContract contract, List<ODCSQualityRule> rules, Set<String> managedNames) {
    return ODCSMetadataOverlay.apply(contract, nativeDocument(contract, rules), managedNames);
  }
}
