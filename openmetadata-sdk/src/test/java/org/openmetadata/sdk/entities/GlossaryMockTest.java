package org.openmetadata.sdk.entities;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.services.glossary.GlossaryService;
import org.openmetadata.sdk.services.glossary.GlossaryTermService;

/**
 * Mock tests for Glossary and GlossaryTerm entity operations.
 */
public class GlossaryMockTest {

  @Mock private OpenMetadataClient mockClient;
  @Mock private GlossaryService mockGlossaryService;
  @Mock private GlossaryTermService mockGlossaryTermService;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    when(mockClient.glossaries()).thenReturn(mockGlossaryService);
    when(mockClient.glossaryTerms()).thenReturn(mockGlossaryTermService);
    org.openmetadata.sdk.entities.Glossary.setDefaultClient(mockClient);
    org.openmetadata.sdk.entities.GlossaryTerm.setDefaultClient(mockClient);
  }

  @Test
  void testCreateGlossary() {
    // Arrange
    CreateGlossary createRequest = new CreateGlossary();
    createRequest.setName("business-glossary");
    createRequest.setDisplayName("Business Glossary");
    createRequest.setDescription("Company-wide business terms and definitions");

    Glossary expectedGlossary = new Glossary();
    expectedGlossary.setId(UUID.randomUUID());
    expectedGlossary.setName("business-glossary");
    expectedGlossary.setDisplayName("Business Glossary");
    expectedGlossary.setFullyQualifiedName("business-glossary");

    when(mockGlossaryService.create(any(CreateGlossary.class))).thenReturn(expectedGlossary);

    // Act
    Glossary result = org.openmetadata.sdk.entities.Glossary.create(createRequest);

    // Assert
    assertNotNull(result);
    assertEquals("business-glossary", result.getName());
    assertEquals("Business Glossary", result.getDisplayName());
    verify(mockGlossaryService).create(any(CreateGlossary.class));
  }

  @Test
  void testCreateGlossaryTerm() {
    // Arrange
    CreateGlossaryTerm createRequest = new CreateGlossaryTerm();
    createRequest.setName("customer-lifetime-value");
    createRequest.setDisplayName("Customer Lifetime Value");
    createRequest.setDescription("Total worth of a customer over their entire relationship");
    createRequest.setGlossary("business-glossary");
    createRequest.setSynonyms(List.of("CLV", "LTV"));

    GlossaryTerm expectedTerm = new GlossaryTerm();
    expectedTerm.setId(UUID.randomUUID());
    expectedTerm.setName("customer-lifetime-value");
    expectedTerm.setDisplayName("Customer Lifetime Value");
    expectedTerm.setFullyQualifiedName("business-glossary.customer-lifetime-value");
    expectedTerm.setSynonyms(List.of("CLV", "LTV"));

    when(mockGlossaryTermService.create(any(CreateGlossaryTerm.class))).thenReturn(expectedTerm);

    // Act
    GlossaryTerm result = org.openmetadata.sdk.entities.GlossaryTerm.create(createRequest);

    // Assert
    assertNotNull(result);
    assertEquals("customer-lifetime-value", result.getName());
    assertEquals("Customer Lifetime Value", result.getDisplayName());
    assertNotNull(result.getSynonyms());
    assertEquals(2, result.getSynonyms().size());
    verify(mockGlossaryTermService).create(any(CreateGlossaryTerm.class));
  }

  @Test
  void testRetrieveGlossary() {
    // Arrange
    String glossaryId = UUID.randomUUID().toString();
    Glossary expectedGlossary = new Glossary();
    expectedGlossary.setId(UUID.fromString(glossaryId));
    expectedGlossary.setName("technical-glossary");
    expectedGlossary.setUsageCount(150);

    when(mockGlossaryService.get(glossaryId)).thenReturn(expectedGlossary);

    // Act
    Glossary result = org.openmetadata.sdk.entities.Glossary.retrieve(glossaryId);

    // Assert
    assertNotNull(result);
    assertEquals(glossaryId, result.getId().toString());
    assertEquals("technical-glossary", result.getName());
    assertEquals(150, result.getUsageCount());
    verify(mockGlossaryService).get(glossaryId);
  }

  @Test
  void testRetrieveGlossaryTerm() {
    // Arrange
    String termId = UUID.randomUUID().toString();
    GlossaryTerm expectedTerm = new GlossaryTerm();
    expectedTerm.setId(UUID.fromString(termId));
    expectedTerm.setName("revenue");
    expectedTerm.setEntityStatus(EntityStatus.APPROVED);

    when(mockGlossaryTermService.get(termId)).thenReturn(expectedTerm);

    // Act
    GlossaryTerm result = org.openmetadata.sdk.entities.GlossaryTerm.retrieve(termId);

    // Assert
    assertNotNull(result);
    assertEquals(termId, result.getId().toString());
    assertEquals("revenue", result.getName());
    assertEquals(EntityStatus.APPROVED, result.getEntityStatus());
    verify(mockGlossaryTermService).get(termId);
  }

  @Test
  void testRetrieveGlossaryTermWithRelations() {
    // Arrange
    String termId = UUID.randomUUID().toString();
    String fields = "relatedTerms,reviewers,children";
    GlossaryTerm expectedTerm = new GlossaryTerm();
    expectedTerm.setId(UUID.fromString(termId));
    expectedTerm.setName("profit");

    // Mock related terms
    EntityReference relatedTerm = new EntityReference();
    relatedTerm.setName("revenue");
    relatedTerm.setType("glossaryTerm");
    expectedTerm.setRelatedTerms(List.of(relatedTerm));

    when(mockGlossaryTermService.get(termId, fields)).thenReturn(expectedTerm);

    // Act
    GlossaryTerm result = org.openmetadata.sdk.entities.GlossaryTerm.retrieve(termId, fields);

    // Assert
    assertNotNull(result);
    assertNotNull(result.getRelatedTerms());
    assertEquals(1, result.getRelatedTerms().size());
    assertEquals("revenue", result.getRelatedTerms().get(0).getName());
    verify(mockGlossaryTermService).get(termId, fields);
  }

  @Test
  void testUpdateGlossary() {
    // Arrange
    Glossary glossaryToUpdate = new Glossary();
    glossaryToUpdate.setId(UUID.randomUUID());
    glossaryToUpdate.setName("data-glossary");
    glossaryToUpdate.setDescription("Updated data glossary with new terms");

    // Add tags
    TagLabel tag = new TagLabel();
    tag.setTagFQN("Governance.DataGovernance");
    glossaryToUpdate.setTags(List.of(tag));

    Glossary expectedGlossary = new Glossary();
    expectedGlossary.setId(glossaryToUpdate.getId());
    expectedGlossary.setName(glossaryToUpdate.getName());
    expectedGlossary.setDescription(glossaryToUpdate.getDescription());
    expectedGlossary.setTags(glossaryToUpdate.getTags());

    when(mockGlossaryService.update(glossaryToUpdate.getId().toString(), glossaryToUpdate))
        .thenReturn(expectedGlossary);

    // Act
    Glossary result =
        org.openmetadata.sdk.entities.Glossary.update(
            glossaryToUpdate.getId().toString(), glossaryToUpdate);

    // Assert
    assertNotNull(result);
    assertEquals("Updated data glossary with new terms", result.getDescription());
    assertNotNull(result.getTags());
    assertEquals("Governance.DataGovernance", result.getTags().get(0).getTagFQN());
    verify(mockGlossaryService).update(glossaryToUpdate.getId().toString(), glossaryToUpdate);
  }

  @Test
  void testUpdateGlossaryTerm() {
    // Arrange
    GlossaryTerm termToUpdate = new GlossaryTerm();
    termToUpdate.setId(UUID.randomUUID());
    termToUpdate.setName("churn-rate");
    termToUpdate.setDescription("Updated definition of customer churn rate");
    termToUpdate.setEntityStatus(EntityStatus.APPROVED);

    GlossaryTerm expectedTerm = new GlossaryTerm();
    expectedTerm.setId(termToUpdate.getId());
    expectedTerm.setName(termToUpdate.getName());
    expectedTerm.setDescription(termToUpdate.getDescription());
    expectedTerm.setEntityStatus(termToUpdate.getEntityStatus());

    when(mockGlossaryTermService.update(termToUpdate.getId().toString(), termToUpdate))
        .thenReturn(expectedTerm);

    // Act
    GlossaryTerm result =
        org.openmetadata.sdk.entities.GlossaryTerm.update(
            termToUpdate.getId().toString(), termToUpdate);

    // Assert
    assertNotNull(result);
    assertEquals("Updated definition of customer churn rate", result.getDescription());
    assertEquals(EntityStatus.APPROVED, result.getEntityStatus());
    verify(mockGlossaryTermService).update(termToUpdate.getId().toString(), termToUpdate);
  }

  @Test
  void testDeleteGlossary() {
    // Arrange
    String glossaryId = UUID.randomUUID().toString();
    doNothing().when(mockGlossaryService).delete(eq(glossaryId), any());

    // Act
    org.openmetadata.sdk.entities.Glossary.delete(glossaryId);

    // Assert
    verify(mockGlossaryService).delete(eq(glossaryId), any());
  }

  @Test
  void testDeleteGlossaryTerm() {
    // Arrange
    String termId = UUID.randomUUID().toString();
    doNothing().when(mockGlossaryTermService).delete(eq(termId), any());

    // Act
    org.openmetadata.sdk.entities.GlossaryTerm.delete(termId);

    // Assert
    verify(mockGlossaryTermService).delete(eq(termId), any());
  }
}
