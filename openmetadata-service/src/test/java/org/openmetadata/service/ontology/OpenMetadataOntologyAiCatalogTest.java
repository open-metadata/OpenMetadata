/*
 * Copyright 2026 Collate
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the
 * License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.
 */
package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyDiscoveryEvidence;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.RelationshipTypeRepository;

class OpenMetadataOntologyAiCatalogTest {
  @Test
  void qualityEvidenceUsesItsOwnVersionAndItsOwningTablesService() {
    final String tableFqn = "warehouse.db.public.customers";
    final String testFqn = tableFqn + ".email.notNull";
    final TestCase testCase =
        new TestCase()
            .withEntityLink("<#E::table::" + tableFqn + "::columns::email>")
            .withVersion(1.2)
            .withUpdatedAt(123L);
    final Table table =
        new Table()
            .withVersion(4.0)
            .withService(new EntityReference().withFullyQualifiedName("warehouse"));
    final OntologyDiscoveryEvidence evidence =
        new OntologyDiscoveryEvidence()
            .withEntityType(Entity.TEST_CASE)
            .withFullyQualifiedName(testFqn)
            .withSourceVersion(1.2)
            .withUpdatedAt(123L);
    final OpenMetadataOntologyAiCatalog catalog =
        new OpenMetadataOntologyAiCatalog(
            mock(GlossaryRepository.class),
            mock(GlossaryTermRepository.class),
            mock(RelationshipTypeRepository.class));
    try (var entities = mockStatic(Entity.class)) {
      entities
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.TEST_CASE, testFqn, "entityLink", Include.NON_DELETED))
          .thenReturn(testCase);
      entities
          .when(
              () -> Entity.getEntityByName(Entity.TABLE, tableFqn, "service", Include.NON_DELETED))
          .thenReturn(table);
      assertDoesNotThrow(() -> catalog.validateDiscoveryEvidence(evidence, "warehouse"));
      assertThrows(
          IllegalArgumentException.class,
          () -> catalog.validateDiscoveryEvidence(evidence, "anotherService"));
      evidence.setSourceVersion(1.1);
      assertThrows(
          IllegalArgumentException.class,
          () -> catalog.validateDiscoveryEvidence(evidence, "warehouse"));
      evidence.setSourceVersion(1.2);
      evidence.setUpdatedAt(122L);
      assertThrows(
          IllegalArgumentException.class,
          () -> catalog.validateDiscoveryEvidence(evidence, "warehouse"));
    }
  }
}
