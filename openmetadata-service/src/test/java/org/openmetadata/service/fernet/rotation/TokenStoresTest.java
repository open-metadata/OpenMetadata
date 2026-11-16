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

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.fernet.rotation.SqlCatalog.ColumnType;
import org.openmetadata.service.fernet.rotation.SqlCatalog.SqlColumn;
import org.openmetadata.service.fernet.rotation.SqlCatalog.SqlTable;

class TokenStoresTest {

  @Test
  void aCatalogWithoutAnyOpenMetadataTableNamesBothAsMissing() {
    assertEquals(
        List.of("entity_extension", "openmetadata_settings"),
        TokenStores.missingOpenMetadataTables(List.of()));
    assertEquals(
        List.of("entity_extension", "openmetadata_settings"),
        TokenStores.missingOpenMetadataTables(List.of(table("orders"))));
  }

  @Test
  void aCatalogMissingOneOfTheTwoNamesIt() {
    assertEquals(
        List.of("openmetadata_settings"),
        TokenStores.missingOpenMetadataTables(List.of(table("entity_extension"))));
    assertEquals(
        List.of("entity_extension"),
        TokenStores.missingOpenMetadataTables(List.of(table("openmetadata_settings"))));
  }

  @Test
  void theTwoTablesAreMatchedWhateverTheCase() {
    assertEquals(
        List.of(),
        TokenStores.missingOpenMetadataTables(
            List.of(table("ENTITY_EXTENSION"), table("OpenMetadata_Settings"))));
  }

  private static SqlTable table(String name) {
    return new SqlTable(name, List.of("id"), List.of(new SqlColumn("json", ColumnType.JSON)));
  }
}
