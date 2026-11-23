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
import static org.mockito.Mockito.RETURNS_DEFAULTS;
import static org.mockito.Mockito.mock;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlStatements;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.util.FullyQualifiedName;

class EntityDAOTest {
  private static final String OLD_FQN = "Finance.o\\'\\'brien 100%_off";
  private static final String NEW_FQN = "Finance.\"it's.new\"";
  private static final String OLD_HASH = FullyQualifiedName.buildHash(OLD_FQN);
  private static final String NEW_HASH = FullyQualifiedName.buildHash(NEW_FQN);
  private static final String OLD_JSON_PREFIX =
      "\"fullyQualifiedName\": \"Finance.o\\\\'\\\\'brien 100%_off.";
  private static final String NEW_JSON_PREFIX =
      "\"fullyQualifiedName\": \"Finance.\\\"it's.new\\\".";

  private final List<String> preparedSql = new ArrayList<>();
  private final List<Object> boundValues = new ArrayList<>();

  @Test
  void entityReferenceRow_preservesReferenceFields() {
    UUID id = UUID.randomUUID();
    EntityReference ref =
        new EntityDAO.EntityReferenceRow(
                id, "policyName", null, "policyName", "policy description", false)
            .toEntityReference(Entity.POLICY);

    assertEquals(id, ref.getId());
    assertEquals(Entity.POLICY, ref.getType());
    assertEquals("policyName", ref.getName());
    assertEquals("policyName", ref.getDisplayName());
    assertEquals("policyName", ref.getFullyQualifiedName());
    assertEquals("policy description", ref.getDescription());
  }

  @Test
  void updateFqn_bindsEntityNamesOnMysql() {
    dao(ConnectionType.MYSQL, EntityDataDAOs.GlossaryTermDAO.class).updateFqn(OLD_FQN, NEW_FQN);

    assertEquals(
        List.of(
            "UPDATE glossary_term_entity SET json = "
                + "JSON_REPLACE(json, '$.fullyQualifiedName', CONCAT(?, SUBSTRING("
                + "JSON_UNQUOTE(JSON_EXTRACT(json, '$.fullyQualifiedName')), CHAR_LENGTH(?) + 1))) "
                + ", fqnHash = REPLACE(fqnHash, ?, ?) WHERE fqnHash LIKE ?"),
        preparedSql);
    assertEquals(
        List.of(NEW_FQN, OLD_FQN, OLD_HASH + ".", NEW_HASH + ".", OLD_HASH + ".%"), boundValues);
  }

  @Test
  void updateFqn_bindsEntityNamesOnPostgres() {
    dao(ConnectionType.POSTGRES, EntityDataDAOs.GlossaryTermDAO.class).updateFqn(OLD_FQN, NEW_FQN);

    assertEquals(
        List.of(
            "UPDATE glossary_term_entity SET json = REPLACE(json::text, ?, ?)::jsonb "
                + ", fqnHash = REPLACE(fqnHash, ?, ?) WHERE fqnHash LIKE ?"),
        preparedSql);
    assertEquals(
        List.of(OLD_JSON_PREFIX, NEW_JSON_PREFIX, OLD_HASH + ".", NEW_HASH + ".", OLD_HASH + ".%"),
        boundValues);
  }

  @ParameterizedTest
  @EnumSource(ConnectionType.class)
  void containerUpdateFqn_bindsEntityNames(ConnectionType database) {
    dao(database, DataAssetServiceDAOs.ContainerDAO.class).updateFqn(OLD_FQN, NEW_FQN);

    assertEquals(
        List.of(
            "UPDATE storage_container_entity SET json = "
                + (database == ConnectionType.MYSQL
                    ? "CAST(REPLACE(CAST(json AS CHAR), ?, ?) AS JSON), "
                    : "REPLACE(json::text, ?, ?)::jsonb, ")
                + "fqnHash = REPLACE(fqnHash, ?, ?) WHERE fqnHash LIKE ?"),
        preparedSql);
    assertEquals(
        List.of(OLD_JSON_PREFIX, NEW_JSON_PREFIX, OLD_HASH + ".", NEW_HASH + ".", OLD_HASH + ".%"),
        boundValues);
  }

