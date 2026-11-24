/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.openlineage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class OpenLineageNamespaceMappingTest {

  @Test
  void exactKeyWinsOverAPrefixKey() {
    OpenLineageNamespaceMapping mapping =
        new OpenLineageNamespaceMapping(
            Map.of("postgres://host:5432", "exact_svc", "postgres://host", "prefix_svc"));

    assertEquals(Optional.of("exact_svc"), mapping.serviceFor("postgres://host:5432"));
  }

  @Test
  void longestPrefixWinsWhateverTheInsertionOrder() {
    Map<String, String> shortFirst = new LinkedHashMap<>();
    shortFirst.put("postgres://host", "broad_svc");
    shortFirst.put("postgres://host:5432", "narrow_svc");
    Map<String, String> longFirst = new LinkedHashMap<>();
    longFirst.put("postgres://host:5432", "narrow_svc");
    longFirst.put("postgres://host", "broad_svc");

    String namespace = "postgres://host:5432/analytics";

    assertEquals(
        Optional.of("narrow_svc"),
        new OpenLineageNamespaceMapping(shortFirst).serviceFor(namespace));
    assertEquals(
        Optional.of("narrow_svc"),
        new OpenLineageNamespaceMapping(longFirst).serviceFor(namespace));
  }

  @Test
  void keyLongerThanTheNamespaceDoesNotMatch() {
    OpenLineageNamespaceMapping mapping =
        new OpenLineageNamespaceMapping(Map.of("postgres://host:5432/analytics", "analytics_svc"));

    assertTrue(mapping.serviceFor("postgres://host:5432").isEmpty());
  }

  @Test
  void unmatchedNullOrEmptyNamespaceHasNoService() {
    OpenLineageNamespaceMapping mapping =
        new OpenLineageNamespaceMapping(Map.of("postgres://host", "pg_svc"));

    assertTrue(mapping.serviceFor("mysql://host:3306").isEmpty());
    assertTrue(mapping.serviceFor(null).isEmpty());
    assertTrue(mapping.serviceFor("").isEmpty());
  }

  @Test
  void blankKeysAndServicesAreIgnored() {
    Map<String, String> entries = new HashMap<>();
    entries.put("", "catch_all_svc");
    entries.put("postgres://host", "");

    OpenLineageNamespaceMapping mapping = new OpenLineageNamespaceMapping(entries);

    assertTrue(mapping.isEmpty());
    assertTrue(mapping.serviceFor("postgres://host:5432").isEmpty());
  }

  @Test
  void missingMappingIsEmpty() {
    OpenLineageNamespaceMapping mapping = new OpenLineageNamespaceMapping(null);

    assertTrue(mapping.isEmpty());
    assertTrue(mapping.serviceFor("postgres://host").isEmpty());
  }
}
