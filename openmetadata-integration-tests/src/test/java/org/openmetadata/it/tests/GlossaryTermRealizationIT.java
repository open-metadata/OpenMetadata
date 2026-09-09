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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.AssetRealization;
import org.openmetadata.schema.type.AssetRealizationRole;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.service.Entity;

/**
 * Verifies that a concept records which data assets physically realize it, separately from the tag
 * labels that merely reference it.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class GlossaryTermRealizationIT {
  private static final String REALIZED_IN = "realizedIn";

  @AfterEach
  void cleanup(TestNamespace namespace) {
    NamespaceCleanup.deleteRoots(namespace.drainTrackedRoots());
  }

  @Test
  void storesTheAssetThatHoldsAConceptsInstances(TestNamespace namespace) throws Exception {
    Glossary glossary = createGlossary(namespace);
    DatabaseSchema schema = createSchema(namespace);
    Table customerTable = createTable(namespace, schema, "dim_customer");

    GlossaryTerm customer =
        SdkClients.adminClient()
            .glossaryTerms()
            .create(
                termRequest(glossary, "Customer")
                    .withRealizedIn(
                        List.of(realization(customerTable, AssetRealizationRole.PRIMARY_STORE))));

    GlossaryTerm fetched =
        SdkClients.adminClient().glossaryTerms().get(customer.getId().toString(), REALIZED_IN);

    assertEquals(1, fetched.getRealizedIn().size());
    AssetRealization realization = fetched.getRealizedIn().getFirst();
    assertEquals(customerTable.getId(), realization.getAsset().getId());
    assertEquals(Entity.TABLE, realization.getAsset().getType());
    assertEquals(AssetRealizationRole.PRIMARY_STORE, realization.getRole());
  }

  @Test
  void allowsOneStoreOfRecordAlongsideDerivedCopies(TestNamespace namespace) throws Exception {
    Glossary glossary = createGlossary(namespace);
    DatabaseSchema schema = createSchema(namespace);
    Table operational = createTable(namespace, schema, "customers");
    Table warehouse = createTable(namespace, schema, "dim_customer");

    GlossaryTerm customer =
        SdkClients.adminClient()
            .glossaryTerms()
            .create(
                termRequest(glossary, "Customer")
                    .withRealizedIn(
                        List.of(
                            realization(operational, AssetRealizationRole.PRIMARY_STORE),
                            realization(warehouse, AssetRealizationRole.DERIVED))));

    GlossaryTerm fetched =
        SdkClients.adminClient().glossaryTerms().get(customer.getId().toString(), REALIZED_IN);

    assertEquals(2, fetched.getRealizedIn().size());
    assertEquals(
        1,
        fetched.getRealizedIn().stream()
            .filter(realization -> realization.getRole() == AssetRealizationRole.PRIMARY_STORE)
            .count(),
        "a concept keeps exactly one store of record");
  }

  @Test
  void rejectsASecondStoreOfRecord(TestNamespace namespace) throws Exception {
    Glossary glossary = createGlossary(namespace);
    DatabaseSchema schema = createSchema(namespace);
    Table operational = createTable(namespace, schema, "customers");
    Table warehouse = createTable(namespace, schema, "dim_customer");
    CreateGlossaryTerm request =
        termRequest(glossary, "Customer")
            .withRealizedIn(
                List.of(
                    realization(operational, AssetRealizationRole.PRIMARY_STORE),
                    realization(warehouse, AssetRealizationRole.PRIMARY_STORE)));

    OpenMetadataException failure =
        assertThrows(
            OpenMetadataException.class,
            () -> SdkClients.adminClient().glossaryTerms().create(request));

    assertTrue(
        failure.getMessage().contains("PRIMARY_STORE"),
        "the failure names the conflicting role: " + failure.getMessage());
  }

  @Test
  void rejectsTheSameAssetListedTwice(TestNamespace namespace) throws Exception {
    Glossary glossary = createGlossary(namespace);
    DatabaseSchema schema = createSchema(namespace);
    Table warehouse = createTable(namespace, schema, "dim_customer");
    CreateGlossaryTerm request =
        termRequest(glossary, "Customer")
            .withRealizedIn(
                List.of(
                    realization(warehouse, AssetRealizationRole.PRIMARY_STORE),
                    realization(warehouse, AssetRealizationRole.DERIVED)));

    OpenMetadataException failure =
        assertThrows(
            OpenMetadataException.class,
            () -> SdkClients.adminClient().glossaryTerms().create(request));

    assertTrue(
        failure.getMessage().contains("more than once"),
        "the failure explains the duplicate: " + failure.getMessage());
  }

  @Test
  void replacesRealizationsOnUpdate(TestNamespace namespace) throws Exception {
    Glossary glossary = createGlossary(namespace);
    DatabaseSchema schema = createSchema(namespace);
    Table operational = createTable(namespace, schema, "customers");
    Table warehouse = createTable(namespace, schema, "dim_customer");
    GlossaryTerm customer =
        SdkClients.adminClient()
            .glossaryTerms()
            .create(
                termRequest(glossary, "Customer")
                    .withRealizedIn(
                        List.of(realization(operational, AssetRealizationRole.PRIMARY_STORE))));

    SdkClients.adminClient()
        .glossaryTerms()
        .update(
            customer.getId(),
            customer.withRealizedIn(List.of(realization(warehouse, AssetRealizationRole.REPLICA))));

    GlossaryTerm fetched =
        SdkClients.adminClient().glossaryTerms().get(customer.getId().toString(), REALIZED_IN);

    assertEquals(1, fetched.getRealizedIn().size(), "the previous realization is replaced");
    assertEquals(warehouse.getId(), fetched.getRealizedIn().getFirst().getAsset().getId());
    assertEquals(AssetRealizationRole.REPLICA, fetched.getRealizedIn().getFirst().getRole());
  }

  private AssetRealization realization(Table table, AssetRealizationRole role) {
    return new AssetRealization().withAsset(table.getEntityReference()).withRole(role);
  }

  private CreateGlossaryTerm termRequest(Glossary glossary, String name) {
    return new CreateGlossaryTerm()
        .withName(name)
        .withDescription("Concept realized by a data asset")
        .withGlossary(glossary.getFullyQualifiedName());
  }

  private Glossary createGlossary(TestNamespace namespace) throws Exception {
    return namespace.trackRoot(
        Entity.GLOSSARY,
        SdkClients.adminClient()
            .glossaries()
            .create(
                new CreateGlossary()
                    .withName(namespace.prefix("realizationGlossary"))
                    .withDescription("Concepts realized by data assets")));
  }

  private DatabaseSchema createSchema(TestNamespace namespace) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(namespace);

    return DatabaseSchemaTestFactory.createSimple(namespace, service);
  }

  private Table createTable(TestNamespace namespace, DatabaseSchema schema, String name)
      throws Exception {
    CreateTable request = new CreateTable();
    request.setName(namespace.shortPrefix(name));
    request.setDatabaseSchema(schema.getFullyQualifiedName());
    request.setColumns(List.of(ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build()));

    return SdkClients.adminClient().tables().create(request);
  }
}
