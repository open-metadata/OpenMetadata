package org.openmetadata.service.resources.ontology;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.json.Json;
import jakarta.json.JsonPatch;
import org.junit.jupiter.api.Test;

class OntologyResourceAccessTest {
  @Test
  void descriptionAndTagPatchesAreContentEdits() {
    assertTrue(OntologyResourceAccess.touchesContent(replace("/description", "text")));
    assertTrue(OntologyResourceAccess.touchesContent(add("/tags/0", "x")));
    assertTrue(OntologyResourceAccess.touchesContent(add("/tags/-", "x")));
  }

  @Test
  void otherFieldsAreNotContentEdits() {
    assertFalse(OntologyResourceAccess.touchesContent(replace("/displayName", "Name")));
    assertFalse(OntologyResourceAccess.touchesContent(replace("/descriptionNote", "Name")));
    assertFalse(OntologyResourceAccess.touchesContent(replace("/extension/description", "x")));
  }

  @Test
  void mixedPatchIsAContentEditWhenAnyOperationTouchesContent() {
    final JsonPatch patch =
        Json.createPatchBuilder()
            .replace("/displayName", "Name")
            .replace("/description", "text")
            .build();
    assertTrue(OntologyResourceAccess.touchesContent(patch));
  }

  private static JsonPatch replace(final String path, final String value) {
    return Json.createPatchBuilder().replace(path, value).build();
  }

  private static JsonPatch add(final String path, final String value) {
    return Json.createPatchBuilder().add(path, value).build();
  }
}
