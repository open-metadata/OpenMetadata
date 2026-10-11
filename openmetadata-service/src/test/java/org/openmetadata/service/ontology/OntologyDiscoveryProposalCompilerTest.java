/*
 * Copyright 2026 Collate
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the
 * License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.
 */
package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.OntologyDomainDraftRequest;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.AssetRealization;
import org.openmetadata.schema.type.AssetRealizationRole;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyAttribute;
import org.openmetadata.schema.type.OntologyAttributeDataType;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyDiscoveryContext;
import org.openmetadata.schema.type.OntologyDiscoveryEvidence;
import org.openmetadata.schema.type.OntologyDiscoveryProposal;
import org.openmetadata.schema.type.OntologyProposedBinding;
import org.openmetadata.schema.type.OntologyProposedClass;
import org.openmetadata.schema.type.OntologyProposedProperty;
import org.openmetadata.schema.type.OntologyProposedRelationship;
import org.openmetadata.schema.type.OntologySourceColumn;

class OntologyDiscoveryProposalCompilerTest {
  private final OntologyAiCatalog catalog = mock(OntologyAiCatalog.class);
  private final Glossary glossary =
      new Glossary()
          .withId(UUID.randomUUID())
          .withName("Business")
          .withFullyQualifiedName("Business");
  private final String tableFqn = "warehouse.db.public.customers";
  private OntologyDomainDraftRequest request;

  @BeforeEach
  void setup() {
    final Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("customers")
            .withFullyQualifiedName(tableFqn)
            .withService(new EntityReference().withFullyQualifiedName("warehouse"))
            .withColumns(
                List.of(new Column().withName("id").withFullyQualifiedName(tableFqn + ".id")));
    when(catalog.table(tableFqn)).thenReturn(table);
    request =
        new OntologyDomainDraftRequest()
            .withGlossary("Business")
            .withChangeSetName("discovery")
            .withDisplayName("Discovery")
            .withDescription("Review")
            .withMaxConcepts(10)
            .withDiscoveryContext(
                new OntologyDiscoveryContext()
                    .withServiceFqn("warehouse")
                    .withEvidenceFingerprint("a".repeat(64))
                    .withEvidence(
                        List.of(
                            new OntologyDiscoveryEvidence()
                                .withEntityType("table")
                                .withFullyQualifiedName(tableFqn)
                                .withSourceVersion(1.2))))
            .withProposal(
                new OntologyDiscoveryProposal().withClasses(List.of(candidate("Customer"))));
  }

  @Test
  void customerOrderProposalRetainsPropertiesBindingsRelationshipsAndEvidence() {
    final UUID relationshipTypeId = UUID.randomUUID();
    when(catalog.relationshipType(relationshipTypeId))
        .thenReturn(
            new RelationshipType()
                .withId(relationshipTypeId)
                .withName("places")
                .withFullyQualifiedName("places"));
    request.getProposal().setClasses(List.of(candidate("Customer"), candidate("Order")));
    request
        .getProposal()
        .setRelationships(
            List.of(
                new OntologyProposedRelationship()
                    .withFromKey("Customer")
                    .withToKey("Order")
                    .withRelationshipTypeId(relationshipTypeId)
                    .withEvidenceFqns(Set.of(tableFqn))));
    final var draft = compiler().compile();
    assertEquals(
        List.of(
            OntologyChangeOperationType.CREATE_TERM,
            OntologyChangeOperationType.UPSERT_ATTRIBUTE,
            OntologyChangeOperationType.BIND_ASSET,
            OntologyChangeOperationType.CREATE_TERM,
            OntologyChangeOperationType.UPSERT_ATTRIBUTE,
            OntologyChangeOperationType.BIND_ASSET,
            OntologyChangeOperationType.ADD_RELATIONSHIP),
        draft.getOperations().stream().map(op -> op.getOperationType()).toList());
    final var property = draft.getOperations().get(1);
    assertEquals("id", property.getAttribute().getName());
    assertTrue(property.getAttribute().getIsIdentifier());
    assertEquals(
        tableFqn + ".id", property.getAttribute().getSourceColumns().getFirst().getColumnFqn());
    assertEquals(1.2, property.getDiscoveryEvidence().getFirst().getSourceVersion());
    assertEquals(draft.getOperations(), compiler().compile().getOperations());
  }

