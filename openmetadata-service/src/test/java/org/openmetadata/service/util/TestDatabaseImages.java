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

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * The MySQL and Postgres images every test container runs: the base images of the database
 * Dockerfiles OpenMetadata ships, {@code docker/mysql/Dockerfile_mysql} and {@code
 * docker/postgresql/Dockerfile_postgres}. The build copies both files into this module's test jar
 * under {@value #RESOURCE_DIRECTORY}, so any module depending on the test jar reads the same
 * images. The {@value #MYSQL_IMAGE_ENV} and {@value #POSTGRES_IMAGE_ENV} environment variables
 * replace them for a one-off run.
 *
 * <p>ADR:2026-11-19-test-database-images-come-from-the-shipped-image
 */
public final class TestDatabaseImages {
  public static final String MYSQL_IMAGE_ENV = "MYSQL_IMAGE";
  public static final String POSTGRES_IMAGE_ENV = "POSTGRES_IMAGE";
  public static final String RESOURCE_DIRECTORY = "test-database-images";
  public static final String MYSQL_DOCKERFILE = RESOURCE_DIRECTORY + "/Dockerfile_mysql";
  public static final String POSTGRES_DOCKERFILE = RESOURCE_DIRECTORY + "/Dockerfile_postgres";

  private TestDatabaseImages() {}

  public static String mysql() {
    return resolve(System.getenv(MYSQL_IMAGE_ENV), MYSQL_DOCKERFILE);
  }

  public static String postgres() {
    return resolve(System.getenv(POSTGRES_IMAGE_ENV), POSTGRES_DOCKERFILE);
  }

  static String resolve(final String override, final String resource) {
    return override == null || override.isBlank() ? fromResource(resource) : override.trim();
  }

  static String fromResource(final String resource) {
    try (InputStream stream =
        TestDatabaseImages.class.getClassLoader().getResourceAsStream(resource)) {
      if (stream == null) {
        throw new IllegalStateException(
            "Test database image source "
                + resource
                + " is not on the test classpath. openmetadata-service copies it from the"
                + " shipped Dockerfile under docker/ at build time; rebuild that module.");
      }
      return baseImage(new String(stream.readAllBytes(), StandardCharsets.UTF_8), resource);
    } catch (IOException e) {
      throw new UncheckedIOException("Cannot read test database image source " + resource, e);
    }
  }

  /**
   * The image named by the Dockerfile's only {@code FROM} instruction, without any {@code
   * --platform} flag or {@code AS} stage name.
   */
  public static String baseImage(final String dockerfile, final String source) {
    final List<String> fromLines =
        dockerfile
            .lines()
            .map(String::trim)
            .filter(line -> line.toUpperCase(Locale.ROOT).startsWith("FROM "))
            .toList();
    if (fromLines.size() != 1) {
      throw new IllegalStateException(
          source
              + " must have exactly one FROM line to name a test database image, found "
              + fromLines.size());
    }
    return Arrays.stream(fromLines.getFirst().split("\\s+"))
        .skip(1)
        .filter(token -> !token.startsWith("--"))
        .findFirst()
        .orElseThrow(() -> new IllegalStateException(source + " has a FROM line with no image"));
  }
}
