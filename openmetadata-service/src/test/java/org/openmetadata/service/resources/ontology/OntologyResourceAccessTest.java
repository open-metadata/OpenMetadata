package org.openmetadata.service.resources.ontology;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.json.Json;
import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

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

  @Test
  void movingOrCopyingOutOfAContentFieldIsAContentEdit() {
    for (final String field : List.of("/description", "/tags", "/tags/0")) {
      assertTrue(
          OntologyResourceAccess.touchesContent(
              Json.createPatchBuilder().move("/displayName", field).build()),
          "move from " + field);
      assertTrue(
          OntologyResourceAccess.touchesContent(
              Json.createPatchBuilder().copy("/displayName", field).build()),
          "copy from " + field);
    }
  }

  @Test
  void movingOrCopyingBetweenOtherFieldsIsNotAContentEdit() {
    assertFalse(
        OntologyResourceAccess.touchesContent(
            Json.createPatchBuilder().move("/displayName", "/extension/note").build()));
    assertFalse(
        OntologyResourceAccess.touchesContent(
            Json.createPatchBuilder().copy("/displayName", "/name").build()));
  }

  @Test
  void draftReadsNeedEditAllWhileViewAloneIsNotEnough() {
    final SecurityContext context = Mockito.mock(SecurityContext.class);
    final ResourceContextInterface ontology = Mockito.mock(ResourceContextInterface.class);

    assertThrows(
        AuthorizationException.class,
        () ->
            OntologyResourceAccess.requireDraftRead(
                grantingOnly(MetadataOperation.VIEW_ALL), context, ontology));
    assertDoesNotThrow(
        () ->
            OntologyResourceAccess.requireDraftRead(
                grantingOnly(MetadataOperation.EDIT_ALL), context, ontology));
  }

  @Test
  void aListThatNamesAnOntologyNeedsNoPerRowCheck() {
    assertDoesNotThrow(
        () ->
            OntologyResourceAccess.requireDraftRowsRead(
                refusingEverything(),
                Mockito.mock(SecurityContext.class),
                UUID.randomUUID(),
                List.of(UUID.randomUUID())));
  }

  private static Authorizer refusingEverything() {
    final Authorizer authorizer = Mockito.mock(Authorizer.class);
    Mockito.doThrow(new AuthorizationException("denied"))
        .when(authorizer)
        .authorize(
            Mockito.any(SecurityContext.class),
            Mockito.any(OperationContext.class),
            Mockito.any(ResourceContextInterface.class));
    return authorizer;
  }

  private static Authorizer grantingOnly(final MetadataOperation granted) {
    final Authorizer authorizer = Mockito.mock(Authorizer.class);
    Mockito.doAnswer(
            call -> {
              final OperationContext operation = call.getArgument(1);
              if (!operation.getOperations(null).equals(List.of(granted))) {
                throw new AuthorizationException("denied");
              }
              return null;
            })
        .when(authorizer)
        .authorize(
            Mockito.any(SecurityContext.class),
            Mockito.any(OperationContext.class),
            Mockito.any(ResourceContextInterface.class));
    return authorizer;
  }

  private static JsonPatch replace(final String path, final String value) {
    return Json.createPatchBuilder().replace(path, value).build();
  }

  private static JsonPatch add(final String path, final String value) {
    return Json.createPatchBuilder().add(path, value).build();
  }
}
