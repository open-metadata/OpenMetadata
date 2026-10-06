package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.ContextMemoryType;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.models.ListParams;
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
      [{"op":"replace","path":"/entityStatus","value":"%s"},
       {"op":"add","path":"/supersededBy","value":{"id":"%s","type":"%s"}},
       {"op":"add","path":"/statusReason","value":"%s"}]""";

  private static final String ADD_DISPUTE =
      """
      [{"op":"add","path":"/disputes","value":[{"memory":{"id":"%s","type":"contextMemory"},\
      "reason":"%s","detectedAt":1700000000000}]}]""";

  @ParameterizedTest
  @EnumSource(
      value = EntityStatus.class,
      names = {"DEPRECATED", "SUPERSEDED"})
  void superseding_storesTheSuccessorAndTheOwnersRestoreClearsIt(
      EntityStatus retirementStage, TestNamespace ns) {
    ContextMemory keeper = admin().create(memory(ns, "keeper"));
    ContextMemory duplicate =
        admin().create(memory(ns, "duplicate").withOwners(List.of(SharedEntities.get().USER1_REF)));

    ContextMemory superseded =
        admin()
            .patch(idOf(duplicate), supersede(keeper, "Same fact as the keeper", retirementStage));

    assertEquals(retirementStage, superseded.getEntityStatus());
    assertEquals(keeper.getName(), superseded.getSupersededBy().getName(), "stored resolved");
    assertEquals("Same fact as the keeper", superseded.getStatusReason());
    assertTrue(
        changedFields(superseded)
            .containsAll(Set.of("entityStatus", "supersededBy", "statusReason")));

    ContextMemory restored = user1().patch(idOf(duplicate), status(EntityStatus.APPROVED));

    assertEquals(EntityStatus.APPROVED, restored.getEntityStatus());
    assertNull(restored.getSupersededBy(), "leaving a superseded stage clears supersededBy");
    assertNull(restored.getStatusReason(), "a status change without a reason drops the stale one");
    ContextMemory previous = admin().getVersion(idOf(duplicate), superseded.getVersion());
    assertEquals(keeper.getId(), previous.getSupersededBy().getId(), "history keeps the successor");
  }

  @ParameterizedTest
  @EnumSource(
      value = EntityStatus.class,
      names = {"DEPRECATED", "SUPERSEDED"})
  void superseding_withoutASuccessor_isRejected(EntityStatus retirementStage, TestNamespace ns) {
    ContextMemory memory = admin().create(memory(ns, "no-successor"));

    InvalidRequestException error =
        assertThrows(
            InvalidRequestException.class,
            () -> admin().patch(idOf(memory), status(retirementStage)));

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
    assertEquals(EntityStatus.APPROVED, admin().get(idOf(memory)).getEntityStatus());
    assertNull(admin().get(idOf(memory)).getSupersededBy());
  }

  @Test
  void aSuccessor_onANonDeprecatedMemory_isRejected(TestNamespace ns) {
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

    assertTrue(error.getMessage().contains("only allowed on a Deprecated memory"));
  }

  @ParameterizedTest
  @EnumSource(
      value = EntityStatus.class,
      names = {"REJECTED", "INVALIDATED"})
  void invalidating_keepsTheReasonAndTheOwnersRestoreDropsIt(
      EntityStatus retirementStage, TestNamespace ns) {
    ContextMemory memory =
        admin()
            .create(memory(ns, "invalidated").withOwners(List.of(SharedEntities.get().USER1_REF)));
    String invalidate =
        """
        [{"op":"replace","path":"/entityStatus","value":"%s"},
         {"op":"add","path":"/statusReason","value":"Anchor table sales.orders was deleted"}]"""
            .formatted(retirementStage.value());

    ContextMemory invalidated = admin().patch(idOf(memory), JsonUtils.readTree(invalidate));
    ContextMemory restored = user1().patch(idOf(memory), status(EntityStatus.APPROVED));

    assertEquals(retirementStage, invalidated.getEntityStatus());
    assertEquals("Anchor table sales.orders was deleted", invalidated.getStatusReason());
    assertEquals(EntityStatus.APPROVED, restored.getEntityStatus());
    assertNull(restored.getStatusReason());
  }

  @Test
  void transitionsOutsideTheTable_areRejected(TestNamespace ns) {
    ContextMemory keeper = admin().create(memory(ns, "table-keeper"));
    ContextMemory draft = admin().create(memory(ns, "draft").withEntityStatus(EntityStatus.DRAFT));
    ContextMemory invalidated =
        admin().create(memory(ns, "born-invalidated").withEntityStatus(EntityStatus.REJECTED));

    assertThrows(
        InvalidRequestException.class,
        () -> admin().patch(idOf(draft), supersede(keeper, "draft")));
    assertThrows(
        InvalidRequestException.class,
        () -> admin().patch(idOf(invalidated), supersede(keeper, "invalidated")));
  }

  @ParameterizedTest
  @EnumSource(
      value = EntityStatus.class,
      names = {"DEPRECATED", "SUPERSEDED"})
  void creatingASupersededMemoryWithoutASuccessor_isRejected(
      EntityStatus retirementStage, TestNamespace ns) {
    assertThrows(
        InvalidRequestException.class,
        () -> admin().create(memory(ns, "born-superseded").withEntityStatus(retirementStage)));
  }

  @Test
  void creatingWithoutStatus_defaultsToUnprocessed(TestNamespace ns) {
    ContextMemory memory = admin().create(memory(ns, "default-unprocessed").withEntityStatus(null));

    assertEquals(EntityStatus.UNPROCESSED, memory.getEntityStatus());
  }

  @ParameterizedTest
  @EnumSource(
      value = EntityStatus.class,
      names = {"SUPERSEDED", "INVALIDATED"})
  void anUnprocessedMemoryCanBeRetired(EntityStatus stage, TestNamespace ns) {
    ContextMemory pending = admin().create(memory(ns, "pending").withEntityStatus(null));
    ContextMemory keeper = admin().create(memory(ns, "pending-keeper"));
    JsonNode patch =
        stage == EntityStatus.SUPERSEDED ? supersede(keeper, "Duplicate") : status(stage);

    ContextMemory retired = admin().patch(idOf(pending), patch);

    assertEquals(stage, retired.getEntityStatus());
    assertEquals(stage, admin().get(idOf(pending)).getEntityStatus());
  }

  @Test
  void approvingAndAmending_preservesApprovalUntilExplicitlyRequeued(TestNamespace ns) {
    ContextMemory pending = admin().create(memory(ns, "reviewed-memory").withEntityStatus(null));
    ContextMemory approved = admin().patch(idOf(pending), status(EntityStatus.APPROVED));
    ContextMemory amended =
        admin()
            .patch(
                idOf(approved),
                JsonUtils.readTree(
                    """
                    [{"op":"replace","path":"/answer","value":"The user-approved definition."}]"""));

    assertEquals(EntityStatus.APPROVED, amended.getEntityStatus());
    assertEquals("The user-approved definition.", amended.getAnswer());

    ContextMemory requeued = admin().patch(idOf(amended), status(EntityStatus.UNPROCESSED));
    assertEquals(EntityStatus.UNPROCESSED, requeued.getEntityStatus());
    assertEquals(amended.getAnswer(), requeued.getAnswer());
  }

  @ParameterizedTest
  @EnumSource(
      value = EntityStatus.class,
      names = {"REJECTED", "INVALIDATED"})
  void statusSelectionCombinesWithSearchAndAuthorWithoutChangingOrdinarySearch(
      EntityStatus retirementStage, TestNamespace ns) {
    String query = "statusfilter" + UUID.randomUUID().toString().substring(0, 8);
    ContextMemory active =
        admin()
            .create(
                memory(ns, "status-active")
                    .withQuestion(query)
                    .withOwners(List.of(SharedEntities.get().USER1_REF)));
    ContextMemory invalidated =
        admin()
            .create(
                memory(ns, "status-invalidated")
                    .withQuestion(query)
                    .withOwners(List.of(SharedEntities.get().USER1_REF)));
    admin().patch(idOf(invalidated), status(retirementStage));
    admin().create(memory(ns, "other-author").withQuestion(query));

    ListParams ordinary = new ListParams().setLimit(20).addFilter("q", query);
    ListParams filtered =
        new ListParams()
            .setLimit(20)
            .addFilter("q", query)
            .addFilter("author", SharedEntities.get().USER1_REF.getId().toString())
            .addFilter("statuses", "Approved," + retirementStage.value());
    Awaitility.await()
        .atMost(Duration.ofSeconds(120))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              assertTrue(
                  admin().list(ordinary).getData().stream()
                      .anyMatch(m -> m.getId().equals(active.getId())));
              assertFalse(
                  admin().list(ordinary).getData().stream()
                      .anyMatch(m -> m.getId().equals(invalidated.getId())));
              assertEquals(
                  Set.of(active.getId(), invalidated.getId()),
                  admin().list(filtered).getData().stream()
                      .map(ContextMemory::getId)
                      .collect(Collectors.toSet()));
            });
    assertThrows(
        InvalidRequestException.class,
        () -> admin().list(new ListParams().addFilter("statuses", "Approved,Unknown")));
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
    assertEquals(EntityStatus.APPROVED, disputed.getEntityStatus(), "a dispute keeps both Active");
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

  @ParameterizedTest
  @EnumSource(
      value = EntityStatus.class,
      names = {"DEPRECATED", "SUPERSEDED"})
  void putPreservesLifecycleWhenStatusIsOmitted(EntityStatus retirementStage, TestNamespace ns) {
    ContextMemory keeper = admin().create(memory(ns, "put-keeper"));
    ContextMemory other = admin().create(memory(ns, "put-dispute"));
    ContextMemory original = admin().create(memory(ns, "put-lifecycle"));
    ContextMemory superseded =
        admin().patch(idOf(original), supersede(keeper, "Duplicate fact", retirementStage));
    admin()
        .patch(
            idOf(original), JsonUtils.readTree(ADD_DISPUTE.formatted(other.getId(), "Conflicts")));

    ContextMemory updated =
        admin()
            .put(
                memory(ns, "put-lifecycle")
                    .withEntityStatus(null)
                    .withAnswer("Re-extracted answer"));

    assertEquals(retirementStage, updated.getEntityStatus());
    assertEquals(keeper.getId(), updated.getSupersededBy().getId());
    assertEquals("Duplicate fact", updated.getStatusReason());
    assertEquals(other.getId(), updated.getDisputes().getFirst().getMemory().getId());
    assertEquals("Re-extracted answer", updated.getAnswer());
    assertEquals(retirementStage, superseded.getEntityStatus());
  }

  @Test
  void lifecycleReferencesMustBeReadableByTheEditor(TestNamespace ns) {
    ContextMemory privateTarget =
        admin()
            .create(
                memory(ns, "private-target")
                    .withOwners(List.of(SharedEntities.get().USER2_REF))
                    .withShareConfig(
                        new MemoryShareConfig().withVisibility(MemoryVisibility.PRIVATE)));
    ContextMemory editable =
        admin().create(memory(ns, "editable").withOwners(List.of(SharedEntities.get().USER1_REF)));

    InvalidRequestException supersedeError =
        assertThrows(
            InvalidRequestException.class,
            () -> user1().patch(idOf(editable), supersede(privateTarget, "Hidden keeper")));
    InvalidRequestException disputeError =
        assertThrows(
            InvalidRequestException.class,
            () ->
                user1()
                    .patch(
                        idOf(editable),
                        JsonUtils.readTree(
                            ADD_DISPUTE.formatted(privateTarget.getId(), "Hidden dispute"))));

    assertTrue(supersedeError.getMessage().contains("readable, non-deleted"));
    assertTrue(disputeError.getMessage().contains("readable, non-deleted"));
    ContextMemory unchanged = admin().get(idOf(editable));
    assertEquals(EntityStatus.APPROVED, unchanged.getEntityStatus());
    assertNull(unchanged.getSupersededBy());
    assertTrue(listOrEmpty(unchanged.getDisputes()).isEmpty());
  }

  /** A second status change must validate against the current status, not the session baseline. */
  @Test
  void inSessionConsolidation_doesNotReplayTransitionsBackwards(TestNamespace ns) {
    ContextMemory draft =
        admin().create(memory(ns, "consolidated").withEntityStatus(EntityStatus.DRAFT));

    admin().patch(idOf(draft), status(EntityStatus.APPROVED));
    ContextMemory archived = admin().patch(idOf(draft), status(EntityStatus.REJECTED));

    assertEquals(EntityStatus.REJECTED, archived.getEntityStatus());
  }

  @Test
  void removingStatusIsRejectedWithoutChangingTheMemory(TestNamespace ns) {
    ContextMemory memory = admin().create(memory(ns, "status-required"));

    assertThrows(
        InvalidRequestException.class,
        () ->
            admin()
                .patch(
                    idOf(memory),
                    JsonUtils.readTree("[{\"op\":\"remove\",\"path\":\"/entityStatus\"}]")));
    assertEquals(EntityStatus.APPROVED, admin().get(idOf(memory)).getEntityStatus());
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

  @ParameterizedTest
  @EnumSource(
      value = EntityStatus.class,
      names = {"DEPRECATED", "SUPERSEDED"})
  void aSupersededMemory_disappearsFromSearchButRemainsReadableById(
      EntityStatus retirementStage, TestNamespace ns) {
    ContextMemory keeper = admin().create(memory(ns, "search-keeper"));
    ContextMemory duplicate = admin().create(memory(ns, "search-duplicate"));

    Awaitility.await("the Active memory is searchable")
        .pollInterval(Duration.ofSeconds(2))
        .atMost(Duration.ofSeconds(120))
        .ignoreExceptions()
        .untilAsserted(
            () -> assertTrue(searchMemoryById(duplicate.getId()).contains(idOf(duplicate))));

    admin()
        .patch(idOf(duplicate), supersede(keeper, "Indexed with its successor", retirementStage));

    Awaitility.await("the superseded memory is removed from search results")
        .pollInterval(Duration.ofSeconds(2))
        .atMost(Duration.ofSeconds(120))
        .ignoreExceptions()
        .untilAsserted(
            () -> assertFalse(searchMemoryById(duplicate.getId()).contains(idOf(duplicate))));
    assertEquals(retirementStage, admin().get(idOf(duplicate)).getEntityStatus());
  }

  @ParameterizedTest
  @EnumSource(
      value = EntityStatus.class,
      names = {"REJECTED", "INVALIDATED"})
  void anInvalidatedMemory_disappearsFromSearchButRemainsReadableById(
      EntityStatus retirementStage, TestNamespace ns) {
    ContextMemory memory = admin().create(memory(ns, "search-invalidated"));

    Awaitility.await("the Active memory is searchable")
        .pollInterval(Duration.ofSeconds(2))
        .atMost(Duration.ofSeconds(120))
        .ignoreExceptions()
        .untilAsserted(() -> assertTrue(searchMemoryById(memory.getId()).contains(idOf(memory))));

    admin().patch(idOf(memory), status(retirementStage));

    Awaitility.await("the invalidated memory is removed from search results")
        .pollInterval(Duration.ofSeconds(2))
        .atMost(Duration.ofSeconds(120))
        .ignoreExceptions()
        .untilAsserted(() -> assertFalse(searchMemoryById(memory.getId()).contains(idOf(memory))));
    assertEquals(retirementStage, admin().get(idOf(memory)).getEntityStatus());
  }

  private static String searchMemoryById(UUID id) {
    return SdkClients.adminClient()
        .search()
        .query("*")
        .index("context_memory_search_index")
        .queryFilter("{\"query\":{\"term\":{\"id.keyword\":\"" + id + "\"}}}")
        .execute();
  }

  private static CreateContextMemory memory(TestNamespace ns, String name) {
    return new CreateContextMemory()
        .withName(ns.prefix(ns.shortPrefix(name)))
        .withEntityStatus(EntityStatus.APPROVED)
        .withQuestion("Which table holds the canonical orders?")
        .withAnswer("sales.orders is the canonical orders table.");
  }

  private static JsonNode supersede(ContextMemory successor, String reason) {
    return supersede(successor, reason, EntityStatus.SUPERSEDED);
  }

  private static JsonNode supersede(
      ContextMemory successor, String reason, EntityStatus retirementStage) {
    return JsonUtils.readTree(
        SUPERSEDE.formatted(
            retirementStage.value(), successor.getId(), Entity.CONTEXT_MEMORY, reason));
  }

  private static JsonNode supersede(UUID successorId, String successorType, String reason) {
    return JsonUtils.readTree(
        SUPERSEDE.formatted(EntityStatus.SUPERSEDED.value(), successorId, successorType, reason));
  }

  private static JsonNode status(EntityStatus status) {
    return JsonUtils.readTree(
        "[{\"op\":\"replace\",\"path\":\"/entityStatus\",\"value\":\"" + status.value() + "\"}]");
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
