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
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.openmetadata.it.util.RdfGraphAssertions.BASE_URI;
import static org.openmetadata.it.util.RdfGraphAssertions.awaitAbsent;
import static org.openmetadata.it.util.RdfGraphAssertions.awaitCount;
import static org.openmetadata.it.util.RdfGraphAssertions.awaitPresent;
import static org.openmetadata.it.util.RdfGraphAssertions.count;
import static org.openmetadata.it.util.RdfGraphAssertions.iri;
import static org.openmetadata.it.util.RdfGraphAssertions.om;

import com.fasterxml.jackson.databind.node.ArrayNode;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.RdfTestUtils;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.api.data.CreateChart;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChartType;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.rdf.RdfUpdater;

/**
 * The graph projects the live catalog only (#36277): a soft-deleted entity leaves it with every
 * edge that touches it, and a restore rebuilds the entity and its edges from the database.
 */
@ExtendWith(TestNamespaceExtension.class)
public class RdfSoftDeleteIT {
  private static final Map<String, String> RECURSIVE = Map.of("recursive", "true");
  private static final Map<String, String> HARD_DELETE =
      Map.of("hardDelete", "true", "recursive", "true");

  private final OpenMetadataClient client = SdkClients.adminClient();

  @BeforeAll
  static void enableLiveProjection() {
    assumeTrue(RdfTestUtils.isRdfEnabled(), "Run with the RDF integration-test profile");
    if (!RdfUpdater.isEnabled()) {
      RdfUpdater.initialize(
          new RdfConfiguration()
              .withEnabled(true)
              .withBaseUri(URI.create(BASE_URI))
              .withStorageType(RdfConfiguration.StorageType.FUSEKI)
              .withRemoteEndpoint(URI.create(TestSuiteBootstrap.getFusekiEndpoint()))
              .withDataset("openmetadata")
              .withUsername("admin")
              .withPassword("test-admin"));
    }
  }

  @Test
  void softDeletingATableTakesItAndItsLineageOutAndRestoringItPutsThemBack(
      final TestNamespace namespace) {
    final DatabaseSchema schema = schema(namespace);
    final Table upstream = table(namespace, schema, "upstream");
    final Table middle = table(namespace, schema, "middle");
    final Table downstream = table(namespace, schema, "downstream");
    lineage(upstream, middle);
    lineage(middle, downstream);
    final String path =
        iri("table", downstream) + " " + om("upstream") + "+ " + iri("table", upstream);
    awaitPresent(path);

    client.tables().delete(middle.getId().toString());
    awaitAbsent(iri("table", middle));
    awaitCount(path, 0);

    client.tables().restore(middle.getId());
    awaitPresent(iri("table", middle) + " " + om("upstream") + " " + iri("table", upstream));
    awaitPresent(iri("table", downstream) + " " + om("upstream") + " " + iri("table", middle));
    awaitPresent(iri("databaseSchema", schema) + " " + om("contains") + " " + iri("table", middle));
    awaitPresent(path);
  }

  @Test
  void softDeletingASchemaTakesOutItsTablesAndRestoringItBringsBackTheirLineage(
      final TestNamespace namespace) {
    final DatabaseSchema schema = schema(namespace);
    final Table source = table(namespace, schema, "source");
    final Table target = table(namespace, schema, "target");
    lineage(source, target);
    final String edge = iri("table", target) + " " + om("upstream") + " " + iri("table", source);
    awaitPresent(edge);

    client.databaseSchemas().delete(schema.getId().toString(), RECURSIVE);
    awaitAbsent(iri("databaseSchema", schema));
    awaitAbsent(iri("table", source));
    awaitAbsent(iri("table", target));

    client.databaseSchemas().restore(schema.getId());
    awaitPresent(edge);
    awaitPresent(iri("databaseSchema", schema) + " " + om("contains") + " " + iri("table", source));
    awaitPresent(iri("databaseSchema", schema) + " " + om("contains") + " " + iri("table", target));
  }

