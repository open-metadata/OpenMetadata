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
package org.openmetadata.service.rdf.storage;

import java.net.http.HttpHeaders;

/** Server-advertised guarantees checked before using a dataset for indexing. */
record FusekiWriteCapabilities(long timeoutMillis, long maxBytes) {
  static final String DEADLINE = "X-OpenMetadata-Write-Timeout-Ms";
  static final String LIMIT = "X-OpenMetadata-Max-Upload-Bytes";
  static final String UNION = "X-OpenMetadata-Union-Default-Graph";
  static final String QUERY = "X-OpenMetadata-Query-Timeout-Ms";
  static final String UPDATE = "X-OpenMetadata-Update-Timeout-Ms";

  static FusekiWriteCapabilities require(final HttpHeaders headers) {
    if (!Boolean.parseBoolean(headers.firstValue(UNION).orElse("false"))) {
      throw new IllegalStateException(
          "Fuseki dataset requires the OpenMetadata Graph Store extension and unionDefaultGraph=true");
    }
    positive(headers, QUERY);
    positive(headers, UPDATE);
    return new FusekiWriteCapabilities(positive(headers, DEADLINE), positive(headers, LIMIT));
  }

  private static long positive(final HttpHeaders headers, final String name) {
    final String value = headers.firstValue(name).orElse("0");
    try {
      final long parsed = Long.parseLong(value);
      if (parsed > 0) {
        return parsed;
      }
    } catch (NumberFormatException exception) {
      throw new IllegalStateException("Invalid Fuseki capability " + name, exception);
    }
    throw new IllegalStateException("Fuseki dataset is missing a positive " + name + " setting");
  }
}
