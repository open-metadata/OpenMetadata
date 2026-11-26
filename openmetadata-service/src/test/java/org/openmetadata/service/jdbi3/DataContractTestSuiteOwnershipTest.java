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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.tests.TestSuite;

/** A contract owns only the test suite named after its own id. */
class DataContractTestSuiteOwnershipTest {

  private final DataContract contract = new DataContract().withId(UUID.randomUUID());

  @Test
  void theSuiteNamedAfterTheContractIsItsOwn() {
    assertTrue(
        DataContractRepository.isOwnSuite(
            contract, new TestSuite().withName(contract.getId().toString())));
  }

  @Test
  void anotherContractsSuiteOrNoSuiteIsNotItsOwn() {
    assertFalse(
        DataContractRepository.isOwnSuite(
            contract, new TestSuite().withName(UUID.randomUUID().toString())));
    assertFalse(DataContractRepository.isOwnSuite(contract, null));
  }
}
