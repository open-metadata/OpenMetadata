package org.openmetadata.service.resources.drive;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.File;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.FileRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.drives.FileResource;
import org.openmetadata.service.security.Authorizer;

class FileResourceViewOperationsTest {

  private static final Set<String> ALLOWED_FIELDS =
      Set.of(
          "owners",
          "followers",
          "votes",
          "tags",
          "extension",
          "domains",
          "dataProducts",
          "experts",
          "reviewers",
          "directory",
          "usageSummary",
          "columns",
          "sampleData");

  /**
   * A file's columns are basic metadata, as a worksheet's and a table's are: a caller with
   * ViewBasic must be able to read them, not only one with ViewAll. Sample data stays gated.
   */
  @Test
  void columnsNeedViewBasic_sampleDataStillNeedsViewSampleData() {
    Map<String, MetadataOperation> viewOperations = registeredViewOperations();

    assertEquals(MetadataOperation.VIEW_BASIC, viewOperations.get("columns"));
    assertEquals(MetadataOperation.VIEW_SAMPLE_DATA, viewOperations.get("sampleData"));
  }

  @SuppressWarnings("unchecked")
  private static Map<String, MetadataOperation> registeredViewOperations() {
    FileRepository repository = mock(FileRepository.class);
    when(repository.getAllowedFields()).thenReturn(ALLOWED_FIELDS);
    ArgumentCaptor<Map<String, MetadataOperation>> mapping = ArgumentCaptor.forClass(Map.class);
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.FILE)).thenReturn(repository);
      entity.when(() -> Entity.getEntityClassFromType(Entity.FILE)).thenReturn(File.class);

      new FileResource(mock(Authorizer.class), mock(Limits.class));

      entity.verify(
          () -> Entity.registerResourceFieldViewMapping(eq(Entity.FILE), mapping.capture()));
    }
    return mapping.getValue();
  }
}
