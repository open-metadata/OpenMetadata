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
import org.openmetadata.sdk.services.services.APIServiceService;

/**
 * Mock tests for {@link APIService} facade operations.
 *
 * <p>See {@link SearchServiceMockTest} for why every stub returns a <em>schema base</em> instance:
 * the HTTP layer always deserializes into {@link
 * org.openmetadata.schema.entity.services.ApiService}, never the SDK facade subclass, so these
 * tests mirror real API behavior and guard against the downcasting bug.
 */
public class APIServiceMockTest {

  private static final String SERVICE_NAME = "rest-api";
  private static final String SERVICE_NAME_RENAMED = "rest-api-renamed";
  private static final String DESCRIPTION = "Renamed service";

  @Mock private OpenMetadataClient mockClient;
  @Mock private APIServiceService mockApiServiceService;
  private AutoCloseable closeable;
  private MockedStatic<OpenMetadata> mockedOpenMetadata;

  @BeforeEach
  void setUp() {
    closeable = MockitoAnnotations.openMocks(this);
    when(mockClient.apiServices()).thenReturn(mockApiServiceService);
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
  void testCreateAPIService_returnsSchemaBaseWithoutCast() throws OpenMetadataException {
    // Arrange — schema base instance, as the HTTP layer would deserialize.
    final org.openmetadata.schema.entity.services.ApiService entity =
        new org.openmetadata.schema.entity.services.ApiService();
    entity.setName(SERVICE_NAME);
    final org.openmetadata.schema.entity.services.ApiService created =
        new org.openmetadata.schema.entity.services.ApiService();
    created.setId(UUID.randomUUID());
    created.setName(SERVICE_NAME);
    created.setFullyQualifiedName(SERVICE_NAME);

    when(mockApiServiceService.create(entity)).thenReturn(created);

    // Act
    final org.openmetadata.schema.entity.services.ApiService result = APIService.create(entity);

    // Assert
    assertNotNull(result);
    assertEquals(SERVICE_NAME, result.getName());
    assertEquals(SERVICE_NAME, result.getFullyQualifiedName());
    assertInstanceOf(org.openmetadata.schema.entity.services.ApiService.class, result);
    verify(mockApiServiceService).create(entity);
  }

  @Test
  void testRetrieveAPIServiceById_returnsSchemaBaseWithoutCast() throws OpenMetadataException {
    // Arrange
    final String id = UUID.randomUUID().toString();
    final org.openmetadata.schema.entity.services.ApiService expected =
        new org.openmetadata.schema.entity.services.ApiService();
    expected.setId(UUID.fromString(id));
    expected.setName(SERVICE_NAME);
    expected.setFullyQualifiedName(SERVICE_NAME);

    when(mockApiServiceService.get(id)).thenReturn(expected);

    // Act
    final org.openmetadata.schema.entity.services.ApiService result = APIService.retrieve(id);

    // Assert
    assertNotNull(result);
    assertEquals(id, result.getId().toString());
    assertEquals(SERVICE_NAME, result.getName());
    assertInstanceOf(org.openmetadata.schema.entity.services.ApiService.class, result);
    verify(mockApiServiceService).get(id);
  }

  @Test
  void testRetrieveAPIServiceByUuid_returnsSchemaBaseWithoutCast() throws OpenMetadataException {
    // Arrange
    final UUID id = UUID.randomUUID();
    final org.openmetadata.schema.entity.services.ApiService expected =
        new org.openmetadata.schema.entity.services.ApiService();
    expected.setId(id);
    expected.setName(SERVICE_NAME);

    when(mockApiServiceService.get(id.toString())).thenReturn(expected);

    // Act
    final org.openmetadata.schema.entity.services.ApiService result = APIService.retrieve(id);

    // Assert
    assertNotNull(result);
    assertEquals(id, result.getId());
    verify(mockApiServiceService).get(id.toString());
  }

  @Test
  void testRetrieveAPIServiceByName_returnsSchemaBaseWithoutCast() throws OpenMetadataException {
    // Arrange
    final String name = SERVICE_NAME;
    final org.openmetadata.schema.entity.services.ApiService expected =
        new org.openmetadata.schema.entity.services.ApiService();
    expected.setName(name);
    expected.setFullyQualifiedName(name);

    when(mockApiServiceService.getByName(name)).thenReturn(expected);

    // Act
    final org.openmetadata.schema.entity.services.ApiService result =
        APIService.retrieveByName(name);

    // Assert
    assertNotNull(result);
    assertEquals(name, result.getName());
    assertEquals(name, result.getFullyQualifiedName());
    assertInstanceOf(org.openmetadata.schema.entity.services.ApiService.class, result);
    verify(mockApiServiceService).getByName(name);
  }

  @Test
  void testUpdateAPIService_returnsSchemaBaseWithoutCast() throws OpenMetadataException {
    // Arrange
    final String id = UUID.randomUUID().toString();
    final org.openmetadata.schema.entity.services.ApiService patch =
        new org.openmetadata.schema.entity.services.ApiService();
    patch.setName(SERVICE_NAME_RENAMED);
    patch.setDescription(DESCRIPTION);

    final org.openmetadata.schema.entity.services.ApiService updated =
        new org.openmetadata.schema.entity.services.ApiService();
    updated.setId(UUID.fromString(id));
    updated.setName(SERVICE_NAME_RENAMED);
    updated.setDescription(DESCRIPTION);

    when(mockApiServiceService.update(id, patch)).thenReturn(updated);

    // Act
    final org.openmetadata.schema.entity.services.ApiService result = APIService.update(id, patch);

    // Assert
    assertNotNull(result);
    assertEquals(SERVICE_NAME_RENAMED, result.getName());
    assertEquals(DESCRIPTION, result.getDescription());
    assertInstanceOf(org.openmetadata.schema.entity.services.ApiService.class, result);
    verify(mockApiServiceService).update(id, patch);
  }

  @Test
  void testDeleteAPIService_invokesServiceDelete() throws OpenMetadataException {
    // Arrange
    final String id = UUID.randomUUID().toString();
    doNothing().when(mockApiServiceService).delete(eq(id), any());

    // Act
    APIService.delete(id, true, false);

    // Assert
    verify(mockApiServiceService)
        .delete(
            eq(id),
            argThat(
                params ->
                    Boolean.TRUE.toString().equals(params.get("recursive"))
                        && Boolean.FALSE.toString().equals(params.get("hardDelete"))));
  }
}
