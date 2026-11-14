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
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.services.glossary.GlossaryTermService;

/**
 * Mock tests for GlossaryTerm entity operations.
 */
public class GlossaryMockTest {

  @Mock private OpenMetadataClient mockClient;
  @Mock private GlossaryTermService mockGlossaryTermService;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    when(mockClient.glossaryTerms()).thenReturn(mockGlossaryTermService);
    org.openmetadata.sdk.entities.GlossaryTerm.setDefaultClient(mockClient);
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

    // Mock related terms using TermRelation
    EntityReference relatedTermRef = new EntityReference();
    relatedTermRef.setName("revenue");
    relatedTermRef.setType("glossaryTerm");
    TermRelation termRelation = new TermRelation();
    termRelation.setTerm(relatedTermRef);
    termRelation.setRelationType("relatedTo");
    expectedTerm.setRelatedTerms(List.of(termRelation));

    when(mockGlossaryTermService.get(termId, fields)).thenReturn(expectedTerm);

    // Act
    GlossaryTerm result = org.openmetadata.sdk.entities.GlossaryTerm.retrieve(termId, fields);

    // Assert
    assertNotNull(result);
    assertNotNull(result.getRelatedTerms());
    assertEquals(1, result.getRelatedTerms().size());
    assertEquals("revenue", result.getRelatedTerms().get(0).getTerm().getName());
    verify(mockGlossaryTermService).get(termId, fields);
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