  @Test
  void reconciledPropertiesKeepPublishedIdsAndUseTheObservedBaseVersion() {
    final UUID termId = UUID.randomUUID();
    final UUID propertyId = UUID.randomUUID();
    final EntityReference tableReference = catalog.table(tableFqn).getEntityReference();
    when(catalog.term(termId))
        .thenReturn(
            new GlossaryTerm()
                .withId(termId)
                .withName("Customer")
                .withFullyQualifiedName("Business.Customer")
                .withGlossary(glossary.getEntityReference())
                .withVersion(1.2)
                .withAttributes(
                    List.of(
                        new OntologyAttribute()
                            .withId(propertyId)
                            .withName("id")
                            .withIri(URI.create("https://example.org/customerId"))
                            .withDescription("Existing description")
                            .withUnit("identifier")))
                .withRealizedIn(
                    List.of(
                        new AssetRealization()
                            .withId(UUID.randomUUID())
                            .withAsset(tableReference)
                            .withRole(AssetRealizationRole.PRIMARY_STORE))));
    final var candidate =
        request
            .getProposal()
            .getClasses()
            .getFirst()
            .withExistingTermId(termId)
            .withBaseVersion(1.2);
    final var operations = compiler().compile().getOperations();
    assertEquals(2, operations.size());
    assertEquals(propertyId, operations.getFirst().getAttribute().getId());
    assertEquals(termId, operations.getFirst().getTargetId());
    assertEquals(1.2, operations.getFirst().getBaseVersion());
    assertEquals(
        URI.create("https://example.org/customerId"),
        operations.getFirst().getAttribute().getIri());
    assertEquals("Existing description", operations.getFirst().getAttribute().getDescription());
    assertEquals("identifier", operations.getFirst().getAttribute().getUnit());
    assertEquals(
        catalog.term(termId).getRealizedIn().getFirst().getId(),
        operations.getLast().getAssetBinding().getId());
    candidate.setBaseVersion(1.1);
    assertThrows(IllegalArgumentException.class, () -> compiler().compile());
  }

  @Test
  void parentAndNestedColumnsRetainTheirExactCatalogIdentity() {
    final var table = catalog.table(tableFqn);
    table
        .getColumns()
        .getFirst()
        .setChildren(
            List.of(
                new Column().withName("nested").withFullyQualifiedName(tableFqn + ".id.nested")));
    final var child = candidate("CustomerDetail").withParentKey("Customer");
    child
        .getProperties()
        .getFirst()
        .getSourceColumns()
        .getFirst()
        .setColumnFqn(tableFqn + ".id.nested");
    child.getProperties().getFirst().withDescription("Nested identity").withUnit("count");
    request.getProposal().setClasses(List.of(candidate("Customer"), child));
    final var operations = compiler().compile().getOperations();
    assertEquals(
        "Business.Customer.CustomerDetail", operations.get(3).getTerm().getFullyQualifiedName());
    assertEquals(
        operations.getFirst().getTerm().getId(), operations.get(3).getTerm().getParent().getId());
    assertEquals("Nested identity", operations.get(4).getAttribute().getDescription());
    assertEquals("count", operations.get(4).getAttribute().getUnit());
    assertNull(operations.get(4).getBaseVersion());
  }

  @Test
  void duplicateKeysIdentitiesAndPropertiesAreRejected() {
    final var first = candidate("Customer");
    request.getProposal().setClasses(List.of(first, candidate("Customer")));
    assertThrows(IllegalArgumentException.class, () -> compiler().compile());
    request.getProposal().getClasses().getLast().setKey("another-key");
    assertThrows(IllegalArgumentException.class, () -> compiler().compile());
    request.getProposal().setClasses(List.of(first));
    first.setProperties(
        List.of(first.getProperties().getFirst(), first.getProperties().getFirst()));
    assertThrows(IllegalArgumentException.class, () -> compiler().compile());
  }

