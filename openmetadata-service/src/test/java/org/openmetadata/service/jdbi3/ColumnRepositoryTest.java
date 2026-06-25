/*
 *  Copyright 2024 Collate
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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.openmetadata.service.Entity.TABLE_COLUMN;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.UpdateColumn;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;

/**
 * Unit tests for {@link ColumnRepository#applyColumnUpdates}. The column-level update endpoint (PUT
 * /v1/columns/name/{fqn}) is a partial update: a request that does not carry a new description must
 * never delete the existing one. A regression here silently wiped descriptions on nested struct
 * columns when the UI sent a partial update (e.g. editing one child column), so these tests pin the
 * "blank description = no change" contract.
 */
class ColumnRepositoryTest {

  private static Column columnWithDescription(String description) {
    return new Column()
        .withName("full_name")
        .withDataType(ColumnDataType.VARCHAR)
        .withDescription(description);
  }

  @Test
  void emptyDescriptionDoesNotDeleteExistingDescription() {
    Column column = columnWithDescription("Full name.");
    UpdateColumn update = new UpdateColumn().withDescription("");

    ColumnRepository.applyColumnUpdates(column, update, TABLE_COLUMN, true);

    assertEquals("Full name.", column.getDescription());
  }

  @Test
  void whitespaceDescriptionDoesNotDeleteExistingDescription() {
    Column column = columnWithDescription("Full name.");
    UpdateColumn update = new UpdateColumn().withDescription("   ");

    ColumnRepository.applyColumnUpdates(column, update, TABLE_COLUMN, true);

    assertEquals("Full name.", column.getDescription());
  }

  @Test
  void absentDescriptionDoesNotDeleteExistingDescription() {
    Column column = columnWithDescription("Full name.");
    UpdateColumn update = new UpdateColumn().withDisplayName("Full Name");

    ColumnRepository.applyColumnUpdates(column, update, TABLE_COLUMN, true);

    assertEquals("Full name.", column.getDescription());
    assertEquals("Full Name", column.getDisplayName());
  }

  @Test
  void nonBlankDescriptionUpdatesExistingDescription() {
    Column column = columnWithDescription("Full name.");
    UpdateColumn update = new UpdateColumn().withDescription("Employee's full legal name.");

    ColumnRepository.applyColumnUpdates(column, update, TABLE_COLUMN, true);

    assertEquals("Employee's full legal name.", column.getDescription());
  }

  @Test
  void blankDisplayNameDoesNotClearExistingDisplayName() {
    // displayName follows the same "blank = no change" contract as description, so a partial update
    // that omits it (sends blank) never wipes the existing display name.
    Column column = columnWithDescription("Full name.").withDisplayName("Full Name");
    UpdateColumn update = new UpdateColumn().withDisplayName("  ");

    ColumnRepository.applyColumnUpdates(column, update, TABLE_COLUMN, true);

    assertEquals("Full Name", column.getDisplayName());
    assertEquals("Full name.", column.getDescription());
  }

  @Test
  void removeDescriptionClearsExistingDescription() {
    Column column = columnWithDescription("Full name.");
    UpdateColumn update = new UpdateColumn().withRemoveDescription(true);

    ColumnRepository.applyColumnUpdates(column, update, TABLE_COLUMN, true);

    assertNull(column.getDescription());
  }

  @Test
  void removeDisplayNameClearsExistingDisplayName() {
    Column column = columnWithDescription("Full name.").withDisplayName("Full Name");
    UpdateColumn update = new UpdateColumn().withRemoveDisplayName(true);

    ColumnRepository.applyColumnUpdates(column, update, TABLE_COLUMN, true);

    assertNull(column.getDisplayName());
    assertEquals("Full name.", column.getDescription());
  }

  @Test
  void removeDescriptionTakesPrecedenceOverProvidedDescription() {
    Column column = columnWithDescription("Full name.");
    UpdateColumn update = new UpdateColumn().withDescription("ignored").withRemoveDescription(true);

    ColumnRepository.applyColumnUpdates(column, update, TABLE_COLUMN, true);

    assertNull(column.getDescription());
  }
}
