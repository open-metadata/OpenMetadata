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
    ODCSProfile profile;
    try {
      profile = ODCSProfiles.resolve(source);
    } catch (IllegalArgumentException exception) {
      issues.blocking(
          ODCSImportIssueCategory.DOCUMENT, "apiVersion", "apiVersion", exception.getMessage());
      return Optional.empty();
    }
    try {
      return readProfile(mapper, source, profile, issues);
    } catch (IllegalArgumentException exception) {
      issues.blocking(ODCSImportIssueCategory.SCHEMA, null, "schema", exception.getMessage());
      return Optional.empty();
    }
  }

  private record Prepared(JsonNode canonical, List<Error> failures) {}

  private static Optional<Document> readProfile(
      ObjectMapper mapper, JsonNode source, ODCSProfile profile, ODCSImportIssues issues) {
    Prepared prepared = prepare(source, profile, issues);
    reportFailures(profile, prepared.failures(), issues);
    return prepared.failures().isEmpty()
        ? ODCSNativeContractConverter.convert(mapper, profile, prepared.canonical(), issues)
        : Optional.empty();
  }

  private static Prepared prepare(JsonNode source, ODCSProfile profile, ODCSImportIssues issues) {
    List<Error> failures = ODCSPublishedSchemaValidator.validate(profile, source);
    if (failures.isEmpty()) {
      return new Prepared(source, failures);
    }
    ODCSNormalizationResult normalized = profile.adapter().normalizeLegacy(source);
    if (!source.equals(normalized.wire())) {
      issues.info(
          ODCSImportIssueCategory.DOCUMENT,
          null,
          "",
          "Normalized legacy OpenMetadata field shapes before validating the declared ODCS profile.");
    }
    return new Prepared(
        normalized.canonical(), ODCSPublishedSchemaValidator.validate(profile, normalized.wire()));
  }

  private static void reportFailures(
      ODCSProfile profile, List<Error> failures, ODCSImportIssues issues) {
    failures.forEach(
        failure ->
            issues.blocking(
                ODCSImportIssueCategory.DOCUMENT,
                failure.getProperty(),
                failure.getInstanceLocation().toString(),
                "Invalid ODCS " + profile.version() + ": " + failure));
  }
}
