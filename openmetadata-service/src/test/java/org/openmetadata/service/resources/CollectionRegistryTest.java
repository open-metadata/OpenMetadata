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

package org.openmetadata.service.resources;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;

class CollectionRegistryTest {
  private static final List<String> HIGH_ORDER_ONTOLOGY_COLLECTIONS =
      List.of(
          "/v1/ontology/subsets",
          "/v1/ontology/structure",
          "/v1/ontology/bulk",
          "/v1/ontology/reasoning");

  @Test
  void registersCollectionsAboveTheLegacyOrderCeiling() {
    final CollectionRegistry registry = CollectionRegistry.getInstance();

    HIGH_ORDER_ONTOLOGY_COLLECTIONS.forEach(
        path -> assertTrue(registry.hasCollection(path), () -> "Missing collection " + path));
  }
}
