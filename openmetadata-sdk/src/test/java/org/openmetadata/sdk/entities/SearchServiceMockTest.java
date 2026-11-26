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
import org.openmetadata.sdk.services.services.SearchServiceService;

/**
 * Mock tests for {@link SearchService} facade operations.
 *
 * <p>The backing {@link SearchServiceService} (via {@link
 * org.openmetadata.sdk.services.EntityServiceBase}) always deserializes HTTP responses into the
 * schema base class {@link org.openmetadata.schema.entity.services.SearchService} — never the SDK
 * facade subclass. These tests therefore stub every service call to return a <em>schema base</em>
 * instance, mirroring real HTTP behavior. With the cast-free facade this returns cleanly; with the
 * old downcasting facade this throws {@link ClassCastException}, so these tests are genuine
 * regression guards for the bug fixed by removing the casts.
 */
public class SearchServiceMockTest {

  private static final String SERVICE_NAME = "elasticsearch";
  private static final String SERVICE_NAME_ALT = "opensearch";
  private static final String SERVICE_NAME_RENAMED = "opensearch-renamed";
  private static final String DESCRIPTION = "Renamed service";

  @Mock private OpenMetadataClient mockClient;
  @Mock private SearchServiceService mockSearchServiceService;
  private AutoCloseable closeable;
  private MockedStatic<OpenMetadata> mockedOpenMetadata;

  @BeforeEach
  void setUp() {
    closeable = MockitoAnnotations.openMocks(this);
    when(mockClient.searchServices()).thenReturn(mockSearchServiceService);
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
  void testCreateSearchService_returnsSchemaBaseWithoutCast() throws OpenMetadataException {
    // Arrange — schema base instance, as the HTTP layer would deserialize.
    final org.openmetadata.schema.entity.services.SearchService entity =
        new org.openmetadata.schema.entity.services.SearchService();
    entity.setName(SERVICE_NAME);
    final org.openmetadata.schema.entity.services.SearchService created =
        new org.openmetadata.schema.entity.services.SearchService();
    created.setId(UUID.randomUUID());
    created.setName(SERVICE_NAME);
    created.setFullyQualifiedName(SERVICE_NAME);

    when(mockSearchServiceService.create(entity)).thenReturn(created);

    // Act
    final org.openmetadata.schema.entity.services.SearchService result =
        SearchService.create(entity);

    // Assert
    assertNotNull(result);
    assertEquals(SERVICE_NAME, result.getName());
    assertEquals(SERVICE_NAME, result.getFullyQualifiedName());
    assertInstanceOf(org.openmetadata.schema.entity.services.SearchService.class, result);
    verify(mockSearchServiceService).create(entity);
  }

  @Test
  void testRetrieveSearchServiceById_returnsSchemaBaseWithoutCast() throws OpenMetadataException {
    // Arrange
    final String id = UUID.randomUUID().toString();
    final org.openmetadata.schema.entity.services.SearchService expected =
        new org.openmetadata.schema.entity.services.SearchService();
    expected.setId(UUID.fromString(id));
    expected.setName(SERVICE_NAME_ALT);
    expected.setFullyQualifiedName(SERVICE_NAME_ALT);

    when(mockSearchServiceService.get(id)).thenReturn(expected);

    // Act
    final org.openmetadata.schema.entity.services.SearchService result = SearchService.retrieve(id);

    // Assert
    assertNotNull(result);
    assertEquals(id, result.getId().toString());
    assertEquals(SERVICE_NAME_ALT, result.getName());
    assertInstanceOf(org.openmetadata.schema.entity.services.SearchService.class, result);
    verify(mockSearchServiceService).get(id);
  }

  @Test
  void testRetrieveSearchServiceByUuid_returnsSchemaBaseWithoutCast() throws OpenMetadataException {
    // Arrange
    final UUID id = UUID.randomUUID();
    final org.openmetadata.schema.entity.services.SearchService expected =
        new org.openmetadata.schema.entity.services.SearchService();
    expected.setId(id);
    expected.setName(SERVICE_NAME);

    when(mockSearchServiceService.get(id.toString())).thenReturn(expected);

    // Act
    final org.openmetadata.schema.entity.services.SearchService result = SearchService.retrieve(id);

    // Assert
    assertNotNull(result);
    assertEquals(id, result.getId());
    verify(mockSearchServiceService).get(id.toString());
  }

  @Test
  void testRetrieveSearchServiceByName_returnsSchemaBaseWithoutCast() throws OpenMetadataException {
    // Arrange
    final String name = SERVICE_NAME;
    final org.openmetadata.schema.entity.services.SearchService expected =
        new org.openmetadata.schema.entity.services.SearchService();
    expected.setName(name);
    expected.setFullyQualifiedName(name);

    when(mockSearchServiceService.getByName(name)).thenReturn(expected);

    // Act
    final org.openmetadata.schema.entity.services.SearchService result =
        SearchService.retrieveByName(name);

    // Assert
    assertNotNull(result);
    assertEquals(name, result.getName());
    assertEquals(name, result.getFullyQualifiedName());
    assertInstanceOf(org.openmetadata.schema.entity.services.SearchService.class, result);
    verify(mockSearchServiceService).getByName(name);
  }

  @Test
  void testUpdateSearchService_returnsSchemaBaseWithoutCast() throws OpenMetadataException {
    // Arrange
    final String id = UUID.randomUUID().toString();
    final org.openmetadata.schema.entity.services.SearchService patch =
        new org.openmetadata.schema.entity.services.SearchService();
    patch.setName(SERVICE_NAME_RENAMED);
    patch.setDescription(DESCRIPTION);

    final org.openmetadata.schema.entity.services.SearchService updated =
        new org.openmetadata.schema.entity.services.SearchService();
    updated.setId(UUID.fromString(id));
    updated.setName(SERVICE_NAME_RENAMED);
    updated.setDescription(DESCRIPTION);

    when(mockSearchServiceService.update(id, patch)).thenReturn(updated);

    // Act
    final org.openmetadata.schema.entity.services.SearchService result =
        SearchService.update(id, patch);

    // Assert
    assertNotNull(result);
    assertEquals(SERVICE_NAME_RENAMED, result.getName());
    assertEquals(DESCRIPTION, result.getDescription());
    assertInstanceOf(org.openmetadata.schema.entity.services.SearchService.class, result);
    verify(mockSearchServiceService).update(id, patch);
  }

  @Test
  void testDeleteSearchService_invokesServiceDelete() throws OpenMetadataException {
    // Arrange
    final String id = UUID.randomUUID().toString();
    doNothing().when(mockSearchServiceService).delete(eq(id), any());

    // Act
    SearchService.delete(id, true, true);

    // Assert
    verify(mockSearchServiceService)
        .delete(
            eq(id),
            argThat(
                params ->
                    Boolean.TRUE.toString().equals(params.get("recursive"))
                        && Boolean.TRUE.toString().equals(params.get("hardDelete"))));
  }
}
