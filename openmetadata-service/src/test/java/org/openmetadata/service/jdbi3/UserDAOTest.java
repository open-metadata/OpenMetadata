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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlStatements;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AccessControlDAOs.UserDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.util.FullyQualifiedName;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers(disabledWithoutDocker = true)
class UserDAOTest {
  private static final String DATABASE = "user_dao_test";
  private static final String PASSWORD = "user-dao-test";
  private static final String FIRST_DOMAIN = UUID.randomUUID().toString();
  private static final String SECOND_DOMAIN = UUID.randomUUID().toString();
  private static final String TEAM = "engineering";
  private static final int PAGE_SIZE = 2;

  @Container
  static final GenericContainer<?> POSTGRES_CONTAINER =
      new GenericContainer<>(DockerImageName.parse("postgres:15"))
          .withEnv("POSTGRES_DB", DATABASE)
          .withEnv("POSTGRES_PASSWORD", PASSWORD)
          .withExposedPorts(5432)
          .waitingFor(
              Wait.forLogMessage(".*database system is ready to accept connections.*\\n", 2));

  @Container
  static final GenericContainer<?> MYSQL_CONTAINER =
      new GenericContainer<>(DockerImageName.parse("mysql:8.0"))
          .withEnv("MYSQL_DATABASE", DATABASE)
          .withEnv("MYSQL_ROOT_PASSWORD", PASSWORD)
          .withExposedPorts(3306)
          .waitingFor(Wait.forLogMessage(".*ready for connections.*port: 3306.*\\n", 1))
          .withStartupTimeout(Duration.ofMinutes(2));

  @BeforeAll
  static void initializeDatabases() {
    for (final ConnectionType database : ConnectionType.values()) {
      try (Handle handle = openHandle(database)) {
        createTables(handle, database);
        seedUsers(handle);
      }
    }
  }

  @ParameterizedTest
  @MethodSource("domainFilters")
  void countsOnlyVisibleUsers(
      ConnectionType database,
      String domainIds,
      boolean domainAccessControl,
      String team,
      List<String> expectedNames) {
    try (Handle handle = openHandle(database)) {
      final UserDAO dao = handle.attach(UserDAO.class);
      assertEquals(
          expectedNames.size(), dao.listCount(userFilter(domainIds, domainAccessControl, team)));
    }
  }

  @ParameterizedTest
  @MethodSource("domainFilters")
  void paginatesVisibleUsersForward(
      ConnectionType database,
      String domainIds,
      boolean domainAccessControl,
      String team,
      List<String> expectedNames) {
    try (Handle handle = openHandle(database)) {
      final UserDAO dao = handle.attach(UserDAO.class);
      final ListFilter filter = userFilter(domainIds, domainAccessControl, team);
      final List<User> firstPage = users(dao.listAfter(filter, PAGE_SIZE, "", ""));
      final int split = Math.min(PAGE_SIZE, expectedNames.size());
      assertEquals(expectedNames.subList(0, split), names(firstPage));
      final User cursor = firstPage.getLast();
      assertEquals(
          expectedNames.subList(split, expectedNames.size()),
          names(
              users(
                  dao.listAfter(filter, PAGE_SIZE, cursor.getName(), cursor.getId().toString()))));
    }
  }

  @ParameterizedTest
  @MethodSource("domainFilters")
  void paginatesVisibleUsersBackward(
      ConnectionType database,
      String domainIds,
      boolean domainAccessControl,
      String team,
      List<String> expectedNames) {
    try (Handle handle = openHandle(database)) {
      final UserDAO dao = handle.attach(UserDAO.class);
      final ListFilter filter = userFilter(domainIds, domainAccessControl, team);
      final List<User> lastPage = users(dao.listBefore(filter, PAGE_SIZE, "zz", ""));
      final int split = Math.max(0, expectedNames.size() - PAGE_SIZE);
      assertEquals(expectedNames.subList(split, expectedNames.size()), names(lastPage));
      final User cursor = lastPage.getFirst();
      assertEquals(
          expectedNames.subList(0, split),
          names(
              users(
                  dao.listBefore(filter, PAGE_SIZE, cursor.getName(), cursor.getId().toString()))));
    }
  }

  private static Stream<Arguments> domainFilters() {
    return Stream.of(POSTGRES, MYSQL)
        .flatMap(
            database ->
                Stream.of(
                    arguments(database, ListFilter.NULL_PARAM, true, null, List.of("alice")),
                    arguments(database, FIRST_DOMAIN, false, null, List.of("bob")),
                    arguments(
                        database,
                        FIRST_DOMAIN + "," + SECOND_DOMAIN,
                        false,
                        null,
                        List.of("bob", "carol")),
                    arguments(
                        database,
                        FIRST_DOMAIN + "," + SECOND_DOMAIN,
                        true,
                        null,
                        List.of("alice", "bob", "carol")),
                    arguments(database, FIRST_DOMAIN, true, TEAM, List.of("bob")),
                    arguments(
                        database, null, false, null, List.of("alice", "bob", "carol", "dave"))));
  }

