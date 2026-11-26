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
 * Every MySQL and Postgres image tag outside the connector source roots and the SDK examples must
 * equal a metadata store constant in {@link TestDatabaseImages}: the images we ship, or the oldest
 * MySQL an operator may run the store on.
 *
 * <p>ADR:2026-11-19-test-database-images-have-a-store-and-a-source-version
 */
class TestDatabaseImageGuardTest {
  /**
   * {@code mysql:} or {@code postgres:} followed by a one- or two-digit major version (which keeps
   * out ports such as 3306 and 5432), a floating tag or a digest, and Oracle's legacy MySQL Server
   * image. A digest after a tag is not part of the match, so only the tag is compared. The escaped
   * hyphen keeps this file from matching its own pattern.
   */
  private static final Pattern IMAGE_TAG =
      Pattern.compile(
          "\\b(?:mysql|postgres)(?::(?:\\d{1,2}(?!\\d)|latest|lts|alpine)(?:[.-]\\w+)*|@sha256:\\w+)"
              + "|mysql/mysql\\-server(?::[\\w.-]+)?");

  /** History that must keep the version it recorded, so a bump must not rewrite it. */
  private static final List<String> HISTORY =
      List.of(
          // Applied migrations are append-only; this one cites the image a measurement ran on.
          "bootstrap/sql/migrations/native/2.0.0/postgres/schemaChanges.sql",
          // Recorded outputs of past runs, which name the image each run used.
          "docs/artifacts/");

  /**
   * Connector tests and their shared fixtures start databases our connectors read, so their
   * versions follow what the connectors support, not the store we ship.
   */
  private static final List<String> CONNECTOR_SOURCE_ROOTS =
      List.of("ingestion/tests/", "ingestion/src/_openmetadata_testutils/");

  /**
   * SDK examples are tutorials, not tests: their databases keep data in a volume across runs, and a
   * new major version cannot start on an older one's data.
   */
  private static final List<String> EXAMPLES = List.of("examples/");

  private static final List<String> MYSQL_IMAGES =
      List.of(TestDatabaseImages.MYSQL, TestDatabaseImages.MYSQL_OLDEST_SUPPORTED);
  private static final List<String> POSTGRES_IMAGES = List.of(TestDatabaseImages.POSTGRES);

  /**
   * Java code names no image but this helper: a test that typed even the shipped tag would miss the
   * oldest-version run.
   */
  private static final String HELPER =
      "openmetadata-service/src/test/java/org/openmetadata/service/util/TestDatabaseImages.java";

  private static final Set<String> PRUNED_DIRECTORIES =
      Set.of(
          ".git",
          // Local database data mounted by the development Compose stacks.
          "docker-volume",
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

  /** Prose may name any version; it starts no container. */
  private static final Set<String> SKIPPED_EXTENSIONS =
      Set.of(
          ".md", ".mdx", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".woff",
          ".woff2", ".ttf", ".eot", ".jar", ".class", ".zip", ".gz", ".tgz", ".pdf", ".mp4");

  private static final long MAX_SCANNED_BYTES = 5L * 1024 * 1024;

  private static final Path REPOSITORY_ROOT = repositoryRoot();

  @Test
  void everyMetadataStoreImageTagIsAStoreConstant() throws IOException {
    final List<String> mismatches = new ArrayList<>();
    Files.walkFileTree(REPOSITORY_ROOT, new TagCollector(mismatches));
    assertTrue(
        mismatches.isEmpty(),
        "The metadata store runs the constants in TestDatabaseImages: call"
            + " TestDatabaseImages.mysql() or postgres(). To bump a version, change those"
            + " constants and every line listed here. These lines name a different image:\n"
            + String.join("\n", mismatches));
  }

  private static List<String> allowedImages(final String tag) {
    return tag.startsWith("postgres") ? POSTGRES_IMAGES : MYSQL_IMAGES;
  }

  private static Path repositoryRoot() {
    Path current = Path.of("").toAbsolutePath();
    while (current != null && !isRepositoryRoot(current)) {
      current = current.getParent();
    }
    if (current == null) {
      throw new IllegalStateException("Unable to locate the OpenMetadata repository root");
    }
    return current;
  }

  private static boolean isRepositoryRoot(final Path directory) {
    return Files.isDirectory(directory.resolve("openmetadata-service"))
        && Files.isDirectory(directory.resolve("ingestion"));
  }

  private static final class TagCollector extends SimpleFileVisitor<Path> {
    private final List<String> mismatches;

    private TagCollector(final List<String> mismatches) {
      this.mismatches = mismatches;
    }

    @Override
    public FileVisitResult preVisitDirectory(final Path dir, final BasicFileAttributes attrs) {
      final Path name = dir.getFileName();
      return name != null && PRUNED_DIRECTORIES.contains(name.toString())
          ? FileVisitResult.SKIP_SUBTREE
          : FileVisitResult.CONTINUE;
    }

    /** Local files the user cannot read, such as a database container's data, are not source. */
    @Override
    public FileVisitResult visitFileFailed(final Path file, final IOException failure) {
      return FileVisitResult.CONTINUE;
    }

    @Override
    public FileVisitResult visitFile(final Path file, final BasicFileAttributes attrs) {
      final String relative = REPOSITORY_ROOT.relativize(file).toString().replace('\\', '/');
      if (attrs.isRegularFile() && attrs.size() <= MAX_SCANNED_BYTES && isScanned(relative)) {
        collect(relative, readLines(file));
      }
      return FileVisitResult.CONTINUE;
    }

    private void collect(final String relative, final List<String> lines) {
      final boolean javaCode = relative.endsWith(".java") && !relative.equals(HELPER);
      for (int index = 0; index < lines.size(); index++) {
        final Matcher matcher = IMAGE_TAG.matcher(lines.get(index));
        while (matcher.find()) {
          final String tag = matcher.group();
          final List<String> allowed = allowedImages(tag);
          if (javaCode || !allowed.contains(tag)) {
            mismatches.add(
                relative + ":" + (index + 1) + ": " + tag + " (" + fix(javaCode, allowed) + ")");
          }
        }
      }
    }

    private static String fix(final boolean javaCode, final List<String> allowed) {
      return javaCode
          ? "call TestDatabaseImages.mysql() or postgres()"
          : "expected one of " + allowed;
    }

    private static boolean isScanned(final String relative) {
      final String lower = relative.toLowerCase(Locale.ROOT);
      final int dot = lower.lastIndexOf('.');
      final boolean skippedExtension =
          dot > lower.lastIndexOf('/') && SKIPPED_EXTENSIONS.contains(lower.substring(dot));
      return !skippedExtension
          && HISTORY.stream().noneMatch(relative::startsWith)
          && CONNECTOR_SOURCE_ROOTS.stream().noneMatch(relative::startsWith)
          && EXAMPLES.stream().noneMatch(relative::startsWith);
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
