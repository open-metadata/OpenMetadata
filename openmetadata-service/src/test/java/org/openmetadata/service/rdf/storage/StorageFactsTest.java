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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

/**
 * The storage report as OpenMetadata's Fuseki images (docker/rdf-store and open-metadata/jena)
 * write it, read into the volume's facts.
 */
class StorageFactsTest {
  private static final String REPORT =
      """
      {
        "totalBytes" : 629145600 ,
        "usableBytes" : 41140224 ,
        "reserveBytes" : 62914560 ,
        "lowOnSpace" : true
      }
      """;

  @Test
  void readsTheVolumeFromTheImagesReport() {
    final StorageFacts facts = JenaFusekiStorage.parseStorageFacts(REPORT);

    assertEquals(629145600L, facts.totalBytes());
    assertEquals(41140224L, facts.usableBytes());
    assertTrue(facts.lowOnSpace());
    assertEquals(6, facts.freePercent());
  }

  @Test
  void anEmptyVolumeReportCountsAsFree() {
    final StorageFacts facts = new StorageFacts(0, 0, false);

    assertEquals(100, facts.freePercent());
    assertFalse(facts.lowOnSpace());
  }
}
