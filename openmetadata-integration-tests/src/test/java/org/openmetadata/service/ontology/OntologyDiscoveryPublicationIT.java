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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.OntologyChangeSetTestSupport;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.OntologyDomainDraftRequest;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.AssetRealizationRole;
import org.openmetadata.schema.type.OntologyAttributeDataType;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.schema.type.OntologyDiscoveryContext;
import org.openmetadata.schema.type.OntologyDiscoveryEvidence;
import org.openmetadata.schema.type.OntologyDiscoveryProposal;
import org.openmetadata.schema.type.OntologyProposedBinding;
import org.openmetadata.schema.type.OntologyProposedClass;
import org.openmetadata.schema.type.OntologyProposedProperty;
import org.openmetadata.schema.type.OntologyProposedRelationship;
import org.openmetadata.schema.type.OntologySourceColumn;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.RelationshipTypeRepository;

/** Compiler-to-publication contract using real catalog APIs, without requiring a live LLM. */
@ExtendWith(TestNamespaceExtension.class)
class OntologyDiscoveryPublicationIT {
  @Test
  void qualityEvidenceUsesTheOwningTableAndTheTestCasesOwnVersion(TestNamespace ns) {
    final OpenMetadataClient client = SdkClients.adminClient();
    // A basic test suite's name contains the table FQN and must fit MySQL's name column.
    final var serviceEntity =
        DatabaseServiceTestFactory.createPostgresWithName(ns.shortPrefix("pg"), ns);
    final String schema =
        DatabaseSchemaTestFactory.createSimpleWithName(ns.shortPrefix("sc"), ns, serviceEntity)
            .getFullyQualifiedName();
    final Table table =
        TableTestFactory.createSimpleWithName(ns.shortPrefix("quality"), ns, schema);
    final var testCase =
        ns.trackRoot(
            "testCase",
            TestCaseBuilder.create(client)
                .name(ns.shortPrefix("row_count"))
                .forTable(table)
                .testDefinition("tableRowCountToEqual")
                .parameter("value", "100")
                .create());
    final OntologyAiCatalog catalog =
        new OpenMetadataOntologyAiCatalog(
            (GlossaryRepository) Entity.getEntityRepository(Entity.GLOSSARY),
            (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM),
            (RelationshipTypeRepository) Entity.getEntityRepository(Entity.RELATIONSHIP_TYPE));
    final var evidence =
        new OntologyDiscoveryEvidence()
            .withEntityType("testCase")
            .withFullyQualifiedName(testCase.getFullyQualifiedName())
            .withSourceVersion(testCase.getVersion())
            .withUpdatedAt(testCase.getUpdatedAt());
    final String service = table.getService().getFullyQualifiedName();
    catalog.validateDiscoveryEvidence(evidence, service);
    assertThrows(
        IllegalArgumentException.class,
        () -> catalog.validateDiscoveryEvidence(evidence, "anotherService"));
    evidence.setSourceVersion(testCase.getVersion() + 0.1);
    assertThrows(
        IllegalArgumentException.class, () -> catalog.validateDiscoveryEvidence(evidence, service));
  }

