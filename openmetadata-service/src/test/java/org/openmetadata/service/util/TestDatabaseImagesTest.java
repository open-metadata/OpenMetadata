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
package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class TestDatabaseImagesTest {
  @Test
  void overrideReplacesTheImage() {
    assertEquals(
        "example/db:9", TestDatabaseImages.resolve(" example/db:9 ", TestDatabaseImages.MYSQL));
  }

  @Test
  void blankOrMissingOverrideFallsBackToTheConstant() {
    assertEquals(
        TestDatabaseImages.MYSQL, TestDatabaseImages.resolve(" ", TestDatabaseImages.MYSQL));
    assertEquals(
        TestDatabaseImages.POSTGRES, TestDatabaseImages.resolve(null, TestDatabaseImages.POSTGRES));
  }

  @Test
  void mysqlRunsTheShippedVersionUnlessTheOldestIsSelected() {
    assertEquals(TestDatabaseImages.MYSQL, TestDatabaseImages.mysqlFor(null));
    assertEquals(TestDatabaseImages.MYSQL, TestDatabaseImages.mysqlFor(" shipped "));
    assertEquals(TestDatabaseImages.MYSQL_OLDEST_SUPPORTED, TestDatabaseImages.mysqlFor("Oldest"));
  }

  @Test
  void unknownVersionFailsInsteadOfRunningTheShippedOne() {
    assertThrows(IllegalStateException.class, () -> TestDatabaseImages.mysqlFor("olde"));
  }
}
