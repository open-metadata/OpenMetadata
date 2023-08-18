package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;

class JsonPatchUtilsTest {
  @Test
  void testGetMetadataOperation() {
    Object[][] patchPathToOperations = {
      {"/" + Entity.FIELD_DESCRIPTION, MetadataOperation.EDIT_DESCRIPTION},
      {"/" + Entity.FIELD_DISPLAY_NAME, MetadataOperation.EDIT_DISPLAY_NAME},
      {"/" + Entity.FIELD_TAGS, MetadataOperation.EDIT_TAGS},
      {"/Unknown", MetadataOperation.EDIT_ALL} // Unknown fields map to EDIT_ALL
    };
    for (Object[] patchPathToOperation : patchPathToOperations) {
      assertEquals(patchPathToOperation[1], JsonPatchUtils.getMetadataOperation((String) patchPathToOperation[0]));
    }
  }
}
