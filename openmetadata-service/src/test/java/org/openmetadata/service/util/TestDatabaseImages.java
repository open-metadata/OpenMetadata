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

import java.util.Locale;

/**
 * The MySQL and Postgres images of the metadata store, OpenMetadata's own database. Server,
 * migration and integration tests run the images OpenMetadata ships; {@code
 * STORE_DATABASE_VERSION=oldest} runs MySQL on the oldest version an operator may run the store on,
 * as the nightly run does. Databases that connector tests read as a source keep their own
 * versions. Bump these by hand; {@code TestDatabaseImageGuardTest} lists every other line that
 * must change with them. The {@code MYSQL_IMAGE} and {@code
 * POSTGRES_IMAGE} environment variables replace the image for a one-off run.
 *
 * <p>ADR:2026-11-19-test-database-images-have-a-store-and-a-source-version
 */
public final class TestDatabaseImages {
  public static final String MYSQL = "mysql:8.4.13";
  public static final String POSTGRES = "postgres:15";

  /**
   * The oldest MySQL an operator may run the metadata store on, such as Amazon RDS for MySQL 8.0.
   * The Postgres we ship is already the oldest supported release line, so it has no such constant.
   */
  public static final String MYSQL_OLDEST_SUPPORTED = "mysql:8.0.46";

  static final String SHIPPED = "shipped";
  static final String OLDEST = "oldest";

  private static final String MYSQL_IMAGE_ENV = "MYSQL_IMAGE";
  private static final String POSTGRES_IMAGE_ENV = "POSTGRES_IMAGE";
  private static final String STORE_VERSION_ENV = "STORE_DATABASE_VERSION";

  private TestDatabaseImages() {}

  public static String mysql() {
    return resolve(System.getenv(MYSQL_IMAGE_ENV), mysqlFor(System.getenv(STORE_VERSION_ENV)));
  }

  public static String postgres() {
    return resolve(System.getenv(POSTGRES_IMAGE_ENV), POSTGRES);
  }

  static String mysqlFor(final String version) {
    return OLDEST.equals(selectedVersion(version)) ? MYSQL_OLDEST_SUPPORTED : MYSQL;
  }

  static String selectedVersion(final String version) {
    final String selected =
        version == null || version.isBlank() ? SHIPPED : version.trim().toLowerCase(Locale.ROOT);
    if (!SHIPPED.equals(selected) && !OLDEST.equals(selected)) {
      throw new IllegalStateException(
          STORE_VERSION_ENV + " must be 'shipped' or 'oldest', not '" + version + "'");
    }
    return selected;
  }

  static String resolve(final String override, final String image) {
    return override == null || override.isBlank() ? image : override.trim();
  }
}
