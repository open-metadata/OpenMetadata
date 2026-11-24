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

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportIssue;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportIssueCategory;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportIssueSeverity;

/**
 * Collects what an ODCS import keeps, changes and leaves out. The same finding in many places, e.g.
 * {@code businessName} on every property, is kept once with a count, so a large contract yields a
 * readable report rather than hundreds of lines.
 */
public final class ODCSImportIssues {

  /** Collector for callers that do not report anything, such as a plain import. */
  public static ODCSImportIssues discarding() {
    return new ODCSImportIssues();
  }

  private record Key(
      ODCSImportIssueSeverity severity,
      ODCSImportIssueCategory category,
      String field,
      String message) {}

  private final Map<Key, ODCSImportIssue> issues = new LinkedHashMap<>();

  public void blocking(
      ODCSImportIssueCategory category, String field, String path, String message) {
    add(ODCSImportIssueSeverity.BLOCKING, category, field, path, message);
  }

  public void warning(ODCSImportIssueCategory category, String field, String path, String message) {
    add(ODCSImportIssueSeverity.WARNING, category, field, path, message);
  }

  public void info(ODCSImportIssueCategory category, String field, String path, String message) {
    add(ODCSImportIssueSeverity.INFO, category, field, path, message);
  }

  public boolean hasBlocking() {
    return issues.keySet().stream()
        .anyMatch(key -> key.severity() == ODCSImportIssueSeverity.BLOCKING);
  }

  /** Blocking issues first, then warnings, then information, each in the order found. */
  public List<ODCSImportIssue> toList() {
    List<ODCSImportIssue> ordered = new ArrayList<>();
    for (ODCSImportIssueSeverity severity : ODCSImportIssueSeverity.values()) {
      issues.values().stream()
          .filter(issue -> issue.getSeverity() == severity)
          .forEach(ordered::add);
    }
    return List.copyOf(ordered);
  }

  private void add(
      ODCSImportIssueSeverity severity,
      ODCSImportIssueCategory category,
      String field,
      String path,
      String message) {
    Key key = new Key(severity, category, field, message);
    ODCSImportIssue existing = issues.get(key);
    if (existing == null) {
      issues.put(
          key,
          new ODCSImportIssue()
              .withSeverity(severity)
              .withCategory(category)
              .withField(field)
              .withPath(path)
              .withOccurrences(1)
              .withMessage(message));
    } else {
      existing.setOccurrences(existing.getOccurrences() + 1);
    }
  }
}
