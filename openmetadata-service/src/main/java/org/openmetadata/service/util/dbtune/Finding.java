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
package org.openmetadata.service.util.dbtune;

import java.util.Map;

/**
 * One row of a diagnostic finding. {@code attributes} keys must match {@link
 * DiagnosticCategory#columns()} for the same {@code category} so the renderer can lay them out
 * predictably.
 */
public record Finding(
    DiagnosticCategory category, Severity severity, Map<String, String> attributes) {

  public Finding {
    attributes = attributes == null ? Map.of() : Map.copyOf(attributes);
  }
}
