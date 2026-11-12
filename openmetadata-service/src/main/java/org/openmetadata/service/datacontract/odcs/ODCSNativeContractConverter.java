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
import java.util.Optional;

/** Projects validated profiles into the shared reader while retaining the canonical source metadata. */
final class ODCSNativeContractConverter {
  private ODCSNativeContractConverter() {}

  static Optional<ODCSImportService.Document> convert(
      ObjectMapper mapper, ODCSVersionAdapter adapter, JsonNode source, ODCSImportIssues issues) {
    JsonNode canonical = adapter.read(source);
    JsonNode reader = ODCSImportQuality.readerView(canonical, issues);
    return ODCSLenientReader.read(mapper, reader, issues)
        .map(contract -> new ODCSImportService.Document(contract, canonical, adapter.version()));
  }
}