  @Test
  void publishesCustomerAndOrderPropertiesColumnsAndRelationships(TestNamespace ns) {
    final OpenMetadataClient client = SdkClients.adminClient();
    final Glossary glossary = GlossaryTestFactory.createSimple(ns);
    final String schema = DatabaseSchemaTestFactory.createSimple(ns).getFullyQualifiedName();
    final Table customerTable = TableTestFactory.createWithName(ns, schema, "customers");
    final Table orderTable = TableTestFactory.createWithName(ns, schema, "orders");
    final RelationshipType relationType = client.relationshipTypes().getByName("relatedTo");
    final SdkCatalog catalog = new SdkCatalog(client);
    final var request =
        new OntologyDomainDraftRequest()
            .withGlossary(glossary.getFullyQualifiedName())
            .withChangeSetName(ns.prefix("completeDraft"))
            .withDisplayName("Customer and Order")
            .withDescription("Typed discovery publication fixture")
            .withMaxConcepts(2)
            .withDiscoveryContext(
                new OntologyDiscoveryContext()
                    .withServiceFqn(customerTable.getService().getFullyQualifiedName())
                    .withEvidenceFingerprint("a".repeat(64))
                    .withEvidence(List.of(evidence(customerTable), evidence(orderTable))))
            .withProposal(
                new OntologyDiscoveryProposal()
                    .withClasses(
                        List.of(concept("Customer", customerTable), concept("Order", orderTable)))
                    .withRelationships(
                        List.of(
                            new OntologyProposedRelationship()
                                .withFromKey("Order")
                                .withToKey("Customer")
                                .withRelationshipTypeId(relationType.getId())
                                .withEvidenceFqns(Set.of(orderTable.getFullyQualifiedName())))));
    final var draft =
        new OntologyDiscoveryProposalCompiler(
                catalog, request, glossary, System.currentTimeMillis())
            .compile();
    // The service stamps/validates discovery provenance separately. This fixture exercises the
    // exact compiled operations through durable review and application without an enabled LLM.
    draft.getOperations().forEach(operation -> operation.setEvidenceFingerprint(null));
    final var changeSet =
        ns.trackRoot("ontologyChangeSet", client.ontologyChangeSets().create(draft));
    final var applied =
        OntologyChangeSetTestSupport.applyOntologyChangeSet(client, changeSet, ns, "reviewer");
    assertEquals(OntologyChangeSetState.APPLIED, applied.getState());
    final GlossaryTerm customer =
        client
            .glossaryTerms()
            .getByName(glossary.getFullyQualifiedName() + ".Customer", "attributes,realizedIn");
    final GlossaryTerm order =
        client
            .glossaryTerms()
            .getByName(
                glossary.getFullyQualifiedName() + ".Order", "attributes,realizedIn,relatedTerms");
    assertEquals(
        OntologyAttributeDataType.INTEGER, customer.getAttributes().getFirst().getDataType());
    assertTrue(customer.getAttributes().getFirst().getIsIdentifier());
    assertEquals(
        customerTable.getFullyQualifiedName() + ".id",
        customer.getAttributes().getFirst().getSourceColumns().getFirst().getColumnFqn());
    assertEquals(customerTable.getId(), customer.getRealizedIn().getFirst().getAsset().getId());
    assertEquals(orderTable.getId(), order.getRealizedIn().getFirst().getAsset().getId());
    assertTrue(
        order.getRelatedTerms().stream()
            .anyMatch(relation -> relation.getTerm().getId().equals(customer.getId())));
  }

  private static OntologyProposedClass concept(String name, Table table) {
    final String fqn = table.getFullyQualifiedName();
    return new OntologyProposedClass()
        .withKey(name)
        .withName(name)
        .withDescription(name + " business class")
        .withEvidenceFqns(Set.of(fqn))
        .withTableBindings(
            List.of(
                new OntologyProposedBinding()
                    .withTableFqn(fqn)
                    .withRole(AssetRealizationRole.PRIMARY_STORE)))
        .withProperties(
            List.of(
                new OntologyProposedProperty()
                    .withName("id")
                    .withDataType(OntologyAttributeDataType.INTEGER)
                    .withIsIdentifier(true)
                    .withEvidenceFqns(Set.of(fqn))
                    .withSourceColumns(
                        List.of(
                            new OntologySourceColumn()
                                .withTableFqn(fqn)
                                .withColumnFqn(fqn + ".id")))));
  }

  private static OntologyDiscoveryEvidence evidence(Table table) {
    return new OntologyDiscoveryEvidence()
        .withEntityType("table")
        .withFullyQualifiedName(table.getFullyQualifiedName())
        .withSourceVersion(table.getVersion())
        .withUpdatedAt(table.getUpdatedAt());
  }

  private record SdkCatalog(OpenMetadataClient client) implements OntologyAiCatalog {
    public Glossary glossary(String fqn) {
      return client.glossaries().getByName(fqn);
    }

    public GlossaryTerm term(UUID id) {
      return client.glossaryTerms().get(id.toString(), "glossary,attributes,realizedIn");
    }

    public RelationshipType relationshipType(UUID id) {
      return client.relationshipTypes().get(id.toString());
    }

    public Table table(String fqn) {
      return client.tables().getByName(fqn, "service,columns");
    }

    public void validateDiscoveryEvidence(OntologyDiscoveryEvidence evidence, String service) {
      final Table current = table(evidence.getFullyQualifiedName());
      assertEquals(service, current.getService().getFullyQualifiedName());
      assertEquals(evidence.getSourceVersion(), current.getVersion());
    }
  }
}
