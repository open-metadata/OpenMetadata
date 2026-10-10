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

import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.RdfInferenceRuns;
import org.openmetadata.it.util.RdfTestUtils;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.RdfUtils;

/**
 * The starter governance rules over the live projection: conclusions chain across rules and
 * lineage hops within one run, and disappear once the facts behind them are removed.
 */
@Tag("rdf")
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
@EnabledIfSystemProperty(named = "enableRdf", matches = "true")
public class RdfGovernanceRulesIT {
  private static final String BASE_URI = "https://open-metadata.org/";
  private static final String OM = BASE_URI + "ontology/";
  private static final String INFERRED_GRAPH = BASE_URI + "graph/inferred/";
  private static final String PII_RULE = "pii-propagation-via-lineage";
  private static final String SCHEMA_TAG_RULE = "schema-tag-inheritance";
  private static final String DOMAIN_RULE = "domain-membership-inheritance";
  private static final String PII_TAG = "PII.Sensitive";
  private static final String COLUMN = "email";
  private static final Duration PROJECTION_WAIT = Duration.ofSeconds(90);
  private static final Duration INFERENCE_WAIT = Duration.ofMinutes(3);
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(1);

  @AfterEach
  void cleanup(final TestNamespace namespace) {
    NamespaceCleanup.deleteRoots(namespace.drainTrackedRoots());
  }

  @Test
  void piiFollowsAnInheritedTagAcrossTwoColumnLineageHops(final TestNamespace namespace) {
    final LineageChain chain = LineageChain.create(namespace, List.of(piiTag()), List.of());

    RdfInferenceRuns.materializeWhenIdle(true, null);

    awaitAsk("source column inherits its table's PII tag", hasPii(SCHEMA_TAG_RULE, chain.source()));
    awaitAsk("PII reaches the second lineage hop", hasPii(PII_RULE, chain.sink()));
  }

  @Test
  void removingTheSourceTagRetractsWhatItPropagated(final TestNamespace namespace) {
    final LineageChain chain = LineageChain.create(namespace, List.of(piiTag()), List.of());
    RdfInferenceRuns.materializeWhenIdle(true, null);
    awaitAsk("PII reaches the second lineage hop", hasPii(PII_RULE, chain.sink()));

    chain.removeSourceTags();
    awaitAskFalse("the projection drops the source tag", tableHasPii(chain.sourceTableIri()));
    RdfInferenceRuns.materializeWhenIdle(true, null);

    awaitAskFalse("the next run retracts the propagated tag", hasPii(PII_RULE, chain.sink()));
  }

  @Test
  void columnsInheritTheirTablesDomain(final TestNamespace namespace) {
    final Domain domain = createDomain(namespace);
    final LineageChain chain =
        LineageChain.create(namespace, List.of(), List.of(domain.getFullyQualifiedName()));
    final String domainIri = entityIri(Entity.DOMAIN, domain.getId());
    awaitAsk(
        "table domain is projected", triple(chain.sourceTableIri(), "belongsToDomain", domainIri));

    RdfInferenceRuns.materializeWhenIdle(true, null);

    awaitAsk(
        "source column belongs to its table's domain",
        "ASK { GRAPH <%s> { <%s> <%s> <%s> } }"
            .formatted(
                INFERRED_GRAPH + DOMAIN_RULE, chain.source(), OM + "belongsToDomain", domainIri));
  }

  private static String hasPii(final String rule, final String columnIri) {
    return ("ASK { GRAPH <%s> { <%s> <%shasTag> ?tag } ?tag <%stagFQN> \"%s\" }")
        .formatted(INFERRED_GRAPH + rule, columnIri, OM, OM, PII_TAG);
  }

  private static String tableHasPii(final String tableIri) {
    return "ASK { <%s> <%shasTag> ?tag . ?tag <%stagFQN> \"%s\" }"
        .formatted(tableIri, OM, OM, PII_TAG);
  }

  private static String triple(final String subject, final String predicate, final String object) {
    return "ASK { <%s> <%s%s> <%s> }".formatted(subject, OM, predicate, object);
  }

  private static void awaitAsk(final String description, final String ask) {
    awaitAskResult(description, ask, true);
  }

  private static void awaitAskFalse(final String description, final String ask) {
    awaitAskResult(description, ask, false);
  }

