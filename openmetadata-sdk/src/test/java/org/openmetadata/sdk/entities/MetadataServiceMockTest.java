package org.openmetadata.sdk.entities;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.mockito.MockitoAnnotations;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.services.services.MetadataServiceService;

/**
 * Mock tests for {@link MetadataService} facade operations.
 *
 * <p>See {@link SearchServiceMockTest} for why every stub returns a <em>schema base</em> instance:
 * the HTTP layer always deserializes into {@link
 * org.openmetadata.schema.entity.services.MetadataService}, never the SDK facade subclass, so
 * these tests mirror real API behavior and guard against the downcasting bug.
 */
public class MetadataServiceMockTest {

  @Mock private OpenMetadataClient mockClient;
  @Mock private MetadataServiceService mockMetadataServiceService;
  private AutoCloseable closeable;
  private MockedStatic<OpenMetadata> mockedOpenMetadata;

  @BeforeEach
  void setUp() {
    closeable = MockitoAnnotations.openMocks(this);
    when(mockClient.metadataServices()).thenReturn(mockMetadataServiceService);
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
  void testCreateMetadataService_returnsSchemaBaseWithoutCast() throws OpenMetadataException {
    // Arrange — schema base instance, as the HTTP layer would deserialize.
    org.openmetadata.schema.entity.services.MetadataService entity =
        new org.openmetadata.schema.entity.services.MetadataService();
    entity.setName("metadata-store");
    org.openmetadata.schema.entity.services.MetadataService created =
        new org.openmetadata.schema.entity.services.MetadataService();
    created.setId(UUID.randomUUID());
    created.setName("metadata-store");
    created.setFullyQualifiedName("metadata-store");

    when(mockMetadataServiceService.create(entity)).thenReturn(created);

    // Act
    org.openmetadata.schema.entity.services.MetadataService result = MetadataService.create(entity);

    // Assert
    assertNotNull(result);
    assertEquals("metadata-store", result.getName());
    assertEquals("metadata-store", result.getFullyQualifiedName());
    assertInstanceOf(org.openmetadata.schema.entity.services.MetadataService.class, result);
    verify(mockMetadataServiceService).create(entity);
  }

  @Test
  void testRetrieveMetadataServiceById_returnsSchemaBaseWithoutCast() throws OpenMetadataException {
    // Arrange
    String id = UUID.randomUUID().toString();
    org.openmetadata.schema.entity.services.MetadataService expected =
        new org.openmetadata.schema.entity.services.MetadataService();
    expected.setId(UUID.fromString(id));
    expected.setName("metadata-store");
    expected.setFullyQualifiedName("metadata-store");

    when(mockMetadataServiceService.get(id)).thenReturn(expected);

    // Act
    org.openmetadata.schema.entity.services.MetadataService result = MetadataService.retrieve(id);

    // Assert
    assertNotNull(result);
    assertEquals(id, result.getId().toString());
    assertEquals("metadata-store", result.getName());
    assertInstanceOf(org.openmetadata.schema.entity.services.MetadataService.class, result);
    verify(mockMetadataServiceService).get(id);
  }

  @Test
  void testRetrieveMetadataServiceByUuid_returnsSchemaBaseWithoutCast()
      throws OpenMetadataException {
    // Arrange
    UUID id = UUID.randomUUID();
    org.openmetadata.schema.entity.services.MetadataService expected =
        new org.openmetadata.schema.entity.services.MetadataService();
    expected.setId(id);
    expected.setName("metadata-store");

    when(mockMetadataServiceService.get(id.toString())).thenReturn(expected);

    // Act
    org.openmetadata.schema.entity.services.MetadataService result = MetadataService.retrieve(id);

    // Assert
    assertNotNull(result);
    assertEquals(id, result.getId());
    verify(mockMetadataServiceService).get(id.toString());
  }

  @Test
  void testRetrieveMetadataServiceByName_returnsSchemaBaseWithoutCast()
      throws OpenMetadataException {
    // Arrange
    String name = "metadata-store";
    org.openmetadata.schema.entity.services.MetadataService expected =
        new org.openmetadata.schema.entity.services.MetadataService();
    expected.setName(name);
    expected.setFullyQualifiedName(name);

    when(mockMetadataServiceService.getByName(name)).thenReturn(expected);

    // Act
    org.openmetadata.schema.entity.services.MetadataService result =
        MetadataService.retrieveByName(name);

    // Assert
    assertNotNull(result);
    assertEquals(name, result.getName());
    assertEquals(name, result.getFullyQualifiedName());
    assertInstanceOf(org.openmetadata.schema.entity.services.MetadataService.class, result);
    verify(mockMetadataServiceService).getByName(name);
  }

  @Test
  void testUpdateMetadataService_returnsSchemaBaseWithoutCast() throws OpenMetadataException {
    // Arrange
    String id = UUID.randomUUID().toString();
    org.openmetadata.schema.entity.services.MetadataService patch =
        new org.openmetadata.schema.entity.services.MetadataService();
    patch.setName("metadata-store-renamed");
    patch.setDescription("Renamed service");

    org.openmetadata.schema.entity.services.MetadataService updated =
        new org.openmetadata.schema.entity.services.MetadataService();
    updated.setId(UUID.fromString(id));
    updated.setName("metadata-store-renamed");
    updated.setDescription("Renamed service");

    when(mockMetadataServiceService.update(id, patch)).thenReturn(updated);

    // Act
    org.openmetadata.schema.entity.services.MetadataService result =
        MetadataService.update(id, patch);

    // Assert
    assertNotNull(result);
    assertEquals("metadata-store-renamed", result.getName());
    assertEquals("Renamed service", result.getDescription());
    assertInstanceOf(org.openmetadata.schema.entity.services.MetadataService.class, result);
    verify(mockMetadataServiceService).update(id, patch);
  }

  @Test
  void testDeleteMetadataService_invokesServiceDelete() throws OpenMetadataException {
    // Arrange
    String id = UUID.randomUUID().toString();
    doNothing().when(mockMetadataServiceService).delete(eq(id), any());

    // Act
    MetadataService.delete(id, false, true);

    // Assert
    verify(mockMetadataServiceService)
        .delete(
            eq(id),
            argThat(
                params ->
                    "false".equals(params.get("recursive"))
                        && "true".equals(params.get("hardDelete"))));
  }
}
