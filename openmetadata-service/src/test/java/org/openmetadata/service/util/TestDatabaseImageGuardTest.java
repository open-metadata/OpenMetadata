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
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

/**
 * Keeps the shipped database Dockerfiles the only place a MySQL or Postgres image is named.
 *
 * <p>ADR:2026-11-19-test-database-images-come-from-the-shipped-image
 */
class TestDatabaseImageGuardTest {
  private static final String MYSQL_DOCKERFILE = "docker/mysql/Dockerfile_mysql";
  private static final String POSTGRES_DOCKERFILE = "docker/postgresql/Dockerfile_postgres";

  /** A tag has a one- or two-digit major version, which keeps out ports such as 3306 and 5432. */
  private static final Pattern IMAGE_TAG =
      Pattern.compile("\\b(?:mysql|postgres):\\d{1,2}(?!\\d)|mysql/mysql-server");

  /** Dockerfiles cannot read another file, so their client stage is a copy Dependabot bumps. */
  private static final Set<String> CLIENT_STAGE_DOCKERFILES =
      Set.of("ingestion/Dockerfile", "ingestion/Dockerfile.ci");

  private static final Pattern CLIENT_STAGE =
      Pattern.compile("^FROM\\s+(\\S+)\\s+AS\\s+mysql\\s*$", Pattern.CASE_INSENSITIVE);

  private static final Set<String> ALLOWED_FILES =
      Set.of(
          MYSQL_DOCKERFILE,
          POSTGRES_DOCKERFILE,
          // Applied migrations are append-only; this one cites the image a measurement ran on.
          "bootstrap/sql/migrations/native/2.0.0/postgres/schemaChanges.sql",
          "openmetadata-service/src/test/java/org/openmetadata/service/util/"
              + "TestDatabaseImageGuardTest.java");

  /** Recorded outputs of past runs, which name the image each run used. */
  private static final List<String> ALLOWED_DIRECTORIES = List.of("docs/artifacts/");

  private static final Set<String> PRUNED_DIRECTORIES =
      Set.of(
          ".git",
          "node_modules",
          "target",
          "build",
          "dist",
          "env",
          "venv",
          ".venv",
          ".nox",
          "__pycache__",
          ".idea",
          ".vscode",
          ".mypy_cache",
          ".pytest_cache",
          ".ruff_cache");

  /** Prose may name a version; it starts no container. */
  private static final Set<String> SKIPPED_EXTENSIONS =
      Set.of(
          ".md", ".mdx", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".woff",
          ".woff2", ".ttf", ".eot", ".jar", ".class", ".zip", ".gz", ".tgz", ".pdf", ".mp4");

  private static final long MAX_SCANNED_BYTES = 5L * 1024 * 1024;

  private static final Path REPOSITORY_ROOT = repositoryRoot();

  @Test
  void onlyTheShippedDockerfilesNameADatabaseImage() throws IOException {
    final List<String> strays = new ArrayList<>();
    Files.walkFileTree(REPOSITORY_ROOT, new StrayTagCollector(strays));
    assertTrue(
        strays.isEmpty(),
        "MySQL and Postgres images come from "
            + MYSQL_DOCKERFILE
            + " and "
            + POSTGRES_DOCKERFILE
            + ": use TestDatabaseImages in Java, mysql_image() or postgres_image() from"
            + " ingestion/tests/integration/containers.py in Python, and build from or read the"
            + " FROM line in Compose files and scripts. Found:\n"
            + String.join("\n", strays));
  }

  @Test
  void dockerfileClientStagesMatchTheShippedMysqlImage() throws IOException {
    final String shipped = shippedImage(MYSQL_DOCKERFILE);
    for (final String dockerfile : CLIENT_STAGE_DOCKERFILES) {
      final List<String> stages =
          Files.readAllLines(REPOSITORY_ROOT.resolve(dockerfile)).stream()
              .map(String::trim)
              .map(CLIENT_STAGE::matcher)
              .filter(Matcher::matches)
              .map(matcher -> matcher.group(1))
              .toList();
      assertEquals(List.of(shipped), stages, dockerfile + " mysql client stage");
    }
  }

  @Test
  void testJarCarriesTheShippedImages() throws IOException {
    assertEquals(
        shippedImage(MYSQL_DOCKERFILE),
        TestDatabaseImages.fromResource(TestDatabaseImages.MYSQL_DOCKERFILE));
    assertEquals(
        shippedImage(POSTGRES_DOCKERFILE),
        TestDatabaseImages.fromResource(TestDatabaseImages.POSTGRES_DOCKERFILE));
  }

  private static String shippedImage(final String relativePath) throws IOException {
    return TestDatabaseImages.baseImage(
        Files.readString(REPOSITORY_ROOT.resolve(relativePath)), relativePath);
  }

  private static Path repositoryRoot() {
    Path current = Path.of("").toAbsolutePath();
    while (current != null && !Files.exists(current.resolve(MYSQL_DOCKERFILE))) {
      current = current.getParent();
    }
    if (current == null) {
      throw new IllegalStateException("Unable to locate the OpenMetadata repository root");
    }
    return current;
  }

  private static final class StrayTagCollector extends SimpleFileVisitor<Path> {
    private final List<String> strays;

    private StrayTagCollector(final List<String> strays) {
      this.strays = strays;
    }

    @Override
    public FileVisitResult preVisitDirectory(final Path dir, final BasicFileAttributes attrs) {
      final Path name = dir.getFileName();
      return name != null && PRUNED_DIRECTORIES.contains(name.toString())
          ? FileVisitResult.SKIP_SUBTREE
          : FileVisitResult.CONTINUE;
    }

    @Override
    public FileVisitResult visitFile(final Path file, final BasicFileAttributes attrs) {
      final String relative = REPOSITORY_ROOT.relativize(file).toString().replace('\\', '/');
      if (attrs.isRegularFile() && attrs.size() <= MAX_SCANNED_BYTES && isScanned(relative)) {
        collect(relative, file);
      }
      return FileVisitResult.CONTINUE;
    }

    private void collect(final String relative, final Path file) {
      final boolean clientStageFile = CLIENT_STAGE_DOCKERFILES.contains(relative);
      final List<String> lines = readLines(file);
      for (int index = 0; index < lines.size(); index++) {
        final String line = lines.get(index);
        final boolean checkedClientStage =
            clientStageFile && CLIENT_STAGE.matcher(line.trim()).matches();
        if (!checkedClientStage && IMAGE_TAG.matcher(line).find()) {
          strays.add(relative + ":" + (index + 1) + ": " + line.trim());
        }
      }
    }

    private static boolean isScanned(final String relative) {
      final String lower = relative.toLowerCase(Locale.ROOT);
      final int dot = lower.lastIndexOf('.');
      final boolean skippedExtension =
          dot > lower.lastIndexOf('/') && SKIPPED_EXTENSIONS.contains(lower.substring(dot));
      return !skippedExtension
          && !ALLOWED_FILES.contains(relative)
          && ALLOWED_DIRECTORIES.stream().noneMatch(relative::startsWith);
    }

    private static List<String> readLines(final Path file) {
      try {
        return new String(Files.readAllBytes(file), StandardCharsets.ISO_8859_1).lines().toList();
      } catch (IOException e) {
        throw new UncheckedIOException(e);
      }
    }
  }
}