  @Test
  void aPutOnASoftDeletedTableRestoresItWithItsEdges(final TestNamespace namespace) {
    final DatabaseSchema schema = schema(namespace);
    final Table source = table(namespace, schema, "putSource");
    final Table target = table(namespace, schema, "putTarget");
    lineage(source, target);
    final String edge = iri("table", target) + " " + om("upstream") + " " + iri("table", source);
    awaitPresent(edge);

    client.tables().delete(target.getId().toString());
    awaitAbsent(iri("table", target));

    final Table stored = client.tables().get(target.getId().toString(), "columns", "deleted");
    client
        .tables()
        .createOrUpdate(
            new CreateTable()
                .withName(stored.getName())
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(stored.getColumns()));
    awaitPresent(edge);
    awaitPresent(iri("databaseSchema", schema) + " " + om("contains") + " " + iri("table", target));
  }

  @Test
  void aNeighbourHardDeletedWhileTheTableIsDeletedLeavesNoEdgeAfterTheRestore(
      final TestNamespace namespace) {
    final DatabaseSchema schema = schema(namespace);
    final Table neighbour = table(namespace, schema, "neighbour");
    final Table table = table(namespace, schema, "restored");
    lineage(neighbour, table);
    awaitPresent(iri("table", table) + " " + om("upstream") + " " + iri("table", neighbour));

    client.tables().delete(table.getId().toString());
    awaitAbsent(iri("table", table));
    client.tables().delete(neighbour.getId().toString(), HARD_DELETE);
    client.tables().restore(table.getId());

    awaitPresent(iri("databaseSchema", schema) + " " + om("contains") + " " + iri("table", table));
    awaitAbsent(iri("table", neighbour));
  }

  @Test
  void aLiveDashboardHasNoEdgeToItsSoftDeletedChart(final TestNamespace namespace) {
    final DashboardService service = DashboardServiceTestFactory.createMetabase(namespace);
    final Chart kept = chart(namespace, service, "kept");
    final Chart removed = chart(namespace, service, "removed");
    final Dashboard dashboard =
        client
            .dashboards()
            .create(
                new CreateDashboard()
                    .withName(namespace.prefix("dashboard"))
                    .withService(service.getFullyQualifiedName())
                    .withCharts(
                        List.of(kept.getFullyQualifiedName(), removed.getFullyQualifiedName())));
    awaitPresent(iri("dashboard", dashboard) + " ?p " + iri("chart", removed));

    client.charts().delete(removed.getId().toString());
    awaitAbsent(iri("chart", removed));
    final String description = "re-projected " + UUID.randomUUID();
    client.dashboards().patch(dashboard.getId(), replace("/description", description));

    awaitPresent(iri("dashboard", dashboard) + " ?p \"" + description + "\"");
    awaitPresent(iri("dashboard", dashboard) + " ?p " + iri("chart", kept));
    awaitAbsent(iri("chart", removed));
  }

  @Test
  void restoringAnOwnerBringsBackOwnershipOfTheirAssets(final TestNamespace namespace) {
    final User owner = UserTestFactory.createUser(namespace, "rdfOwner");
    final Table table = table(namespace, schema(namespace), "owned");
    final ArrayNode owners = JsonUtils.getObjectMapper().createArrayNode();
    owners
        .addObject()
        .put("op", "add")
        .put("path", "/owners")
        .set("value", JsonUtils.valueToTree(List.of(owner.getEntityReference())));
    client.tables().patch(table.getId(), owners);
    final String ownership = iri("table", table) + " " + om("hasOwner") + " " + iri("user", owner);
    awaitPresent(ownership);

    client.users().delete(owner.getId().toString());
    awaitAbsent(iri("user", owner));

    client.users().restore(owner.getId());
    awaitPresent(ownership);
  }

  @Test
  void restoringAClassificationBringsBackItsTagsOnTheirAssets(final TestNamespace namespace) {
    final Classification classification = classification(namespace);
    final Tag tag = tag(namespace, classification);
    final Table table = table(namespace, schema(namespace), "tagged");
    label(table, tag.getFullyQualifiedName(), TagLabel.TagSource.CLASSIFICATION);
    final String labelled = iri("table", table) + " " + om("hasTag") + " " + iri("tag", tag);
    awaitPresent(labelled);

    client.classifications().delete(classification.getId().toString(), RECURSIVE);
    awaitAbsent(iri("tag", tag));

    client.classifications().restore(classification.getId());
    awaitPresent(labelled);
  }

