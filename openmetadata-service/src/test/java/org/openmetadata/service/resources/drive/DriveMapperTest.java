package org.openmetadata.service.resources.drive;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.openmetadata.service.jdbi3.FolderRepository.FOLDER_ENTITY;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.CreateContextFile;
import org.openmetadata.schema.api.data.CreateFolder;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileType;
import org.openmetadata.schema.entity.data.Folder;
import org.openmetadata.schema.entity.data.ProcessingStatus;

class DriveMapperTest {

  @Test
  void folderMapperCarriesParentReference() {
    Folder folder =
        new FolderMapper()
            .createToEntity(
                new CreateFolder().withName("child-folder").withParent("root-folder"), "admin");

    assertNotNull(folder.getParent());
    assertEquals(FOLDER_ENTITY, folder.getParent().getType());
    assertEquals("root-folder", folder.getParent().getFullyQualifiedName());
  }

  @Test
  void contextFileMapperCarriesFolderReference() {
    ContextFile file =
        new ContextFileMapper()
            .createToEntity(
                new CreateContextFile()
                    .withName("report")
                    .withFolder("root-folder.child-folder")
                    .withFileType(ContextFileType.PDF)
                    .withProcessingStatus(ProcessingStatus.Uploaded),
                "admin");

    assertNotNull(file.getFolder());
    assertEquals(FOLDER_ENTITY, file.getFolder().getType());
    assertEquals("root-folder.child-folder", file.getFolder().getFullyQualifiedName());
  }
}
