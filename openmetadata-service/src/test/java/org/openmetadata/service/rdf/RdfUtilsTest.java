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
package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class RdfUtilsTest {

  @ParameterizedTest
  @CsvSource({
    "table,prov:Entity",
    "TABLE,prov:Entity",
    "dashboard,prov:Entity",
    "topic,prov:Entity",
    "glossaryTerm,prov:Entity",
    "dataProduct,prov:Entity",
    "domain,prov:Entity",
    "pipeline,prov:Activity",
    "ingestionPipeline,prov:Activity",
    "storedProcedure,prov:Activity",
    "dbtPipeline,prov:Activity",
    "user,prov:Agent",
    "team,prov:Agent",
    "bot,prov:Agent",
    "role,prov:Agent"
  })
  void getProvTypeMapsKnownEntities(String entityType, String expectedProv) {
    assertEquals(expectedProv, RdfUtils.getProvType(entityType));
  }

  @ParameterizedTest
  @CsvSource({"databaseService", "policy", "classification", "tagCategory"})
  void getProvTypeReturnsNullForNonProvEntities(String entityType) {
    assertNull(RdfUtils.getProvType(entityType));
  }

  @org.junit.jupiter.api.Test
  void getProvTypeHandlesNullAndEmpty() {
    assertNull(RdfUtils.getProvType(null));
    assertNull(RdfUtils.getProvType(""));
  }
}
