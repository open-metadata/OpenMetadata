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
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class TestDatabaseImagesTest {
  @Test
  void shippedImagesAreTheDatabaseImages() {
    assertTrue(
        TestDatabaseImages.fromResource(TestDatabaseImages.MYSQL_DOCKERFILE).startsWith("mysql:"));
    assertTrue(
        TestDatabaseImages.fromResource(TestDatabaseImages.POSTGRES_DOCKERFILE)
            .startsWith("postgres:"));
  }

  @Test
  void baseImageIsTheOnlyFromLineWithoutFlagsOrStageName() {
    assertEquals(
        "example/db:1.2.3",
        TestDatabaseImages.baseImage(
            "# comment\nfrom --platform=linux/amd64 example/db:1.2.3 AS db\nRUN true\n", "probe"));
    assertEquals(
        "example/db:1", TestDatabaseImages.baseImage("  FROM example/db:1\nWORKDIR /x", "probe"));
  }

  @Test
  void dockerfileWithoutFromLineFailsNamingTheSource() {
    IllegalStateException failure =
        assertThrows(
            IllegalStateException.class,
            () -> TestDatabaseImages.baseImage("WORKDIR /x\n", "Dockerfile_probe"));
    assertTrue(failure.getMessage().contains("Dockerfile_probe"), failure.getMessage());
    assertTrue(failure.getMessage().contains("found 0"), failure.getMessage());
  }

  @Test
  void dockerfileWithSeveralFromLinesFails() {
    IllegalStateException failure =
        assertThrows(
            IllegalStateException.class,
            () ->
                TestDatabaseImages.baseImage(
                    "FROM example/db:1 AS a\nFROM example/db:2\n", "Dockerfile_probe"));
    assertTrue(failure.getMessage().contains("found 2"), failure.getMessage());
  }

  @Test
  void missingResourceFailsNamingIt() {
    IllegalStateException failure =
        assertThrows(
            IllegalStateException.class,
            () -> TestDatabaseImages.fromResource("test-database-images/Dockerfile_absent"));
    assertTrue(failure.getMessage().contains("Dockerfile_absent"), failure.getMessage());
  }

  @Test
  void overrideReplacesTheShippedImageUnlessBlank() {
    assertEquals(
        "example/db:9",
        TestDatabaseImages.resolve(" example/db:9 ", TestDatabaseImages.MYSQL_DOCKERFILE));
    assertEquals(
        TestDatabaseImages.fromResource(TestDatabaseImages.MYSQL_DOCKERFILE),
        TestDatabaseImages.resolve(" ", TestDatabaseImages.MYSQL_DOCKERFILE));
    assertEquals(
        TestDatabaseImages.fromResource(TestDatabaseImages.POSTGRES_DOCKERFILE),
        TestDatabaseImages.resolve(null, TestDatabaseImages.POSTGRES_DOCKERFILE));
  }
}
