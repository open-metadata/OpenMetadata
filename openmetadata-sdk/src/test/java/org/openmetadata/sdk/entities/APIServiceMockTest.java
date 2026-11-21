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
    org.openmetadata.schema.entity.services.ApiService entity =
        new org.openmetadata.schema.entity.services.ApiService();
    entity.setName("rest-api");
    org.openmetadata.schema.entity.services.ApiService created =
        new org.openmetadata.schema.entity.services.ApiService();
    created.setId(UUID.randomUUID());
    created.setName("rest-api");
    created.setFullyQualifiedName("rest-api");

    when(mockApiServiceService.create(entity)).thenReturn(created);

    // Act
    org.openmetadata.schema.entity.services.ApiService result = APIService.create(entity);

    // Assert
    assertNotNull(result);
    assertEquals("rest-api", result.getName());
    assertEquals("rest-api", result.getFullyQualifiedName());
    assertInstanceOf(org.openmetadata.schema.entity.services.ApiService.class, result);
    verify(mockApiServiceService).create(entity);
  }

  @Test
  void testRetrieveAPIServiceById_returnsSchemaBaseWithoutCast() throws OpenMetadataException {
    // Arrange
    String id = UUID.randomUUID().toString();
    org.openmetadata.schema.entity.services.ApiService expected =
        new org.openmetadata.schema.entity.services.ApiService();
    expected.setId(UUID.fromString(id));
    expected.setName("rest-api");
    expected.setFullyQualifiedName("rest-api");

    when(mockApiServiceService.get(id)).thenReturn(expected);

    // Act
    org.openmetadata.schema.entity.services.ApiService result = APIService.retrieve(id);

    // Assert
    assertNotNull(result);
    assertEquals(id, result.getId().toString());
    assertEquals("rest-api", result.getName());
    assertInstanceOf(org.openmetadata.schema.entity.services.ApiService.class, result);
    verify(mockApiServiceService).get(id);
  }

  @Test
  void testRetrieveAPIServiceByUuid_returnsSchemaBaseWithoutCast() throws OpenMetadataException {
    // Arrange
    UUID id = UUID.randomUUID();
    org.openmetadata.schema.entity.services.ApiService expected =
        new org.openmetadata.schema.entity.services.ApiService();
    expected.setId(id);
    expected.setName("rest-api");

    when(mockApiServiceService.get(id.toString())).thenReturn(expected);

    // Act
    org.openmetadata.schema.entity.services.ApiService result = APIService.retrieve(id);

    // Assert
    assertNotNull(result);
    assertEquals(id, result.getId());
    verify(mockApiServiceService).get(id.toString());
  }

  @Test
  void testRetrieveAPIServiceByName_returnsSchemaBaseWithoutCast() throws OpenMetadataException {
    // Arrange
    String name = "rest-api";
    org.openmetadata.schema.entity.services.ApiService expected =
        new org.openmetadata.schema.entity.services.ApiService();
    expected.setName(name);
    expected.setFullyQualifiedName(name);

    when(mockApiServiceService.getByName(name)).thenReturn(expected);

    // Act
    org.openmetadata.schema.entity.services.ApiService result = APIService.retrieveByName(name);

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
    String id = UUID.randomUUID().toString();
    org.openmetadata.schema.entity.services.ApiService patch =
        new org.openmetadata.schema.entity.services.ApiService();
    patch.setName("rest-api-renamed");
    patch.setDescription("Renamed service");

    org.openmetadata.schema.entity.services.ApiService updated =
        new org.openmetadata.schema.entity.services.ApiService();
    updated.setId(UUID.fromString(id));
    updated.setName("rest-api-renamed");
    updated.setDescription("Renamed service");

    when(mockApiServiceService.update(id, patch)).thenReturn(updated);

    // Act
    org.openmetadata.schema.entity.services.ApiService result = APIService.update(id, patch);

    // Assert
    assertNotNull(result);
    assertEquals("rest-api-renamed", result.getName());
    assertEquals("Renamed service", result.getDescription());
    assertInstanceOf(org.openmetadata.schema.entity.services.ApiService.class, result);
    verify(mockApiServiceService).update(id, patch);
  }

  @Test
  void testDeleteAPIService_invokesServiceDelete() throws OpenMetadataException {
    // Arrange
    String id = UUID.randomUUID().toString();
    doNothing().when(mockApiServiceService).delete(eq(id), any());

    // Act
    APIService.delete(id, true, false);

    // Assert
    verify(mockApiServiceService)
        .delete(
            eq(id),
            argThat(
                params ->
                    "true".equals(params.get("recursive"))
                        && "false".equals(params.get("hardDelete"))));
  }
}
