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
import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.Error;
import java.util.List;
import java.util.Optional;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportIssueCategory;

/** Validates the declared wire profile before projecting it into the native reader. */
public final class ODCSImportService {
  public record Document(ODCSDataContract contract, JsonNode original, String version) {}

  private ODCSImportService() {}

  public static Document readOrReject(ObjectMapper mapper, JsonNode source) {
    ODCSImportIssues issues = new ODCSImportIssues();
    return read(mapper, source, issues)
        .orElseThrow(
            () ->
                new IllegalArgumentException(
                    "Cannot import ODCS: "
                        + issues.toList().stream()
                            .map(issue -> issue.getPath() + ": " + issue.getMessage())
                            .toList()));
  }

  public static Optional<Document> read(
      ObjectMapper mapper, JsonNode source, ODCSImportIssues issues) {
    ODCSVersionAdapter adapter;
    try {
      adapter = ODCSProfiles.resolve(source);
    } catch (IllegalArgumentException exception) {
      issues.blocking(
          ODCSImportIssueCategory.DOCUMENT, "apiVersion", "apiVersion", exception.getMessage());
      return Optional.empty();
    }
    try {
      return readProfile(mapper, source, adapter, issues);
    } catch (IllegalArgumentException exception) {
      issues.blocking(ODCSImportIssueCategory.SCHEMA, null, "schema", exception.getMessage());
      return Optional.empty();
    }
  }

  private record Prepared(JsonNode canonical, List<Error> failures) {}

  private static Optional<Document> readProfile(
      ObjectMapper mapper, JsonNode source, ODCSVersionAdapter adapter, ODCSImportIssues issues) {
    Prepared prepared = prepare(source, adapter, issues);
    reportFailures(adapter, prepared.failures(), issues);
    return prepared.failures().isEmpty()
        ? ODCSNativeContractConverter.convert(mapper, adapter, prepared.canonical(), issues)
        : Optional.empty();
  }

  private static Prepared prepare(
      JsonNode source, ODCSVersionAdapter adapter, ODCSImportIssues issues) {
    List<Error> failures = ODCSProfiles.validationErrors(adapter.version(), source);
    if (failures.isEmpty()) {
      return new Prepared(source, failures);
    }
    ODCSNormalizationResult normalized = adapter.normalizeLegacy(source);
    if (!source.equals(normalized.wire())) {
      issues.info(
          ODCSImportIssueCategory.DOCUMENT,
          null,
          "",
          "Normalized legacy OpenMetadata field shapes before validating the declared ODCS profile.");
    }
    return new Prepared(
        normalized.canonical(),
        ODCSProfiles.validationErrors(adapter.version(), normalized.wire()));
  }

  private static void reportFailures(
      ODCSVersionAdapter adapter, List<Error> failures, ODCSImportIssues issues) {
    failures.forEach(
        failure ->
            issues.blocking(
                ODCSImportIssueCategory.DOCUMENT,
                failure.getProperty(),
                failure.getInstanceLocation().toString(),
                "Invalid ODCS " + adapter.version() + ": " + failure));
  }
}