  @Test
  void invalidNewClassVersionsParentsAndBoundsAreRejected() {
    final var candidate = request.getProposal().getClasses().getFirst();
    candidate.setBaseVersion(1.0);
    assertThrows(IllegalArgumentException.class, () -> compiler().compile());
    candidate.setBaseVersion(null);
    candidate.setParentKey("later-or-unknown");
    assertThrows(IllegalArgumentException.class, () -> compiler().compile());
    candidate.setParentKey(null);
    request.setMaxConcepts(0);
    assertThrows(IllegalArgumentException.class, () -> compiler().compile());
    request.setMaxConcepts(10);
    request.getProposal().setClasses(List.of());
    assertThrows(IllegalArgumentException.class, () -> compiler().compile());
    request.setDiscoveryContext(null);
    assertThrows(IllegalArgumentException.class, () -> compiler().compile());
  }

  @Test
  void everyBindingNeedsEvidenceAndAnActualSameServiceTable() {
    final var candidate = request.getProposal().getClasses().getFirst();
    candidate.setEvidenceFqns(Set.of());
    assertThrows(IllegalArgumentException.class, () -> compiler().compile());
    candidate.setEvidenceFqns(Set.of(tableFqn));
    request.getDiscoveryContext().getEvidence().getFirst().setEntityType("testCase");
    assertThrows(IllegalArgumentException.class, () -> compiler().compile());
    request.getDiscoveryContext().getEvidence().getFirst().setEntityType("table");
    final var table = catalog.table(tableFqn);
    table.setService(null);
    assertThrows(IllegalArgumentException.class, () -> compiler().compile());
    table.setService(new EntityReference().withFullyQualifiedName("anotherService"));
    assertThrows(IllegalArgumentException.class, () -> compiler().compile());
  }

  @Test
  void existingClassIdentityGlossaryAndParentCannotBeSilentlyChanged() {
    final var termId = UUID.randomUUID();
    final var existing =
        new GlossaryTerm()
            .withId(termId)
            .withName("Customer")
            .withFullyQualifiedName("Business.Customer")
            .withVersion(1.2)
            .withGlossary(glossary.getEntityReference());
    when(catalog.term(termId)).thenReturn(existing);
    final var candidate =
        request
            .getProposal()
            .getClasses()
            .getFirst()
            .withExistingTermId(termId)
            .withBaseVersion(1.2);
    candidate.setName("Renamed");
    assertThrows(IllegalArgumentException.class, () -> compiler().compile());
    candidate.setName("Customer");
    candidate.setParentKey("another-parent");
    assertThrows(IllegalArgumentException.class, () -> compiler().compile());
    candidate.setParentKey(null);
    existing.setGlossary(new EntityReference().withId(UUID.randomUUID()));
    assertThrows(IllegalArgumentException.class, () -> compiler().compile());
    existing.setGlossary(glossary.getEntityReference());
    candidate.setProperties(List.of());
    candidate.setTableBindings(List.of());
    assertThrows(IllegalArgumentException.class, () -> compiler().compile());
  }

  @Test
  void unknownColumnsAndMissingPropertyEvidenceFailClosed() {
    final var property = request.getProposal().getClasses().getFirst().getProperties().getFirst();
    property.getSourceColumns().getFirst().setColumnFqn(tableFqn + ".missing");
    assertThrows(IllegalArgumentException.class, () -> compiler().compile());
    property.getSourceColumns().getFirst().setColumnFqn(tableFqn + ".id");
    property.setEvidenceFqns(Set.of("another.table"));
    assertThrows(IllegalArgumentException.class, () -> compiler().compile());
  }

  private OntologyProposedClass candidate(final String name) {
    return new OntologyProposedClass()
        .withKey(name)
        .withName(name)
        .withDescription(name)
        .withEvidenceFqns(Set.of(tableFqn))
        .withTableBindings(
            List.of(
                new OntologyProposedBinding()
                    .withTableFqn(tableFqn)
                    .withRole(AssetRealizationRole.PRIMARY_STORE)))
        .withProperties(
            List.of(
                new OntologyProposedProperty()
                    .withName("id")
                    .withDataType(OntologyAttributeDataType.INTEGER)
                    .withIsIdentifier(true)
                    .withEvidenceFqns(Set.of(tableFqn))
                    .withSourceColumns(
                        List.of(
                            new OntologySourceColumn()
                                .withTableFqn(tableFqn)
                                .withColumnFqn(tableFqn + ".id")))));
  }

  private OntologyDiscoveryProposalCompiler compiler() {
    return new OntologyDiscoveryProposalCompiler(catalog, request, glossary, 123L);
  }
}
