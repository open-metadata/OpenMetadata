package org.openmetadata.service.resources.drive;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.json.Json;
import jakarta.json.JsonPatch;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.core.SecurityContext;
import java.security.Principal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class ContextFileVisibilityTest {

  private static final String ALICE = "alice";
  private static final String BOB = "bob";
  private static final String BEFORE = "before-cursor";
  private static final String AFTER = "after-cursor";
  private static final int TOTAL = 7;

  @Test
  void aFilteredPageKeepsItsCursorsAndTotal() {
    ResultList<ContextFile> page =
        new ResultList<>(
            List.of(fileOwnedBy(ALICE, MemoryVisibility.PRIVATE), fileOwnedBy(BOB, null)),
            BEFORE,
            AFTER,
            TOTAL);

    ResultList<ContextFile> visible = visibleTo(BOB, false, page);

    assertEquals(1, visible.getData().size());
    assertEquals(BOB, visible.getData().getFirst().getOwners().getFirst().getName());
    assertNotNull(page.getPaging().getAfter());
    assertEquals(page.getPaging().getBefore(), visible.getPaging().getBefore());
    assertEquals(page.getPaging().getAfter(), visible.getPaging().getAfter());
    assertEquals(TOTAL, visible.getPaging().getTotal());
  }

  @Test
  void anAdminSeesTheWholePageWithItsCursors() {
    ResultList<ContextFile> page =
        new ResultList<>(
            List.of(fileOwnedBy(ALICE, MemoryVisibility.PRIVATE)), BEFORE, AFTER, TOTAL);

    ResultList<ContextFile> visible = visibleTo(BOB, true, page);

    assertEquals(1, visible.getData().size());
    assertEquals(page.getPaging().getAfter(), visible.getPaging().getAfter());
  }

  @Test
  void publicFilesRemainRestrictedToTheirOwners() {
    ContextFile file = fileOwnedBy(ALICE, MemoryVisibility.PUBLIC);

    assertFalse(ContextFileVisibility.isVisibleToUser(file, BOB, false));
    assertTrue(ContextFileVisibility.isVisibleToUser(file, ALICE, false));
  }

  @Test
  void onlyAnOwnerOrAnAdminMayRestrictAFile() {
    ContextFile open = fileOwnedBy(ALICE, null);
    ContextFile restricted = fileOwnedBy(ALICE, MemoryVisibility.PRIVATE);

    assertThrows(ForbiddenException.class, () -> restrictAs(BOB, false, open, restricted));
    assertDoesNotThrow(() -> restrictAs(ALICE, false, open, restricted));
    assertDoesNotThrow(() -> restrictAs(BOB, true, open, restricted));
  }

  @Test
  void aFileNobodyOwnsCanOnlyBeRestrictedByAnAdmin() {
    ContextFile open = new ContextFile();
    ContextFile restricted =
        new ContextFile()
            .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.SHARED));

    assertThrows(ForbiddenException.class, () -> restrictAs(BOB, false, open, restricted));
    assertDoesNotThrow(() -> restrictAs(BOB, true, open, restricted));
  }

  @Test
  void openingAFileUpOrLeavingItsSharingAloneIsNotRestricting() {
    ContextFile restricted = fileOwnedBy(ALICE, MemoryVisibility.PRIVATE);
    ContextFile opened = fileOwnedBy(ALICE, MemoryVisibility.ENTITY);

    assertDoesNotThrow(() -> restrictAs(BOB, false, restricted, opened));
    assertDoesNotThrow(() -> restrictAs(BOB, false, restricted, restricted));
  }

  @Test
  void aPatchTouchesSharingOnlyWhenItWritesTheShareConfig() {
    JsonPatch sharing =
        Json.createPatchBuilder().replace("/shareConfig/visibility", "Private").build();
    JsonPatch description = Json.createPatchBuilder().replace("/description", "notes").build();

    assertTrue(ContextFileVisibility.touchesSharing(sharing));
    assertFalse(ContextFileVisibility.touchesSharing(description));
  }

  private static void restrictAs(
      String userName, boolean admin, ContextFile original, ContextFile updated) {
    SecurityContext securityContext = securityContextFor(userName);
    try (MockedStatic<DefaultAuthorizer> authorizer = Mockito.mockStatic(DefaultAuthorizer.class)) {
      authorizer
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(
              new SubjectContext(new User().withName(userName).withIsAdmin(admin), null, null));
      ContextFileVisibility.requireOwnerToRestrict(original, updated, securityContext);
    }
  }

  private static ResultList<ContextFile> visibleTo(
      String userName, boolean admin, ResultList<ContextFile> page) {
    SecurityContext securityContext = securityContextFor(userName);
    try (MockedStatic<DefaultAuthorizer> authorizer = Mockito.mockStatic(DefaultAuthorizer.class)) {
      authorizer
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(
              new SubjectContext(new User().withName(userName).withIsAdmin(admin), null, null));
      return ContextFileVisibility.filterByVisibility(page, securityContext);
    }
  }

  private static ContextFile fileOwnedBy(String owner, MemoryVisibility visibility) {
    ContextFile file = new ContextFile().withOwners(List.of(new EntityReference().withName(owner)));
    return visibility == null
        ? file
        : file.withShareConfig(new MemoryShareConfig().withVisibility(visibility));
  }

  private static SecurityContext securityContextFor(String userName) {
    Principal principal = Mockito.mock(Principal.class);
    Mockito.when(principal.getName()).thenReturn(userName);
    SecurityContext securityContext = Mockito.mock(SecurityContext.class);
    Mockito.when(securityContext.getUserPrincipal()).thenReturn(principal);
    return securityContext;
  }
}