  private static ListFilter userFilter(String domainIds, boolean domainAccessControl, String team) {
    return new ListFilter()
        .addQueryParam("entityType", Entity.USER)
        .addQueryParam("domainId", domainIds)
        .addQueryParam("domainAccessControl", domainAccessControl)
        .addQueryParam("isAdmin", false)
        .addQueryParam("isBot", false)
        .addQueryParam("team", team);
  }

  private static Handle openHandle(ConnectionType database) {
    final String jdbcUrl =
        database == POSTGRES
            ? "jdbc:postgresql://%s:%d/%s"
                .formatted(
                    POSTGRES_CONTAINER.getHost(), POSTGRES_CONTAINER.getMappedPort(5432), DATABASE)
            : "jdbc:mysql://%s:%d/%s?allowPublicKeyRetrieval=true&useSSL=false"
                .formatted(
                    MYSQL_CONTAINER.getHost(), MYSQL_CONTAINER.getMappedPort(3306), DATABASE);
    final Jdbi jdbi =
        Jdbi.create(jdbcUrl, database == POSTGRES ? "postgres" : "root", PASSWORD)
            .installPlugin(new SqlObjectPlugin());
    jdbi.getConfig(SqlStatements.class).setUnusedBindingAllowed(true);
    jdbi.getConfig(SqlObjects.class)
        .setSqlLocator(new ConnectionAwareAnnotationSqlLocator(database.label));
    return jdbi.open();
  }

  private static void createTables(Handle handle, ConnectionType database) {
    handle.execute(
        "CREATE TABLE user_entity (id VARCHAR(36) PRIMARY KEY, name VARCHAR(256), json "
            + (database == POSTGRES ? "JSONB" : "JSON")
            + ", deleted BOOLEAN, isBot BOOLEAN)");
    handle.execute("CREATE TABLE team_entity (id VARCHAR(36) PRIMARY KEY, nameHash VARCHAR(256))");
    handle.execute(
        "CREATE TABLE entity_relationship (fromId VARCHAR(36), toId VARCHAR(36), "
            + "fromEntity VARCHAR(256), toEntity VARCHAR(256), relation INT)");
  }

  private static void seedUsers(Handle handle) {
    insertUser(handle, "alice", false, false, false);
    final String bob = insertUser(handle, "bob", false, false, false);
    final String carol = insertUser(handle, "carol", false, false, false);
    final String dave = insertUser(handle, "dave", false, false, false);
    insertUser(handle, "admin", true, false, false);
    insertUser(handle, "bot", false, true, false);
    insertUser(handle, "deleted", false, false, true);
    addRelationship(handle, FIRST_DOMAIN, Entity.DOMAIN, bob);
    addRelationship(handle, SECOND_DOMAIN, Entity.DOMAIN, bob);
    addRelationship(handle, SECOND_DOMAIN, Entity.DOMAIN, carol);
    addRelationship(handle, UUID.randomUUID().toString(), Entity.DOMAIN, dave);
    final String teamId = UUID.randomUUID().toString();
    handle.execute(
        "INSERT INTO team_entity VALUES (?, ?)", teamId, FullyQualifiedName.buildHash(TEAM));
    addRelationship(handle, teamId, Entity.TEAM, bob);
    addRelationship(handle, teamId, Entity.TEAM, dave);
  }

  private static String insertUser(
      Handle handle, String name, boolean isAdmin, boolean isBot, boolean deleted) {
    final User user =
        new User()
            .withId(UUID.randomUUID())
            .withName(name)
            .withIsAdmin(isAdmin)
            .withIsBot(isBot)
            .withDeleted(deleted);
    handle.execute(
        "INSERT INTO user_entity VALUES (?, ?, CAST(? AS JSON), ?, ?)",
        user.getId().toString(),
        name,
        JsonUtils.pojoToJson(user),
        deleted,
        isBot);
    return user.getId().toString();
  }

  private static void addRelationship(
      Handle handle, String fromId, String fromEntity, String userId) {
    handle.execute(
        "INSERT INTO entity_relationship VALUES (?, ?, ?, ?, ?)",
        fromId,
        userId,
        fromEntity,
        Entity.USER,
        Relationship.HAS.ordinal());
  }

  private static List<User> users(List<String> rows) {
    return rows.stream().map(json -> JsonUtils.readValue(json, User.class)).toList();
  }

  private static List<String> names(List<User> users) {
    return users.stream().map(User::getName).toList();
  }
}
