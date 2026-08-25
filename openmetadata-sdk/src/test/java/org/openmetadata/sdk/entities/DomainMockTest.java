package org.openmetadata.sdk.entities;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.mockito.MockitoAnnotations;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.services.domains.DomainService;

/**
 * Unit tests for Domain using mocking
 */
public class DomainMockTest {

  @Mock private OpenMetadataClient mockClient;
  @Mock private DomainService mockDomainService;
  private AutoCloseable closeable;
  private MockedStatic<OpenMetadata> mockedOpenMetadata;

  @BeforeEach
  void setUp() {
    closeable = MockitoAnnotations.openMocks(this);
    when(mockClient.domains()).thenReturn(mockDomainService);
    mockedOpenMetadata = Mockito.mockStatic(OpenMetadata.class);
    mockedOpenMetadata.when(OpenMetadata::client).thenReturn(mockClient);
  }

  @AfterEach
  void tearDown() throws Exception {
    if (mockedOpenMetadata != null) {
      mockedOpenMetadata.close();
    }
    if (closeable != null) {
      closeable.close();
    }
  }

  @Test
  void testCreateDomain() {
    // Arrange
    CreateDomain createRequest = new CreateDomain();
    createRequest.setName("Marketing");
    createRequest.setDisplayName("Marketing Domain");
    createRequest.setDescription("Domain for all marketing assets");
    createRequest.setDomainType(CreateDomain.DomainType.AGGREGATE);

    Domain expectedDomain = new Domain();
    expectedDomain.setId(UUID.randomUUID());
    expectedDomain.setName("Marketing");
    expectedDomain.setDisplayName("Marketing Domain");
    expectedDomain.setFullyQualifiedName("Marketing");

    when(mockDomainService.create(any(CreateDomain.class))).thenReturn(expectedDomain);

    // Act
    org.openmetadata.sdk.entities.Domain result =
        org.openmetadata.sdk.entities.Domain.create(createRequest);

    // Assert
    assertNotNull(result);
    assertEquals("Marketing", result.getName());
    assertEquals("Marketing Domain", result.getDisplayName());
    verify(mockDomainService).create(any(CreateDomain.class));
  }

  @Test
  void testRetrieveDomain() {
    // Arrange
    String domainId = UUID.randomUUID().toString();
    Domain expectedDomain = new Domain();
    expectedDomain.setId(UUID.fromString(domainId));
    expectedDomain.setName("Sales");
    expectedDomain.setExperts(List.of());

    when(mockDomainService.get(domainId)).thenReturn(expectedDomain);

    // Act
    org.openmetadata.sdk.entities.Domain result =
        org.openmetadata.sdk.entities.Domain.retrieve(domainId);

    // Assert
    assertNotNull(result);
    assertEquals(domainId, result.getId().toString());
    assertEquals("Sales", result.getName());
    assertNotNull(result.getExperts());
    verify(mockDomainService).get(domainId);
  }

  @Test
  void testRetrieveDomainByName() {
    // Arrange
    String name = "Finance";
    org.openmetadata.sdk.entities.Domain expectedDomain =
        new org.openmetadata.sdk.entities.Domain();
    expectedDomain.setName(name);
    expectedDomain.setFullyQualifiedName(name);

    when(mockDomainService.getByName(name)).thenReturn(expectedDomain);

    // Act
    org.openmetadata.sdk.entities.Domain result =
        org.openmetadata.sdk.entities.Domain.retrieveByName(name);

    // Assert
    assertNotNull(result);
    assertEquals(name, result.getFullyQualifiedName());
    verify(mockDomainService).getByName(name);
  }

