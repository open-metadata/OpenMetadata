/*
 *  Copyright 2026 Collate.
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

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.type.ApiStatus;

class EntityRepositoryBulkOperationStatusTest {

  static Stream<Arguments> statusScenarios() {
    return Stream.of(
        Arguments.of(0, 0, ApiStatus.SUCCESS, "nothing processed is success"),
        Arguments.of(1, 1, ApiStatus.SUCCESS, "the only row passing is success"),
        Arguments.of(5, 5, ApiStatus.SUCCESS, "every row passing is success"),
        Arguments.of(0, 1, ApiStatus.FAILURE, "single row that fails is failure"),
        Arguments.of(0, 4, ApiStatus.FAILURE, "every row failing is failure"),
        Arguments.of(1, 5, ApiStatus.PARTIAL_SUCCESS, "one pass rest fail is partial"),
        Arguments.of(1, 2, ApiStatus.PARTIAL_SUCCESS, "one pass one fail is partial"),
        Arguments.of(2, 4, ApiStatus.PARTIAL_SUCCESS, "some pass some fail is partial"),
        Arguments.of(4, 5, ApiStatus.PARTIAL_SUCCESS, "one fail rest pass is partial"));
  }

  @ParameterizedTest(name = "{3}: passed={0}, processed={1} -> {2}")
  @MethodSource("statusScenarios")
  void deriveBulkOperationStatus_classifiesPassFailCounts(
      int numberOfRowsPassed, int numberOfRowsProcessed, ApiStatus expected, String name) {
    assertEquals(
        expected,
        EntityRepository.deriveBulkOperationStatus(numberOfRowsPassed, numberOfRowsProcessed),
        name);
  }
}
