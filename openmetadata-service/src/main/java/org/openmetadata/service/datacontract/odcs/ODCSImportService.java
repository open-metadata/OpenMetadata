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
    String version;
    try {
      version = declaredVersion(source);
      ODCSProfiles.adapter(version);
    } catch (IllegalArgumentException exception) {
      issues.blocking(
          ODCSImportIssueCategory.DOCUMENT, "apiVersion", "apiVersion", exception.getMessage());
      return Optional.empty();
    }
    try {
      return readProfile(mapper, source, version, issues);
    } catch (IllegalArgumentException exception) {
      issues.blocking(ODCSImportIssueCategory.SCHEMA, null, "schema", exception.getMessage());
      return Optional.empty();
    }
  }

  private static Optional<Document> readProfile(
      ObjectMapper mapper, JsonNode source, String version, ODCSImportIssues issues) {
    ODCSVersionAdapter adapter = ODCSProfiles.adapter(version);
    ODCSImportCompatibility.Normalized normalized =
        ODCSImportCompatibility.normalize(source, adapter, issues);
    List<Error> failures = ODCSProfiles.validationErrors(version, normalized.wire());
    if (!failures.isEmpty()) {
      failures.forEach(
          failure ->
              issues.blocking(
                  ODCSImportIssueCategory.DOCUMENT,
                  failure.getProperty(),
                  failure.getInstanceLocation().toString(),
                  "Invalid ODCS " + version + ": " + failure));
      return Optional.empty();
    }
    JsonNode canonical = adapter.read(normalized.canonical());
    return ODCSLenientReader.read(mapper, ODCSImportQuality.readerView(canonical, issues), issues)
        .map(contract -> new Document(contract, canonical, version));
  }

  private static String declaredVersion(JsonNode source) {
    if (source == null || !source.isObject())
      throw new IllegalArgumentException("An ODCS document must be an object.");
    JsonNode version = source.get("apiVersion");
    if (version == null || version.isNull())
      throw new IllegalArgumentException("Missing required ODCS apiVersion.");
    if (!version.isTextual() || !version.asText().matches("v[0-9]+\\.[0-9]+\\.[0-9]+"))
      throw new IllegalArgumentException(
          "Malformed ODCS apiVersion; expected v<major>.<minor>.<patch>.");
    return version.asText();
  }
}
