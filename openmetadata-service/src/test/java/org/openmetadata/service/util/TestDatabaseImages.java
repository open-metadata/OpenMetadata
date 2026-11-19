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

/**
 * The MySQL and Postgres images every test container runs, the same images OpenMetadata ships.
 * Bump them here by hand; {@code TestDatabaseImageGuardTest} lists every other line in the
 * repository that must change with them. The {@code MYSQL_IMAGE} and {@code POSTGRES_IMAGE}
 * environment variables replace them for a one-off run.
 *
 * <p>ADR:2026-11-19-test-database-images-are-one-constant
 */
public final class TestDatabaseImages {
  public static final String MYSQL = "mysql:8.4.13";
  public static final String POSTGRES = "postgres:15";

  private static final String MYSQL_IMAGE_ENV = "MYSQL_IMAGE";
  private static final String POSTGRES_IMAGE_ENV = "POSTGRES_IMAGE";

  private TestDatabaseImages() {}

  public static String mysql() {
    return resolve(System.getenv(MYSQL_IMAGE_ENV), MYSQL);
  }

  public static String postgres() {
    return resolve(System.getenv(POSTGRES_IMAGE_ENV), POSTGRES);
  }

  static String resolve(final String override, final String image) {
    return override == null || override.isBlank() ? image : override.trim();
  }
}
