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

package org.openmetadata.it.tests.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.stream.Stream;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.it.util.ScratchDatabase;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AccessControlDAOs.UserDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.util.FullyQualifiedName;

class UserDAOIT {
  private static final String FIRST_DOMAIN = UUID.randomUUID().toString();
  private static final String SECOND_DOMAIN = UUID.randomUUID().toString();
  private static final String TEAM = "engineering";
  private static final int PAGE_SIZE = 2;

  @ParameterizedTest
  @MethodSource("domainFilters")
  void countsOnlyVisibleUsers(
      ConnectionType database,
      String domainIds,
      boolean domainAccessControl,
      String team,
      List<String> expectedNames) {
    withSeededHandle(
        database,
        handle -> {
          final UserDAO dao = handle.attach(UserDAO.class);
          assertEquals(
              expectedNames.size(),
              dao.listCount(userFilter(domainIds, domainAccessControl, team)));
        });
  }

  @ParameterizedTest
  @MethodSource("domainFilters")
  void paginatesVisibleUsersForward(
      ConnectionType database,
      String domainIds,
      boolean domainAccessControl,
      String team,
      List<String> expectedNames) {
    withSeededHandle(
        database,
        handle -> {
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
                      dao.listAfter(
                          filter, PAGE_SIZE, cursor.getName(), cursor.getId().toString()))));
        });
  }

  @ParameterizedTest
  @MethodSource("domainFilters")
  void paginatesVisibleUsersBackward(
      ConnectionType database,
      String domainIds,
      boolean domainAccessControl,
      String team,
      List<String> expectedNames) {
    withSeededHandle(
        database,
        handle -> {
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
                      dao.listBefore(
                          filter, PAGE_SIZE, cursor.getName(), cursor.getId().toString()))));
        });
  }

  private static Stream<Arguments> domainFilters() {
    return Stream.of(ScratchDatabase.dialect())
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
                    arguments(database, FIRST_DOMAIN, true, null, List.of("alice", "bob")),
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

  private static void withSeededHandle(ConnectionType database, Consumer<Handle> body) {
    ScratchDatabase.withDatabase(
        handle -> {
          createTables(handle, database);
          seedUsers(handle);
          body.accept(handle);
        });
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
