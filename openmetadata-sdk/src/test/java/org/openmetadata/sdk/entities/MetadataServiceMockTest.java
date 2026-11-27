package org.openmetadata.sdk.entities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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

  private static final String SERVICE_NAME = "metadata-store";
  private static final String SERVICE_NAME_RENAMED = "metadata-store-renamed";
  private static final String DESCRIPTION = "Renamed service";

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
    final org.openmetadata.schema.entity.services.MetadataService entity =
        new org.openmetadata.schema.entity.services.MetadataService();
    entity.setName(SERVICE_NAME);
    final org.openmetadata.schema.entity.services.MetadataService created =
        new org.openmetadata.schema.entity.services.MetadataService();
    created.setId(UUID.randomUUID());
    created.setName(SERVICE_NAME);
    created.setFullyQualifiedName(SERVICE_NAME);

    when(mockMetadataServiceService.create(entity)).thenReturn(created);

    // Act
    final org.openmetadata.schema.entity.services.MetadataService result =
        MetadataService.create(entity);

    // Assert
    assertNotNull(result);
    assertEquals(SERVICE_NAME, result.getName());
    assertEquals(SERVICE_NAME, result.getFullyQualifiedName());
    assertInstanceOf(org.openmetadata.schema.entity.services.MetadataService.class, result);
    verify(mockMetadataServiceService).create(entity);
  }

  @Test
  void testRetrieveMetadataServiceById_returnsSchemaBaseWithoutCast() throws OpenMetadataException {
    // Arrange
    final String id = UUID.randomUUID().toString();
    final org.openmetadata.schema.entity.services.MetadataService expected =
        new org.openmetadata.schema.entity.services.MetadataService();
    expected.setId(UUID.fromString(id));
    expected.setName(SERVICE_NAME);
    expected.setFullyQualifiedName(SERVICE_NAME);

    when(mockMetadataServiceService.get(id)).thenReturn(expected);

    // Act
    final org.openmetadata.schema.entity.services.MetadataService result =
        MetadataService.retrieve(id);

    // Assert
    assertNotNull(result);
    assertEquals(id, result.getId().toString());
    assertEquals(SERVICE_NAME, result.getName());
    assertInstanceOf(org.openmetadata.schema.entity.services.MetadataService.class, result);
    verify(mockMetadataServiceService).get(id);
  }

  @Test
  void testRetrieveMetadataServiceByUuid_returnsSchemaBaseWithoutCast()
      throws OpenMetadataException {
    // Arrange
    final UUID id = UUID.randomUUID();
    final org.openmetadata.schema.entity.services.MetadataService expected =
        new org.openmetadata.schema.entity.services.MetadataService();
    expected.setId(id);
    expected.setName(SERVICE_NAME);

    when(mockMetadataServiceService.get(id.toString())).thenReturn(expected);

    // Act
    final org.openmetadata.schema.entity.services.MetadataService result =
        MetadataService.retrieve(id);

    // Assert
    assertNotNull(result);
    assertEquals(id, result.getId());
    verify(mockMetadataServiceService).get(id.toString());
  }

  @Test
  void testRetrieveMetadataServiceByName_returnsSchemaBaseWithoutCast()
      throws OpenMetadataException {
    // Arrange
    final String name = SERVICE_NAME;
    final org.openmetadata.schema.entity.services.MetadataService expected =
        new org.openmetadata.schema.entity.services.MetadataService();
    expected.setName(name);
    expected.setFullyQualifiedName(name);

    when(mockMetadataServiceService.getByName(name)).thenReturn(expected);

    // Act
    final org.openmetadata.schema.entity.services.MetadataService result =
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
    final String id = UUID.randomUUID().toString();
    final org.openmetadata.schema.entity.services.MetadataService patch =
        new org.openmetadata.schema.entity.services.MetadataService();
    patch.setName(SERVICE_NAME_RENAMED);
    patch.setDescription(DESCRIPTION);

    final org.openmetadata.schema.entity.services.MetadataService updated =
        new org.openmetadata.schema.entity.services.MetadataService();
    updated.setId(UUID.fromString(id));
    updated.setName(SERVICE_NAME_RENAMED);
    updated.setDescription(DESCRIPTION);

    when(mockMetadataServiceService.update(id, patch)).thenReturn(updated);

    // Act
    final org.openmetadata.schema.entity.services.MetadataService result =
        MetadataService.update(id, patch);

    // Assert
    assertNotNull(result);
    assertEquals(SERVICE_NAME_RENAMED, result.getName());
    assertEquals(DESCRIPTION, result.getDescription());
    assertInstanceOf(org.openmetadata.schema.entity.services.MetadataService.class, result);
    verify(mockMetadataServiceService).update(id, patch);
  }

  @Test
  void testDeleteMetadataService_invokesServiceDelete() throws OpenMetadataException {
    // Arrange
    final String id = UUID.randomUUID().toString();
    doNothing().when(mockMetadataServiceService).delete(eq(id), any());

    // Act
    MetadataService.delete(id, false, true);

    // Assert
    verify(mockMetadataServiceService)
        .delete(
            eq(id),
            argThat(
                params ->
                    Boolean.FALSE.toString().equals(params.get("recursive"))
                        && Boolean.TRUE.toString().equals(params.get("hardDelete"))));
  }
}
