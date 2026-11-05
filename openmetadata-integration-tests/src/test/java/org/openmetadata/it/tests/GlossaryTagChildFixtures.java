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

import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.AddGlossaryToAssetsRequest;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Shared setup for the glossary-term child ITs: a table whose top-level column has a nested one, a
 * glossary term, and lookups for the labels a column reads back.
 */
final class GlossaryTagChildFixtures {

  static final String TOP_LEVEL_COLUMN = "payload";
  static final String NESTED_COLUMN = "inner";

  private static final Logger LOG = LoggerFactory.getLogger(GlossaryTagChildFixtures.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String CLEAR_TAGS_PATCH =
      """
      [{"op": "replace", "path": "/tags", "value": []}]
      """;

  private GlossaryTagChildFixtures() {}

  /** The Database is carried alongside the schema purely so the test can hard-delete it. */
  record Fixture(Database database, DatabaseSchema schema) {}

  static Fixture createSchema(OpenMetadataClient client, TestNamespace ns) {
    Database database =
        client
            .databases()
            .create(
                new CreateDatabase()
                    .withName(ns.shortPrefix("prop_db"))
                    .withService(SharedEntities.get().MYSQL_SERVICE.getFullyQualifiedName()));
    DatabaseSchema schema =
        client
            .databaseSchemas()
            .create(
                new CreateDatabaseSchema()
                    .withName(ns.shortPrefix("prop_sch"))
                    .withDatabase(database.getFullyQualifiedName()));
    return new Fixture(database, schema);
  }

  static Table createTableWithNestedColumn(
      OpenMetadataClient client, DatabaseSchema schema, String tableName) {
    Column nested = new Column().withName(NESTED_COLUMN).withDataType(ColumnDataType.STRING);
    Column topLevel =
        new Column()
            .withName(TOP_LEVEL_COLUMN)
            .withDataType(ColumnDataType.STRUCT)
            .withChildren(List.of(nested));
    return client
        .tables()
        .create(
            new CreateTable()
                .withName(tableName)
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(List.of(topLevel)));
  }

  /**
   * The glossary is registered with {@code trackRoot} so TestNamespaceExtension tears it down;
   * without it a glossary and term leak per test and accumulate on a shared cluster. Deleting the
   * glossary removes its terms, so terms need no separate registration.
   */
  static Glossary createGlossary(
      OpenMetadataClient client, TestNamespace ns, String suffix, boolean mutuallyExclusive) {
    return ns.trackRoot(
        Entity.GLOSSARY,
        client
            .glossaries()
            .create(
                new CreateGlossary()
                    .withName(ns.prefix("prop_glossary_" + suffix))
                    .withDescription("Glossary for child tag propagation")
                    .withMutuallyExclusive(mutuallyExclusive)));
  }

  static GlossaryTerm createTerm(
      OpenMetadataClient client, TestNamespace ns, Glossary glossary, String suffix) {
    return client
        .glossaryTerms()
        .create(
            new CreateGlossaryTerm()
                .withName(ns.prefix("prop_term_" + suffix))
                .withGlossary(glossary.getFullyQualifiedName())
                .withDescription("Term inherited by table columns"));
  }

  static GlossaryTerm createTerm(OpenMetadataClient client, TestNamespace ns, String suffix) {
    return createTerm(client, ns, createGlossary(client, ns, suffix, false), suffix);
  }

  /** PUT merges tags rather than replacing them, which is what we want for an add. */
  static void applyTermToTable(OpenMetadataClient client, Table table, GlossaryTerm term) {
    Table toTag = client.tables().get(table.getId().toString(), "tags");
    List<TagLabel> tags = new ArrayList<>(Optional.ofNullable(toTag.getTags()).orElse(List.of()));
    tags.add(label(term, TagLabel.LabelType.MANUAL));
    toTag.setTags(tags);
    client.tables().update(toTag.getId(), toTag);
  }

  static void setColumnLabels(
      OpenMetadataClient client, Table table, String columnName, List<TagLabel> labels) {
    Table toTag = client.tables().get(table.getId().toString(), "columns,tags");
    columnNamed(toTag, columnName).setTags(new ArrayList<>(labels));
    client.tables().update(toTag.getId(), toTag);
  }

  /** PUT never deletes tags (see {@code EntityRepository.updateTags}), so removal needs PATCH. */
  static void clearTableTags(OpenMetadataClient client, Table table) throws Exception {
    JsonNode patch = MAPPER.readTree(CLEAR_TAGS_PATCH);
    client.tables().patch(table.getId(), patch);
  }

  static TagLabel label(GlossaryTerm term, TagLabel.LabelType labelType) {
    return new TagLabel()
        .withTagFQN(term.getFullyQualifiedName())
        .withSource(TagLabel.TagSource.GLOSSARY)
        .withLabelType(labelType);
  }

  static Column columnNamed(Table table, String name) {
    Column found = findColumn(table.getColumns(), name);
    assertNotNull(found, () -> "column " + name + " not found on " + table.getName());
    return found;
  }

  private static Column findColumn(List<Column> columns, String name) {
    return Optional.ofNullable(columns).orElse(List.of()).stream()
        .map(
            column ->
                name.equals(column.getName()) ? column : findColumn(column.getChildren(), name))
        .filter(Objects::nonNull)
        .findFirst()
        .orElse(null);
  }

  static List<TagLabel> labelsFor(Table table, String columnName, GlossaryTerm term) {
    return Optional.ofNullable(columnNamed(table, columnName).getTags()).orElse(List.of()).stream()
        .filter(tag -> term.getFullyQualifiedName().equals(tag.getTagFQN()))
        .toList();
  }

  static Optional<TagLabel> findLabel(Table table, String columnName, GlossaryTerm term) {
    return labelsFor(table, columnName, term).stream().findFirst();
  }

  static TagLabel labelOn(Table table, String columnName, GlossaryTerm term) {
    return findLabel(table, columnName, term)
        .orElseThrow(
            () ->
                new AssertionError(
                    "column "
                        + columnName
                        + " is missing term "
                        + term.getFullyQualifiedName()
                        + "; tags were "
                        + columnNamed(table, columnName).getTags()));
  }

  static TestCase createTestCase(OpenMetadataClient client, TestNamespace ns, Table table) {
    return client
        .testCases()
        .create(
            new CreateTestCase()
                .withName(ns.shortPrefix("prop_tc"))
                .withEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">")
                .withTestDefinition("tableRowCountToEqual")
                .withParameterValues(
                    List.of(new TestCaseParameterValue().withName("value").withValue("100"))));
  }

  /** Adds or removes an asset through the glossary term's Assets API ("add" or "remove"). */
  static void changeTermAsset(
      OpenMetadataClient client, GlossaryTerm term, EntityReference asset, String operation) {
    AddGlossaryToAssetsRequest request =
        new AddGlossaryToAssetsRequest().withAssets(List.of(asset)).withDryRun(false);
    client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/glossaryTerms/" + term.getId() + "/assets/" + operation,
            request,
            BulkOperationResult.class);
  }

  static void cleanUp(OpenMetadataClient client, Database database) {
    if (database != null) {
      try {
        client
            .databases()
            .delete(database.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));
      } catch (OpenMetadataException e) {
        // Best effort: an assertion failure in the test takes precedence over a cleanup failure.
        LOG.warn("Could not hard-delete test database {}", database.getFullyQualifiedName(), e);
      }
    }
  }
}
