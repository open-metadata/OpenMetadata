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
import org.openmetadata.it.util.RdfTestUtils;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.AssetRealization;
import org.openmetadata.schema.type.AssetRealizationRole;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.service.Entity;

/** A concept's realizations reach the live graph with the role each asset plays. */
@Tag("rdf")
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
@EnabledIfSystemProperty(named = "enableRdf", matches = "true")
public class RdfConceptRealizationIT {
  private static final String BASE_URI = "https://open-metadata.org/";
  private static final String OM = BASE_URI + "ontology/";
  private static final Duration PROJECTION_WAIT = Duration.ofSeconds(90);
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(1);

  @AfterEach
  void cleanup(final TestNamespace namespace) {
    NamespaceCleanup.deleteRoots(namespace.drainTrackedRoots());
  }

  @Test
  void replacingARealizationReplacesItsRoleInTheGraph(final TestNamespace namespace) {
    final String schema = DatabaseSchemaTestFactory.createSimple(namespace).getFullyQualifiedName();
    final Table operational = createTable(namespace, schema, "customers");
    final Table warehouse = createTable(namespace, schema, "dim_customer");
    final GlossaryTerm customer =
        createTerm(namespace, realization(operational, AssetRealizationRole.PRIMARY_STORE));
    awaitAsk(true, triple(customer, "hasPrimaryStore", operational));
    awaitAsk(true, triple(customer, "mappedTo", operational));

    SdkClients.adminClient()
        .glossaryTerms()
        .update(
            customer.getId(),
            customer.withRealizedIn(List.of(realization(warehouse, AssetRealizationRole.REPLICA))));

    awaitAsk(true, triple(customer, "hasReplica", warehouse));
    awaitAsk(false, triple(customer, "hasPrimaryStore", operational));
    awaitAsk(false, triple(customer, "mappedTo", operational));
  }

  private static String triple(final GlossaryTerm term, final String predicate, final Table asset) {
    return "ASK { <%s> <%s%s> <%s> }"
        .formatted(
            entityIri(Entity.GLOSSARY_TERM, term.getId()),
            OM,
            predicate,
            entityIri(Entity.TABLE, asset.getId()));
  }

  private static void awaitAsk(final boolean expected, final String ask) {
    Awaitility.await(ask)
        .atMost(PROJECTION_WAIT)
        .pollInterval(POLL_INTERVAL)
        .until(() -> RdfTestUtils.executeSparqlAsk(ask) == expected);
  }

  private static String entityIri(final String entityType, final UUID id) {
    return BASE_URI + "entity/" + entityType + "/" + id;
  }

  private static AssetRealization realization(final Table table, final AssetRealizationRole role) {
    return new AssetRealization().withAsset(table.getEntityReference()).withRole(role);
  }

  private static GlossaryTerm createTerm(
      final TestNamespace namespace, final AssetRealization realization) {
    final Glossary glossary =
        namespace.trackRoot(
            Entity.GLOSSARY,
            SdkClients.adminClient()
                .glossaries()
                .create(
                    new CreateGlossary()
                        .withName(namespace.prefix("realizationGraph"))
                        .withDescription("Concepts whose realizations reach the graph")));
    return SdkClients.adminClient()
        .glossaryTerms()
        .create(
            new CreateGlossaryTerm()
                .withName("Customer")
                .withDescription("Concept realized by a data asset")
                .withGlossary(glossary.getFullyQualifiedName())
                .withRealizedIn(List.of(realization)));
  }

  private static Table createTable(
      final TestNamespace namespace, final String schemaFqn, final String name) {
    return SdkClients.adminClient()
        .tables()
        .create(
            new CreateTable()
                .withName(namespace.shortPrefix(name))
                .withDatabaseSchema(schemaFqn)
                .withColumns(
                    List.of(ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build())));
  }
}
