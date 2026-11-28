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

package org.openmetadata.service.migration.v212;

import static java.util.stream.Collectors.toSet;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

class DefaultSystemMarksMigrationTest {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final Pattern QUOTED_NAME = Pattern.compile("'([^']+)'");
  private static final String MIGRATION_DIR = "bootstrap/sql/migrations/native/2.1.2";
  private static final String SEED_DIR = "openmetadata-service/src/main/resources/json/data";
  private static final String SYSTEM_PROVIDER = "system";
  // The repair names the defaults seeded with the marks when the bug was fixed. A default seeded
  // later is never stripped, so these lists stay as they are and are not compared to the seeds.
  private static final Set<String> DEFAULT_POLICIES =
      Set.of(
          "ApplicationBotImpersonationPolicy",
          "ApplicationBotPolicy",
          "AutoClassificationBotPolicy",
          "BotImpersonationPolicy",
          "BotNonAdminImpersonationPolicy",
          "DataConsumerPolicy",
          "DataStewardPolicy",
          "DefaultBotPolicy",
          "IngestionBotPolicy",
          "LineageBotPolicy",
          "OntologyAuthorPolicy",
          "OntologyReviewerPolicy",
          "OrganizationPolicy",
          "ProfilerBotPolicy",
          "QualityBotPolicy",
          "ScimBotPolicy",
          "TaskAuthorPolicy",
          "TeamOnlyPolicy",
          "UsageBotPolicy");
  private static final Set<String> DEFAULT_ROLES =
      Set.of(
          "ApplicationBotImpersonationRole",
          "ApplicationBotRole",
          "AutoClassificationBotRole",
          "BotImpersonationRole",
          "BotNonAdminImpersonationRole",
          "DataConsumer",
          "DataQualityBotRole",
          "DataSteward",
          "DefaultBotRole",
          "GovernanceBotRole",
          "IngestionBotRole",
          "LineageBotRole",
          "OntologyAuthor",
          "OntologyReviewer",
          "ProfilerBotRole",
          "QualityBotRole",
          "ScimBotRole",
          "UsageBotRole");

  @ParameterizedTest(name = "{0} restores the marks on the {2} defaults")
  @MethodSource("cases")
  void migrationRestoresTheProtectedDefaults(
      String dialect, String table, String seedFolder, Set<String> defaults) throws IOException {
    String sql =
        Files.readString(
            repositoryRoot()
                .resolve(MIGRATION_DIR)
                .resolve(dialect)
                .resolve("postDataMigrationSQLScript.sql"));

    assertEquals(defaults, migratedNames(sql, table));
    assertTrue(
        protectedSeedNames(seedFolder).containsAll(defaults),
        "every name the migration restores must be a " + seedFolder + " seeded with the marks");
  }

  private static Stream<Arguments> cases() {
    return Stream.of("mysql", "postgres")
        .flatMap(
            dialect ->
                Stream.of(
                    Arguments.of(dialect, "policy_entity", "policy", DEFAULT_POLICIES),
                    Arguments.of(dialect, "role_entity", "role", DEFAULT_ROLES)));
  }

  private static Set<String> migratedNames(String sql, String table) {
    int statementStart = sql.indexOf("UPDATE " + table);
    String statement = sql.substring(statementStart, sql.indexOf(';', statementStart));
    int listStart = statement.indexOf("IN (");
    Matcher names =
        QUOTED_NAME.matcher(statement.substring(listStart, statement.indexOf(')', listStart)));
    return names.results().map(match -> match.group(1)).collect(toSet());
  }

  private static Set<String> protectedSeedNames(String seedFolder) throws IOException {
    try (Stream<Path> seeds = Files.list(repositoryRoot().resolve(SEED_DIR).resolve(seedFolder))) {
      return seeds
          .map(DefaultSystemMarksMigrationTest::readSeed)
          .filter(DefaultSystemMarksMigrationTest::isProtected)
          .map(seed -> seed.get("name").asText())
          .collect(toSet());
    }
  }

  private static boolean isProtected(JsonNode seed) {
    return SYSTEM_PROVIDER.equals(seed.path("provider").asText())
        && !seed.path("allowDelete").asBoolean(true);
  }

  private static JsonNode readSeed(Path seed) {
    try {
      return MAPPER.readTree(seed.toFile());
    } catch (IOException e) {
      throw new UncheckedIOException("Unreadable seed " + seed, e);
    }
  }

  private static Path repositoryRoot() {
    Path current = Path.of("").toAbsolutePath();
    while (current != null && !Files.isDirectory(current.resolve("bootstrap/sql/migrations"))) {
      current = current.getParent();
    }
    if (current == null) {
      throw new IllegalStateException("Unable to locate the OpenMetadata repository root");
    }
    return current;
  }
}