  @ParameterizedTest
  @EnumSource(ConnectionType.class)
  void updateTagPrefix_bindsEntityNames(ConnectionType database) {
    dao(database, ClassificationTagDAOs.TagUsageDAO.class).updateTagPrefix(1, OLD_FQN, NEW_FQN);

    assertEquals(
        List.of(
            "UPDATE tag_usage SET tagFQN = REPLACE(tagFQN, ?, ?), "
                + "tagFQNHash = REPLACE(tagFQNHash, ?, ?) "
                + "WHERE source = ? AND tagFQNHash LIKE ?"),
        preparedSql);
    assertEquals(
        List.of(OLD_FQN + ".", NEW_FQN + ".", OLD_HASH + ".", NEW_HASH + ".", 1, OLD_HASH + ".%"),
        boundValues);
  }

  @ParameterizedTest
  @EnumSource(ConnectionType.class)
  void updateTargetFQNHashPrefix_bindsEntityNames(ConnectionType database) {
    dao(database, ClassificationTagDAOs.TagUsageDAO.class)
        .updateTargetFQNHashPrefix(1, OLD_FQN, NEW_FQN);

    assertEquals(
        List.of(
            "UPDATE tag_usage SET targetFQNHash = REPLACE(targetFQNHash, ?, ?) "
                + "WHERE source = ? AND targetFQNHash LIKE ?"),
        preparedSql);
    assertEquals(List.of(OLD_HASH + ".", NEW_HASH + ".", 1, OLD_HASH + ".%"), boundValues);
  }

  @ParameterizedTest
  @EnumSource(ConnectionType.class)
  void renameByToFQNPrefix_bindsEntityNames(ConnectionType database) {
    dao(database, CoreRelationshipDAOs.FieldRelationshipDAO.class)
        .renameByToFQNPrefix(OLD_FQN, NEW_FQN);

    assertEquals(
        List.of(
            "UPDATE field_relationship SET toFQN = REPLACE(toFQN, ?, ?), "
                + "toFQNHash = REPLACE(toFQNHash, ?, ?) "
                + "WHERE fromtype = 'THREAD' AND relation = '3' "
                + "AND toFQN LIKE ? AND toFQNHash LIKE ?"),
        preparedSql);
    assertEquals(
        List.of(
            OLD_FQN + ".",
            NEW_FQN + ".",
            OLD_HASH + ".",
            NEW_HASH + ".",
            "Finance.o\\\\'\\\\'brien 100\\%\\_off.%",
            OLD_HASH + ".%"),
        boundValues);
  }

  /** The DAO on JDBI as JdbiUtils sets it up, over a connection that records what it is sent. */
  private <D> D dao(ConnectionType database, Class<D> daoClass) {
    PreparedStatement statement =
        mock(
            PreparedStatement.class,
            call -> {
              if (call.getMethod().getName().startsWith("set") && call.getArguments().length == 2) {
                boundValues.add(call.getArgument(1));
              }
              return RETURNS_DEFAULTS.answer(call);
            });
    Connection connection =
        mock(
            Connection.class,
            call -> {
              if (call.getMethod().getName().equals("prepareStatement")) {
                preparedSql.add(call.getArgument(0));
                return statement;
              }
              return RETURNS_DEFAULTS.answer(call);
            });
    Jdbi jdbi = Jdbi.create(() -> connection).installPlugin(new SqlObjectPlugin());
    jdbi.getConfig(SqlStatements.class).setUnusedBindingAllowed(true);
    jdbi.getConfig(SqlObjects.class)
        .setSqlLocator(new ConnectionAwareAnnotationSqlLocator(database.label));
    return jdbi.onDemand(daoClass);
  }
}
