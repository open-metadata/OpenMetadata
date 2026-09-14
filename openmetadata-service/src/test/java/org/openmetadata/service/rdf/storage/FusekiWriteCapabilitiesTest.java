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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.net.http.HttpHeaders;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class FusekiWriteCapabilitiesTest {
  @Test
  void validatesEveryDatasetGuaranteeInsteadOfAcceptingGenericAdminDefaults() {
    final Map<String, List<String>> configured =
        Map.of(
            FusekiWriteCapabilities.DEADLINE, List.of("50000"),
            FusekiWriteCapabilities.LIMIT, List.of("67108864"),
            FusekiWriteCapabilities.UNION, List.of("true"),
            FusekiWriteCapabilities.QUERY, List.of("50000"),
            FusekiWriteCapabilities.UPDATE, List.of("50000"));
    assertEquals(new FusekiWriteCapabilities(50000, 67108864), parse(configured));
    for (String field : configured.keySet()) {
      final Map<String, List<String>> missing = new HashMap<>(configured);
      missing.remove(field);
      assertThrows(IllegalStateException.class, () -> parse(missing), field);
      missing.put(field, List.of("invalid"));
      assertThrows(IllegalStateException.class, () -> parse(missing), field);
    }
  }

  private static FusekiWriteCapabilities parse(final Map<String, List<String>> headers) {
    return FusekiWriteCapabilities.require(HttpHeaders.of(headers, (name, value) -> true));
  }
}