  @Test
  void restoringAGlossaryBringsBackItsTermsOnTheirAssets(final TestNamespace namespace) {
    final Glossary glossary = GlossaryTestFactory.createWithName(namespace, "rdfRestored");
    final GlossaryTerm term = GlossaryTermTestFactory.createWithName(namespace, glossary, "term");
    final Table table = table(namespace, schema(namespace), "termed");
    label(table, term.getFullyQualifiedName(), TagLabel.TagSource.GLOSSARY);
    final String labelled =
        iri("table", table) + " " + om("hasGlossaryTerm") + " " + iri("glossaryTerm", term);
    awaitPresent(labelled);

    client.glossaries().delete(glossary.getId().toString(), RECURSIVE);
    awaitAbsent(iri("glossaryTerm", term));

    client.glossaries().restore(glossary.getId());
    awaitPresent(labelled);
  }

  /**
   * Deleting a tag on its own removes its labels from the database (TagRepository.postDelete), so
   * after a restore the graph, like the API, shows the tag with no asset labelled by it.
   */
  @Test
  void restoringATagDeletedOnItsOwnMatchesTheDatabaseWhichDroppedItsLabels(
      final TestNamespace namespace) {
    final Tag tag = tag(namespace, classification(namespace));
    final Table table = table(namespace, schema(namespace), "unlabelled");
    label(table, tag.getFullyQualifiedName(), TagLabel.TagSource.CLASSIFICATION);
    final String labelled = iri("table", table) + " " + om("hasTag") + " " + iri("tag", tag);
    awaitPresent(labelled);

    client.tags().delete(tag.getId().toString());
    awaitAbsent(iri("tag", tag));
    client.tags().restore(tag.getId());

    awaitPresent(iri("tag", tag) + " " + om("fullyQualifiedName") + " ?fqn");
    assertTrue(
        client.tables().get(table.getId().toString(), "tags").getTags().stream()
            .noneMatch(label -> tag.getFullyQualifiedName().equals(label.getTagFQN())));
    assertEquals(0, count(labelled));
  }

  private DatabaseSchema schema(final TestNamespace namespace) {
    return DatabaseSchemaTestFactory.createSimple(
        namespace, DatabaseServiceTestFactory.createPostgres(namespace));
  }

  private static Table table(
      final TestNamespace namespace, final DatabaseSchema schema, final String name) {
    return TableTestFactory.createWithName(namespace, schema.getFullyQualifiedName(), name);
  }

  private void lineage(final Table from, final Table to) {
    client
        .lineage()
        .addLineage(
            new AddLineage()
                .withEdge(
                    new EntitiesEdge()
                        .withFromEntity(from.getEntityReference())
                        .withToEntity(to.getEntityReference())));
  }

  private Chart chart(
      final TestNamespace namespace, final DashboardService service, final String name) {
    return client
        .charts()
        .create(
            new CreateChart()
                .withName(namespace.prefix(name))
                .withService(service.getFullyQualifiedName())
                .withChartType(ChartType.Bar));
  }

  private Classification classification(final TestNamespace namespace) {
    return client
        .classifications()
        .create(
            new CreateClassification()
                .withName(
                    namespace.uniqueShortId()
                        + "_rdf_"
                        + UUID.randomUUID().toString().substring(0, 8))
                .withDescription("RDF soft-delete fixture"));
  }

  private Tag tag(final TestNamespace namespace, final Classification classification) {
    return client
        .tags()
        .create(
            new CreateTag()
                .withName(namespace.shortPrefix("tag"))
                .withClassification(classification.getFullyQualifiedName())
                .withDescription("RDF soft-delete fixture"));
  }

  private void label(final Table table, final String fqn, final TagLabel.TagSource source) {
    final ArrayNode patch = JsonUtils.getObjectMapper().createArrayNode();
    patch
        .addObject()
        .put("op", "add")
        .put("path", "/tags/-")
        .set(
            "value",
            JsonUtils.valueToTree(
                new TagLabel()
                    .withTagFQN(fqn)
                    .withSource(source)
                    .withLabelType(TagLabel.LabelType.MANUAL)
                    .withState(TagLabel.State.CONFIRMED)));
    client.tables().patch(table.getId(), patch);
  }

  private static ArrayNode replace(final String path, final String value) {
    final ArrayNode patch = JsonUtils.getObjectMapper().createArrayNode();
    patch.addObject().put("op", "add").put("path", path).put("value", value);
    return patch;
  }
}
