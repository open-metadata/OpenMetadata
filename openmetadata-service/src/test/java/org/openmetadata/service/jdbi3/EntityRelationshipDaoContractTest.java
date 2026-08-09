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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

class EntityRelationshipDaoContractTest {

  @Test
  void mysqlRelationshipJsonUsesOneUtf8BindForInsertAndDuplicateUpdate() throws Exception {
    Method insert =
        CollectionDAO.EntityRelationshipDAO.class.getDeclaredMethod(
            "insert",
            UUID.class,
            UUID.class,
            String.class,
            String.class,
            int.class,
            String.class,
            String.class);
    String mysqlSql = updatesByDialect(insert).get(MYSQL).value();

    assertTrue(mysqlSql.contains("CONVERT(:json USING utf8mb4)"));
    assertTrue(mysqlSql.contains("ON DUPLICATE KEY UPDATE json = VALUES(json)"));
    assertEquals(1, mysqlSql.split(":json", -1).length - 1);
  }

  private Map<ConnectionType, ConnectionAwareSqlUpdate> updatesByDialect(Method method) {
    return Arrays.stream(method.getAnnotationsByType(ConnectionAwareSqlUpdate.class))
        .collect(Collectors.toMap(ConnectionAwareSqlUpdate::connectionType, Function.identity()));
  }
}
