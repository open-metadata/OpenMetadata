package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.ContextMemoryType;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.services.context.ContextMemoryService;
import org.openmetadata.service.Entity;

/**
 * Lifecycle of a context memory over the REST API. A memory is patched at most once per principal
 * unless a test is about in-session consolidation, so versions are never merged under a test.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ContextMemoryLifecycleIT {

  private static final String SUPERSEDE =
      """
      [{"op":"replace","path":"/status","value":"Superseded"},
       {"op":"add","path":"/supersededBy","value":{"id":"%s","type":"%s"}},
       {"op":"add","path":"/statusReason","value":"%s"}]""";

  private static final String ADD_DISPUTE =
      """
      [{"op":"add","path":"/disputes","value":[{"memory":{"id":"%s","type":"contextMemory"},\
      "reason":"%s","detectedAt":1700000000000}]}]""";

  @Test
  void superseding_storesTheSuccessorAndTheOwnersRestoreClearsIt(TestNamespace ns) {
    ContextMemory keeper = admin().create(memory(ns, "keeper"));
    ContextMemory duplicate =
        admin().create(memory(ns, "duplicate").withOwners(List.of(SharedEntities.get().USER1_REF)));

    ContextMemory superseded =
        admin().patch(idOf(duplicate), supersede(keeper, "Same fact as the keeper"));

    assertEquals(ContextMemoryStatus.SUPERSEDED, superseded.getStatus());
    assertEquals(keeper.getName(), superseded.getSupersededBy().getName(), "stored resolved");
    assertEquals("Same fact as the keeper", superseded.getStatusReason());
    assertTrue(
        changedFields(superseded).containsAll(Set.of("status", "supersededBy", "statusReason")));

    ContextMemory restored = user1().patch(idOf(duplicate), status(ContextMemoryStatus.ACTIVE));

    assertEquals(ContextMemoryStatus.ACTIVE, restored.getStatus());
    assertNull(restored.getSupersededBy(), "leaving Superseded clears supersededBy");
    assertNull(restored.getStatusReason(), "a status change without a reason drops the stale one");
    ContextMemory previous = admin().getVersion(idOf(duplicate), superseded.getVersion());
    assertEquals(keeper.getId(), previous.getSupersededBy().getId(), "history keeps the successor");
  }

  @Test
  void superseding_withoutASuccessor_isRejected(TestNamespace ns) {
    ContextMemory memory = admin().create(memory(ns, "no-successor"));

    InvalidRequestException error =
        assertThrows(
            InvalidRequestException.class,
            () -> admin().patch(idOf(memory), status(ContextMemoryStatus.SUPERSEDED)));

    assertTrue(error.getMessage().contains("requires supersededBy"));
  }

  @Test
  void aSuccessor_mustBeAnotherLiveContextMemory(TestNamespace ns) {
    ContextMemory memory = admin().create(memory(ns, "bad-successor"));
    ContextMemory deleted = admin().create(memory(ns, "deleted-keeper"));
    admin().delete(idOf(deleted));
    UUID userId = SharedEntities.get().USER1.getId();

    assertThrows(
        InvalidRequestException.class,
        () -> admin().patch(idOf(memory), supersede(memory, "self")));
    assertThrows(
        InvalidRequestException.class,
        () -> admin().patch(idOf(memory), supersede(deleted, "soft-deleted keeper")));
    assertThrows(
        InvalidRequestException.class,
        () -> admin().patch(idOf(memory), supersede(userId, Entity.USER, "not a memory")));
  }

  @Test
  void aSuccessor_onANonSupersededMemory_isRejected(TestNamespace ns) {
    ContextMemory keeper = admin().create(memory(ns, "stray-keeper"));
    ContextMemory memory = admin().create(memory(ns, "stray"));
    String stray =
        """
        [{"op":"add","path":"/supersededBy","value":{"id":"%s","type":"contextMemory"}}]"""
            .formatted(keeper.getId());

    InvalidRequestException error =
        assertThrows(
            InvalidRequestException.class,
            () -> admin().patch(idOf(memory), JsonUtils.readTree(stray)));

    assertTrue(error.getMessage().contains("only allowed on a Superseded memory"));
  }

  @Test
  void invalidating_keepsTheReasonAndTheOwnersRestoreDropsIt(TestNamespace ns) {
    ContextMemory memory =
        admin()
            .create(memory(ns, "invalidated").withOwners(List.of(SharedEntities.get().USER1_REF)));
    String invalidate =
        """
        [{"op":"replace","path":"/status","value":"Invalidated"},
         {"op":"add","path":"/statusReason","value":"Anchor table sales.orders was deleted"}]""";

    ContextMemory invalidated = admin().patch(idOf(memory), JsonUtils.readTree(invalidate));
    ContextMemory restored = user1().patch(idOf(memory), status(ContextMemoryStatus.ACTIVE));

    assertEquals("Anchor table sales.orders was deleted", invalidated.getStatusReason());
    assertEquals(ContextMemoryStatus.ACTIVE, restored.getStatus());
    assertNull(restored.getStatusReason());
  }

  @Test
  void transitionsOutsideTheTable_areRejected(TestNamespace ns) {
    ContextMemory keeper = admin().create(memory(ns, "table-keeper"));
    ContextMemory draft = admin().create(memory(ns, "draft").withStatus(ContextMemoryStatus.DRAFT));
    ContextMemory invalidated =
        admin().create(memory(ns, "born-invalidated").withStatus(ContextMemoryStatus.INVALIDATED));

    assertThrows(
        InvalidRequestException.class,
        () -> admin().patch(idOf(draft), supersede(keeper, "draft")));
    assertThrows(
        InvalidRequestException.class,
        () -> admin().patch(idOf(invalidated), supersede(keeper, "invalidated")));
  }

  @Test
  void creatingASupersededMemory_isRejected(TestNamespace ns) {
    assertThrows(
        InvalidRequestException.class,
        () ->
            admin()
                .create(memory(ns, "born-superseded").withStatus(ContextMemoryStatus.SUPERSEDED)));
  }

  @Test
  void disputes_areResolvedAndValidated(TestNamespace ns) {
    ContextMemory other = admin().create(memory(ns, "other-view"));
    ContextMemory memory = admin().create(memory(ns, "disputed"));
    ContextMemory untouched = admin().create(memory(ns, "disputed-invalid"));

    ContextMemory disputed =
        admin()
            .patch(
                idOf(memory),
                JsonUtils.readTree(
                    ADD_DISPUTE.formatted(other.getId(), "Fiscal Q1 starts in Feb")));

    assertEquals(other.getName(), disputed.getDisputes().getFirst().getMemory().getName());
    assertEquals(ContextMemoryStatus.ACTIVE, disputed.getStatus(), "a dispute keeps both Active");
    assertTrue(changedFields(disputed).contains("disputes"));
    assertThrows(
        InvalidRequestException.class,
        () ->
            admin()
                .patch(
                    idOf(untouched),
                    JsonUtils.readTree(ADD_DISPUTE.formatted(other.getId(), " "))));
    assertThrows(
        InvalidRequestException.class,
        () ->
            admin()
                .patch(
                    idOf(untouched),
                    JsonUtils.readTree(ADD_DISPUTE.formatted(untouched.getId(), "self"))));
  }

  /** Two PATCHes by one user inside the session merge; the merge must not replay Active→Draft. */
  @Test
  void inSessionConsolidation_doesNotReplayTransitionsBackwards(TestNamespace ns) {
    ContextMemory draft =
        admin().create(memory(ns, "consolidated").withStatus(ContextMemoryStatus.DRAFT));

    admin().patch(idOf(draft), status(ContextMemoryStatus.ACTIVE));
    ContextMemory archived = admin().patch(idOf(draft), status(ContextMemoryStatus.ARCHIVED));

    assertEquals(ContextMemoryStatus.ARCHIVED, archived.getStatus());
  }

  @Test
  void conversationExtraction_isGroundTruth_soContentEditsKeepTheSource(TestNamespace ns) {
    ContextMemory captured =
        admin()
            .create(
                memory(ns, "captured")
                    .withSourceType(ContextMemorySourceType.CONVERSATION_EXTRACTION)
                    .withMemoryType(ContextMemoryType.LEARNING));
    String edit =
        """
        [{"op":"replace","path":"/answer","value":"sales.orders_v2 replaced sales.orders in March."}]""";

    ContextMemory edited = admin().patch(idOf(captured), JsonUtils.readTree(edit));

    assertEquals(ContextMemorySourceType.CONVERSATION_EXTRACTION, edited.getSourceType());
    assertEquals(ContextMemoryType.LEARNING, edited.getMemoryType());
  }

  private static CreateContextMemory memory(TestNamespace ns, String name) {
    return new CreateContextMemory()
        .withName(ns.prefix(name))
        .withQuestion("Which table holds the canonical orders?")
        .withAnswer("sales.orders is the canonical orders table.");
  }

  private static JsonNode supersede(ContextMemory successor, String reason) {
    return supersede(successor.getId(), Entity.CONTEXT_MEMORY, reason);
  }

  private static JsonNode supersede(UUID successorId, String successorType, String reason) {
    return JsonUtils.readTree(SUPERSEDE.formatted(successorId, successorType, reason));
  }

  private static JsonNode status(ContextMemoryStatus status) {
    return JsonUtils.readTree(
        "[{\"op\":\"replace\",\"path\":\"/status\",\"value\":\"" + status.value() + "\"}]");
  }

  private static Set<String> changedFields(ContextMemory memory) {
    ChangeDescription change = memory.getChangeDescription();
    return Stream.of(change.getFieldsAdded(), change.getFieldsUpdated(), change.getFieldsDeleted())
        .flatMap(fields -> listOrEmpty(fields).stream())
        .map(FieldChange::getName)
        .collect(Collectors.toSet());
  }

  private static String idOf(ContextMemory memory) {
    return memory.getId().toString();
  }

  private static ContextMemoryService admin() {
    return new ContextMemoryService(SdkClients.adminClient().getHttpClient());
  }

  private static ContextMemoryService user1() {
    return new ContextMemoryService(SdkClients.user1Client().getHttpClient());
  }
}
