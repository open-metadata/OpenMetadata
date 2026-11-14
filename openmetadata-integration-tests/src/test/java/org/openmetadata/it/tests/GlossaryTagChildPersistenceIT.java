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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.NESTED_COLUMN;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.TOP_LEVEL_COLUMN;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.applyTermToTable;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.changeTermAsset;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.cleanUp;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.clearTableTags;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.columnNamed;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.createGlossary;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.createSchema;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.createTableWithNestedColumn;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.createTerm;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.findLabel;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.label;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.labelOn;
import static org.openmetadata.it.tests.GlossaryTagChildFixtures.setColumnLabels;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.tests.GlossaryTagChildFixtures.Fixture;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel.LabelType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;

/**
 * The write side of the terms a column inherits from its table (#31756): they come back on every
 * read, so a client sends them back, and none of that may store them or block the write. Labels a
 * column holds in its own right — applied by hand, through the Assets API, or propagated along
 * lineage — are stored and removable as before.
 */
@Execution(ExecutionMode.CONCURRENT)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@ExtendWith(TestNamespaceExtension.class)
public class GlossaryTagChildPersistenceIT {

  /**
   * A table read back and written unchanged through PUT must not store the terms its columns
   * inherit: they are DERIVED, so the write ignores them, and they leave with the table's term. The
   * glossary is mutually exclusive, so the round trip also proves the inherited term is not checked
   * against a column's own sibling term, and that a column holding a sibling does not report both.
   */
  @Test
  void putOfATableReadBack_storesNoInheritedTermAndPassesExclusivity(TestNamespace ns)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Database database = null;
    try {
      Fixture fixture = createSchema(client, ns);
      database = fixture.database();
      Table table = createTableWithNestedColumn(client, fixture.schema(), ns.shortPrefix("rt_tbl"));
      Glossary glossary = createGlossary(client, ns, "rt", true);
      GlossaryTerm tableTerm = createTerm(client, ns, glossary, "rt_table");
      GlossaryTerm columnTerm = createTerm(client, ns, glossary, "rt_column");
      setColumnLabels(
          client, table, TOP_LEVEL_COLUMN, List.of(label(columnTerm, LabelType.MANUAL)));
      applyTermToTable(client, table, tableTerm);

      Table readBack = client.tables().get(table.getId().toString(), "columns,tags");
      assertTrue(
          findLabel(readBack, TOP_LEVEL_COLUMN, tableTerm).isEmpty(),
          "a column holding a sibling term must not also report the table's");
      assertEquals(LabelType.DERIVED, labelOn(readBack, NESTED_COLUMN, tableTerm).getLabelType());

      client
          .tables()
          .createOrUpdate(
              new CreateTable()
                  .withName(readBack.getName())
                  .withDatabaseSchema(fixture.schema().getFullyQualifiedName())
                  .withColumns(readBack.getColumns())
                  .withTags(readBack.getTags()));
      clearTableTags(client, table);

      Table cleared = client.tables().get(table.getId().toString(), "columns,tags");
      assertTrue(
          findLabel(cleared, NESTED_COLUMN, tableTerm).isEmpty(),
          "the PUT must not have stored the inherited term on the column");
      assertEquals(LabelType.MANUAL, labelOn(cleared, TOP_LEVEL_COLUMN, columnTerm).getLabelType());
    } finally {
      cleanUp(client, database);
    }
  }

  /**
   * PROPAGATED marks a label propagated along lineage (the Collate Automator writes them through
   * PATCH). It is the column's own, so it is stored and can be removed like any other label.
   */
  @Test
  void lineagePropagatedColumnLabel_isStoredAndRemovable(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Database database = null;
    try {
      Fixture fixture = createSchema(client, ns);
      database = fixture.database();
      Table table =
          createTableWithNestedColumn(client, fixture.schema(), ns.shortPrefix("lineage_tbl"));
      GlossaryTerm term = createTerm(client, ns, "lineage");

      setColumnLabels(client, table, TOP_LEVEL_COLUMN, List.of(label(term, LabelType.PROPAGATED)));

      Table stored = client.tables().get(table.getId().toString(), "columns,tags");
      assertEquals(LabelType.PROPAGATED, labelOn(stored, TOP_LEVEL_COLUMN, term).getLabelType());

      setColumnLabels(client, table, TOP_LEVEL_COLUMN, List.of());

      Table removed = client.tables().get(table.getId().toString(), "columns,tags");
      assertTrue(
          findLabel(removed, TOP_LEVEL_COLUMN, term).isEmpty(),
          "the propagated label should be removable");
    } finally {
      cleanUp(client, database);
    }
  }

  /**
   * Adding a term to a column through the term's Assets API, when the column's table already
   * carries it: the column reads the term back as inherited, and the add must still be stored as
   * the column's own, so it outlives the table's term.
   */
  @Test
  void bulkAddToAColumnOfATaggedTable_storesTheColumnsOwnTerm(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Database database = null;
    try {
      Fixture fixture = createSchema(client, ns);
      database = fixture.database();
      Table table =
          createTableWithNestedColumn(client, fixture.schema(), ns.shortPrefix("asset_tbl"));
      GlossaryTerm term = createTerm(client, ns, "asset");
      applyTermToTable(client, table, term);

      Table tagged = client.tables().get(table.getId().toString(), "columns,tags");
      EntityReference column =
          new EntityReference()
              .withId(UUID.randomUUID())
              .withType(Entity.TABLE_COLUMN)
              .withFullyQualifiedName(
                  columnNamed(tagged, TOP_LEVEL_COLUMN).getFullyQualifiedName());
      changeTermAsset(client, term, column, "add");
      clearTableTags(client, table);

      Table cleared = client.tables().get(table.getId().toString(), "columns,tags");
      assertEquals(LabelType.MANUAL, labelOn(cleared, TOP_LEVEL_COLUMN, term).getLabelType());
    } finally {
      cleanUp(client, database);
    }
  }
}