  @Test
  void testUpdateDomain() {
    // Arrange
    Domain domainToUpdate = new Domain();
    domainToUpdate.setId(UUID.randomUUID());
    domainToUpdate.setName("HumanResources");
    domainToUpdate.setDescription("Updated HR domain description");

    Domain expectedDomain = new Domain();
    expectedDomain.setId(domainToUpdate.getId());
    expectedDomain.setName(domainToUpdate.getName());
    expectedDomain.setDescription(domainToUpdate.getDescription());

    when(mockDomainService.update(domainToUpdate.getId().toString(), domainToUpdate))
        .thenReturn(expectedDomain);

    // Act
    org.openmetadata.sdk.entities.Domain result =
        org.openmetadata.sdk.entities.Domain.update(
            domainToUpdate.getId().toString(), domainToUpdate);

    // Assert
    assertNotNull(result);
    assertEquals("Updated HR domain description", result.getDescription());
    verify(mockDomainService).update(domainToUpdate.getId().toString(), domainToUpdate);
  }

  @Test
  void testRetrieveDomainWithChildren() {
    // Arrange
    String parentDomainId = UUID.randomUUID().toString();
    String parentName = "Engineering";
    String fields = "children,parent";

    // Create parent domain
    Domain parentDomain = new Domain();
    parentDomain.setId(UUID.fromString(parentDomainId));
    parentDomain.setName(parentName);
    parentDomain.setFullyQualifiedName(parentName);
    parentDomain.setDomainType(CreateDomain.DomainType.AGGREGATE);

    // Create child domains
    Domain childDomain1 = new Domain();
    childDomain1.setId(UUID.randomUUID());
    childDomain1.setName("Backend");
    childDomain1.setFullyQualifiedName(parentName + ".Backend");
    childDomain1.setDomainType(CreateDomain.DomainType.AGGREGATE);
    childDomain1.setParent(createDomainReference(parentDomain));

    Domain childDomain2 = new Domain();
    childDomain2.setId(UUID.randomUUID());
    childDomain2.setName("Frontend");
    childDomain2.setFullyQualifiedName(parentName + ".Frontend");
    childDomain2.setDomainType(CreateDomain.DomainType.AGGREGATE);
    childDomain2.setParent(createDomainReference(parentDomain));

    // Set children on parent
    parentDomain.setChildren(
        List.of(createDomainReference(childDomain1), createDomainReference(childDomain2)));

    // Set up mocks
    when(OpenMetadata.client()).thenReturn(mockClient);
    when(mockClient.domains()).thenReturn(mockDomainService);

    when(mockDomainService.get(parentDomainId)).thenReturn(parentDomain);

    // Also set up the mock for get with fields in case it's needed
    when(mockDomainService.get(parentDomainId, fields)).thenReturn(parentDomain);

    // Act - Retrieve parent domain with children
    Domain result = Domain.retrieve(parentDomainId);

    // Assert
    assertNotNull(result, "Retrieved domain should not be null");
    assertEquals(parentName, result.getName(), "Domain name should match");

    if (result.getChildren() != null) {
      assertEquals(2, result.getChildren().size(), "Should have 2 child domains");
      org.openmetadata.schema.type.EntityReference child1 = result.getChildren().getFirst();
      assertEquals("Backend", child1.getName(), "First child name should match");
      assertTrue(
          child1.getFullyQualifiedName().startsWith(parentName + "."),
          "Child FQN should be prefixed with parent name");

      org.openmetadata.schema.type.EntityReference child2 = result.getChildren().get(1);
      assertEquals("Frontend", child2.getName(), "Second child name should match");
      assertTrue(
          child2.getFullyQualifiedName().startsWith(parentName + "."),
          "Child FQN should be prefixed with parent name");
    }
    verify(mockDomainService).get(parentDomainId);
  }

  private org.openmetadata.schema.type.EntityReference createDomainReference(Domain domain) {
    return new org.openmetadata.schema.type.EntityReference()
        .withId(domain.getId())
        .withName(domain.getName())
        .withFullyQualifiedName(domain.getFullyQualifiedName())
        .withType("domain");
  }

  @Test
  void testDeleteDomain() {
    // Arrange
    String domainId = UUID.randomUUID().toString();
    doNothing().when(mockDomainService).delete(eq(domainId), any());

    // Act
    org.openmetadata.sdk.entities.Domain.delete(domainId, false, true);

    // Assert
    verify(mockDomainService).delete(eq(domainId), any());
  }
}
