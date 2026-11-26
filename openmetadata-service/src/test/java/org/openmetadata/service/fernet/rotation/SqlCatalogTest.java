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

package org.openmetadata.service.fernet.rotation;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.fernet.rotation.SqlCatalog.ColumnType;
import org.openmetadata.service.fernet.rotation.SqlCatalog.SqlColumn;

class SqlCatalogTest {

  @Test
  void narrowingColumnsExcludeEligibleTokenColumnsAndUnsuitableTypes() {
    Set<String> indexed =
        new LinkedHashSet<>(List.of("appId", "extension", "timestamp", "json", "payload"));
    Map<String, String> types =
        Map.of(
            "appId", "varchar",
            "extension", "varchar",
            "timestamp", "bigint",
            "json", "json",
            "payload", "text");
    List<SqlColumn> eligible =
        List.of(
            new SqlColumn("extension", ColumnType.TEXT),
            new SqlColumn("json", ColumnType.JSON),
            new SqlColumn("payload", ColumnType.TEXT));

    assertEquals(
        List.of("appId", "timestamp"), SqlCatalog.narrowingColumnsOf(indexed, types, eligible));
  }
}
