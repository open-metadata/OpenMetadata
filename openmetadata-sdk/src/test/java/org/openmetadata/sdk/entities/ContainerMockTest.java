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
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContainerDataModel;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.services.storages.ContainerService;

/**
 * Mock tests for Container entity operations.
 */
public class ContainerMockTest {

  @Mock private OpenMetadataClient mockClient;
  @Mock private ContainerService mockContainerService;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    when(mockClient.containers()).thenReturn(mockContainerService);
    org.openmetadata.sdk.entities.Container.setDefaultClient(mockClient);
  }

  @Test
  void testCreateContainer() {
    // Arrange
    CreateContainer createRequest = new CreateContainer();
    createRequest.setName("data-lake-bucket");
    createRequest.setService("s3");
    createRequest.setDisplayName("Data Lake Bucket");
    createRequest.setDescription("Main data lake storage bucket");

    Container expectedContainer = new Container();
    expectedContainer.setId(UUID.randomUUID());
    expectedContainer.setName("data-lake-bucket");
    expectedContainer.setFullyQualifiedName("s3.data-lake-bucket");
    expectedContainer.setDisplayName("Data Lake Bucket");

    when(mockContainerService.create(any(CreateContainer.class))).thenReturn(expectedContainer);

    // Act
    Container result = org.openmetadata.sdk.entities.Container.create(createRequest);

    // Assert
    assertNotNull(result);
    assertEquals("data-lake-bucket", result.getName());
    assertEquals("Data Lake Bucket", result.getDisplayName());
    verify(mockContainerService).create(any(CreateContainer.class));
  }

  @Test
  void testRetrieveContainer() {
    // Arrange
    String containerId = UUID.randomUUID().toString();
    Container expectedContainer = new Container();
    expectedContainer.setId(UUID.fromString(containerId));
    expectedContainer.setName("raw-data-container");
    expectedContainer.setPrefix("/raw-data/");
    expectedContainer.setNumberOfObjects(1500.0);
    expectedContainer.setSize(5368709120.0); // 5GB

    when(mockContainerService.get(containerId)).thenReturn(expectedContainer);

    // Act
    Container result = org.openmetadata.sdk.entities.Container.retrieve(containerId);

    // Assert
    assertNotNull(result);
    assertEquals(containerId, result.getId().toString());
    assertEquals("raw-data-container", result.getName());
    assertEquals("/raw-data/", result.getPrefix());
    assertEquals(1500.0, result.getNumberOfObjects());
    verify(mockContainerService).get(containerId);
  }

  @Test
  void testRetrieveContainerWithDataModel() {
    // Arrange
    String containerId = UUID.randomUUID().toString();
    String fields = "dataModel,parent,children";
    Container expectedContainer = new Container();
    expectedContainer.setId(UUID.fromString(containerId));
    expectedContainer.setName("structured-data");

    // Mock data model
    ContainerDataModel dataModel = new ContainerDataModel();
    Column col1 = new Column();
    col1.setName("user_id");
    col1.setDataType(ColumnDataType.STRING);
    Column col2 = new Column();
    col2.setName("timestamp");
    col2.setDataType(ColumnDataType.TIMESTAMP);
    dataModel.setColumns(List.of(col1, col2));
    expectedContainer.setDataModel(dataModel);

    when(mockContainerService.get(containerId, fields)).thenReturn(expectedContainer);

    // Act
    Container result = org.openmetadata.sdk.entities.Container.retrieve(containerId, fields);

    // Assert
    assertNotNull(result);
    assertNotNull(result.getDataModel());
    assertEquals(2, result.getDataModel().getColumns().size());
    assertEquals("user_id", result.getDataModel().getColumns().get(0).getName());
    verify(mockContainerService).get(containerId, fields);
  }

  @Test
  void testRetrieveContainerByName() {
    // Arrange
    String fqn = "azure.blob.analytics.processed-data";
    Container expectedContainer = new Container();
    expectedContainer.setName("processed-data");
    expectedContainer.setFullyQualifiedName(fqn);
    // File formats are complex objects, skip for simplicity

    when(mockContainerService.getByName(fqn)).thenReturn(expectedContainer);

    // Act
    Container result = org.openmetadata.sdk.entities.Container.retrieveByName(fqn);

    // Assert
    assertNotNull(result);
    assertEquals(fqn, result.getFullyQualifiedName());
    verify(mockContainerService).getByName(fqn);
  }

  @Test
  void testUpdateContainer() {
    // Arrange
    Container containerToUpdate = new Container();
    containerToUpdate.setId(UUID.randomUUID());
    containerToUpdate.setName("archive-bucket");
    containerToUpdate.setDescription("Updated archive storage bucket");
    containerToUpdate.setRetentionPeriod("P365D"); // 365 days

    Container expectedContainer = new Container();
    expectedContainer.setId(containerToUpdate.getId());
    expectedContainer.setName(containerToUpdate.getName());
    expectedContainer.setDescription(containerToUpdate.getDescription());
    expectedContainer.setRetentionPeriod("P365D");

    when(mockContainerService.update(containerToUpdate.getId().toString(), containerToUpdate))
        .thenReturn(expectedContainer);

    // Act
    Container result =
        org.openmetadata.sdk.entities.Container.update(
            containerToUpdate.getId().toString(), containerToUpdate);

    // Assert
    assertNotNull(result);
    assertEquals("Updated archive storage bucket", result.getDescription());
    assertEquals("P365D", result.getRetentionPeriod());
    verify(mockContainerService).update(containerToUpdate.getId().toString(), containerToUpdate);
  }

  @Test
  void testDeleteContainer() {
    // Arrange
    String containerId = UUID.randomUUID().toString();
    doNothing().when(mockContainerService).delete(eq(containerId), any());

    // Act
    org.openmetadata.sdk.entities.Container.delete(containerId);

    // Assert
    verify(mockContainerService).delete(eq(containerId), any());
  }

  @Test
  void testHierarchicalContainers() {
    // Arrange - Test parent-child relationships
    String parentId = UUID.randomUUID().toString();
    Container parentContainer = new Container();
    parentContainer.setId(UUID.fromString(parentId));
    parentContainer.setName("root-bucket");

    String childId = UUID.randomUUID().toString();
    Container childContainer = new Container();
    childContainer.setId(UUID.fromString(childId));
    childContainer.setName("sub-folder");

    EntityReference parentRef = new EntityReference();
    parentRef.setId(UUID.fromString(parentId));
    parentRef.setType("container");
    childContainer.setParent(parentRef);

    when(mockContainerService.get(childId, "parent")).thenReturn(childContainer);
    when(mockContainerService.get(parentId)).thenReturn(parentContainer);

    // Act
    Container child = org.openmetadata.sdk.entities.Container.retrieve(childId, "parent");

    // Assert
    assertNotNull(child.getParent());
    assertEquals(parentId, child.getParent().getId().toString());
    verify(mockContainerService).get(childId, "parent");
  }
}