  // Projection is asynchronous, and a scheduled materialization run empties every rule graph
  // before recomputing it, so each check polls until the store settles.
  private static void awaitAskResult(
      final String description, final String ask, final boolean expected) {
    Awaitility.await(description)
        .atMost(INFERENCE_WAIT)
        .pollInterval(POLL_INTERVAL)
        .until(() -> RdfTestUtils.executeSparqlAsk(ask) == expected);
  }

  private static TagLabel piiTag() {
    return new TagLabel()
        .withTagFQN(PII_TAG)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL);
  }

  private static Domain createDomain(final TestNamespace namespace) {
    final Domain domain =
        SdkClients.adminClient()
            .domains()
            .create(
                new CreateDomain()
                    .withName(namespace.prefix("governance-domain"))
                    .withDomainType(CreateDomain.DomainType.AGGREGATE)
                    .withDescription("Domain whose membership the domain rule propagates"));
    return namespace.trackRoot(Entity.DOMAIN, domain);
  }

  private static String entityIri(final String entityType, final UUID id) {
    return BASE_URI + "entity/" + entityType + "/" + id;
  }

  /** Three tables whose columns are linked source → middle → sink by column-level lineage. */
  private record LineageChain(Table sourceTable, String source, String middle, String sink) {
    static LineageChain create(
        final TestNamespace namespace,
        final List<TagLabel> sourceTags,
        final List<String> sourceDomains) {
      final String schema =
          DatabaseSchemaTestFactory.createSimple(namespace).getFullyQualifiedName();
      final Table source =
          createTable(
              tableRequest(namespace, schema, "governance_source")
                  .withTags(sourceTags)
                  .withDomains(sourceDomains));
      final Table middle = createTable(tableRequest(namespace, schema, "governance_middle"));
      final Table sink = createTable(tableRequest(namespace, schema, "governance_sink"));
      addColumnLineage(source, middle);
      addColumnLineage(middle, sink);
      final LineageChain chain =
          new LineageChain(source, columnIri(source), columnIri(middle), columnIri(sink));
      chain.awaitProjected();
      return chain;
    }

    String sourceTableIri() {
      return entityIri(Entity.TABLE, sourceTable.getId());
    }

    void removeSourceTags() {
      final Table current =
          SdkClients.adminClient().tables().get(sourceTable.getId().toString(), "tags");
      current.setTags(List.of());
      SdkClients.adminClient().tables().update(current.getId().toString(), current);
    }

    private void awaitProjected() {
      awaitAsk("source table owns its column", triple(sourceTableIri(), "hasColumn", source));
      awaitAsk("first lineage hop is projected", columnLineage(source, middle));
      awaitAsk("second lineage hop is projected", columnLineage(middle, sink));
    }

    private static String columnLineage(final String from, final String to) {
      return "ASK { ?lineage <%sfromColumn> <%s> ; <%stoColumn> <%s> }".formatted(OM, from, OM, to);
    }

    private static CreateTable tableRequest(
        final TestNamespace namespace, final String schemaFqn, final String name) {
      return new CreateTable()
          .withName(namespace.prefix(name))
          .withDatabaseSchema(schemaFqn)
          .withColumns(List.of(ColumnBuilder.of(COLUMN, "VARCHAR").dataLength(255).build()));
    }

    private static Table createTable(final CreateTable request) {
      return SdkClients.adminClient().tables().create(request);
    }

    private static String columnIri(final Table table) {
      return RdfUtils.columnUri(BASE_URI, table.getFullyQualifiedName() + "." + COLUMN);
    }

    private static void addColumnLineage(final Table from, final Table to) {
      final ColumnLineage columnLineage =
          new ColumnLineage()
              .withFromColumns(List.of(from.getFullyQualifiedName() + "." + COLUMN))
              .withToColumn(to.getFullyQualifiedName() + "." + COLUMN);
      SdkClients.adminClient()
          .lineage()
          .addLineage(
              new AddLineage()
                  .withEdge(
                      new EntitiesEdge()
                          .withFromEntity(from.getEntityReference())
                          .withToEntity(to.getEntityReference())
                          .withLineageDetails(
                              new LineageDetails()
                                  .withColumnsLineage(List.of(columnLineage))
                                  .withSource(LineageDetails.Source.MANUAL))));
    }
  }
}
