package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.it.factories.ShortStackFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryScope;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.context.ContextMemoryService;
import org.openmetadata.service.Entity;

/**
 * What a user who is neither an admin nor a bot may write into a memory now that every user may
 * create them (ADR:2026-10-09-data-consumers-create-context-memories): only their own memories,
 * never one handed to someone else, and never one pointing at an entity they cannot view.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ContextMemoryWriteAccessIT {

  @Test
  void aUserCannotPlantAPreferenceInSomeoneElsesAgent(TestNamespace ns) {
    User author = createUser(ns, null);
    User victim = createUser(ns, null);
    CreateContextMemory preference = preference(ns, "planted").withOwners(List.of(userRef(victim)));

    assertThrows(ForbiddenException.class, () -> memoriesAs(author).create(preference));
    assertThrows(ForbiddenException.class, () -> memoriesAs(author).put(preference));
  }

  @Test
  void anAdminStillWritesAMemoryForSomeoneElse(TestNamespace ns) {
    User owner = createUser(ns, null);

    ContextMemory memory =
        adminMemories().create(preference(ns, "for-owner").withOwners(List.of(userRef(owner))));

    assertEquals(List.of(owner.getId()), ownerIds(memory));
  }

  @ParameterizedTest
  @EnumSource(
      value = ContextMemorySourceType.class,
      names = {"FILE_EXTRACTION", "PAGE_EXTRACTION"})
  void aUserCannotCreateExtractionProvenance(ContextMemorySourceType sourceType, TestNamespace ns) {
    ContextMemoryService author = memoriesAs(createUser(ns, null));
    CreateContextMemory request =
        entityMemory(ns, "forged-source-" + sourceType.name()).withSourceType(sourceType);

    assertThrows(ForbiddenException.class, () -> author.create(request));
    assertThrows(ForbiddenException.class, () -> author.put(request));
  }

  @ParameterizedTest
  @EnumSource(
      value = ContextMemorySourceType.class,
      names = {"FILE_EXTRACTION", "PAGE_EXTRACTION"})
  void anOwnerCannotTurnTheirMemoryIntoAnExtractedPill(
      ContextMemorySourceType sourceType, TestNamespace ns) {
    ContextMemoryService author = memoriesAs(createUser(ns, null));
    CreateContextMemory request =
        entityMemory(ns, "manual-source-" + sourceType.name())
            .withSourceType(ContextMemorySourceType.MANUAL);
    ContextMemory memory = author.create(request);

    assertThrows(ForbiddenException.class, () -> author.put(request.withSourceType(sourceType)));
    assertEquals(
        ContextMemorySourceType.MANUAL, author.get(memory.getId().toString()).getSourceType());
    assertThrows(
        ForbiddenException.class, () -> author.patch(memory.getId(), sourceTypePatch(sourceType)));
    assertEquals(
        ContextMemorySourceType.MANUAL, author.get(memory.getId().toString()).getSourceType());
  }

  @ParameterizedTest
  @EnumSource(
      value = ContextMemorySourceType.class,
      names = {"FILE_EXTRACTION", "PAGE_EXTRACTION"})
  void anAdminMayCreateAndChangeExtractionProvenance(
      ContextMemorySourceType sourceType, TestNamespace ns) {
    CreateContextMemory request =
        entityMemory(ns, "admin-extracted-" + sourceType.name()).withSourceType(sourceType);
    ContextMemory memory = adminMemories().create(request);
    assertEquals(sourceType, memory.getSourceType());
    assertEquals(sourceType, adminMemories().put(request).getSourceType());

    ContextMemory manual =
        adminMemories()
            .create(
                entityMemory(ns, "admin-manual-" + sourceType.name())
                    .withSourceType(ContextMemorySourceType.MANUAL));
    assertEquals(
        sourceType,
        adminMemories().patch(manual.getId(), sourceTypePatch(sourceType)).getSourceType());
  }

  @Test
  void aReaderMayEditExtractedMemoriesWithoutClaimingNewProvenance(TestNamespace ns) {
    User owner = createUser(ns, null);
    CreateContextMemory request =
        entityMemory(ns, "extracted-and-describable")
            .withSourceType(ContextMemorySourceType.FILE_EXTRACTION)
            .withOwners(List.of(userRef(owner)));
    ContextMemory memory = adminMemories().create(request);

    assertEquals(
        ContextMemorySourceType.FILE_EXTRACTION, memoriesAs(owner).put(request).getSourceType());
    ContextMemory described =
        memoriesAs(createUser(ns, null))
            .patch(
                memory.getId(),
                JsonUtils.readTree(
                    "[{\"op\":\"add\",\"path\":\"/description\",\"value\":\"Totals per order\"}]"));
    assertEquals("Totals per order", described.getDescription());
    assertEquals(ContextMemorySourceType.FILE_EXTRACTION, described.getSourceType());
  }

  @Test
  void editAllCannotRevealAnotherUsersPrivateMemoryThroughPutOrPin(TestNamespace ns) {
    CreateContextMemory request = preference(ns, "private-for-edits");
    ContextMemory hidden = memoriesAs(createUser(ns, null)).create(request);
    User editor = createUser(ns, allowMemoryEdits(ns));
    ContextMemoryService edits = memoriesAs(editor);

    assertThrows(ForbiddenException.class, () -> edits.put(request));
    assertThrows(ForbiddenException.class, () -> setPinnedAs(editor, hidden.getId(), true));
    assertThrows(ForbiddenException.class, () -> setPinnedAs(editor, hidden.getId(), false));
    ContextMemory unchanged = adminMemories().get(hidden.getId().toString());
    assertEquals(hidden.getVersion(), unchanged.getVersion());
    assertEquals(hidden.getPinned(), unchanged.getPinned());

    CreateContextMemory visibleRequest = entityMemory(ns, "visible-for-edits");
    ContextMemory visible = edits.put(visibleRequest);
    assertEquals(visible.getId(), edits.put(visibleRequest).getId());
    assertEquals(true, setPinnedAs(editor, visible.getId(), true).getPinned());
    assertEquals(false, setPinnedAs(editor, visible.getId(), false).getPinned());
  }

  private static ContextMemory setPinnedAs(User user, UUID id, boolean pinned) {
    OpenMetadataClient client =
        SdkClients.createClient(user.getEmail(), user.getEmail(), new String[] {});
    return client
        .getHttpClient()
        .execute(
            pinned ? HttpMethod.PUT : HttpMethod.DELETE,
            "/v1/contextCenter/memories/" + id + "/pin",
            null,
            ContextMemory.class);
  }

  private static JsonNode sourceTypePatch(ContextMemorySourceType sourceType) {
    return JsonUtils.readTree(
        "[{\"op\":\"replace\",\"path\":\"/sourceType\",\"value\":\"" + sourceType.value() + "\"}]");
  }

  private static Role allowMemoryEdits(TestNamespace ns) {
    Rule allow =
        new Rule()
            .withName("AllowMemoryEdits")
            .withEffect(Rule.Effect.ALLOW)
            .withOperations(List.of(MetadataOperation.EDIT_ALL))
            .withResources(List.of("all"));
    Policy policy =
        SdkClients.adminClient()
            .policies()
            .create(
                new CreatePolicy().withName(ns.prefix("memory-editor")).withRules(List.of(allow)));
    return SdkClients.adminClient()
        .roles()
        .create(
            new CreateRole()
                .withName(ns.prefix("memory-editor"))
                .withPolicies(List.of(policy.getFullyQualifiedName())));
  }

  @Test
  void anOwnerCannotHandTheirMemoryToSomeoneElse(TestNamespace ns) {
    User owner = createUser(ns, null);
    User other = createUser(ns, null);
    ContextMemoryService memories = memoriesAs(owner);
    ContextMemory memory = memories.create(preference(ns, "kept"));

    assertThrows(
        ForbiddenException.class,
        () ->
            memories.patch(
                memory.getId(),
                JsonUtils.readTree(
                    "[{\"op\":\"add\",\"path\":\"/owners/-\",\"value\":{\"id\":\""
                        + other.getId()
                        + "\",\"type\":\"user\"}}]")));
    assertEquals(List.of(owner.getId()), ownerIds(memory));
  }

  @Test
  void aMissingOrUnviewableAnchorIsRefusedTheSameWay(TestNamespace ns) {
    Table anchor = ShortStackFactory.table(ns);
    ContextMemoryService blocked = memoriesAs(createUser(ns, denyTableView(ns)));
    EntityReference missing =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.TABLE);

    InvalidRequestException unviewable =
        assertThrows(
            InvalidRequestException.class,
            () ->
                blocked.create(entityMemory(ns, "unviewable").withPrimaryEntity(tableRef(anchor))));
    InvalidRequestException absent =
        assertThrows(
            InvalidRequestException.class,
            () -> blocked.create(entityMemory(ns, "absent").withPrimaryEntity(missing)));

    assertTrue(unviewable.getMessage().contains("primaryEntity must reference an entity you can"));
    assertEquals(unviewable.getMessage(), absent.getMessage());
  }

  @Test
  void aRelatedEntityTheWriterCannotViewIsRefused(TestNamespace ns) {
    Table viewable = ShortStackFactory.table(ns);
    ContextMemory hiddenMemory =
        memoriesAs(createUser(ns, null)).create(preference(ns, "someone-elses"));
    ContextMemoryService author = memoriesAs(createUser(ns, null));

    InvalidRequestException refused =
        assertThrows(
            InvalidRequestException.class,
            () ->
                author.create(
                    entityMemory(ns, "relates-to-private")
                        .withPrimaryEntity(tableRef(viewable))
                        .withRelatedEntities(List.of(hiddenMemory.getEntityReference()))));
    assertTrue(refused.getMessage().contains("relatedEntities must reference an entity you can"));
  }

  @Test
  void nobodyReadsAnotherUsersPrivateMemoryByPatchingIt(TestNamespace ns) {
    ContextMemory privateOne =
        memoriesAs(createUser(ns, null)).create(preference(ns, "private-preference"));
    ContextMemoryService other = memoriesAs(createUser(ns, null));

    assertThrows(
        ForbiddenException.class,
        () ->
            other.patch(
                privateOne.getId(),
                JsonUtils.readTree(
                    "[{\"op\":\"add\",\"path\":\"/description\",\"value\":\"read me\"}]")));
  }

  @Test
  void aReaderOfAnEntityMemoryMayStillEditItsDescription(TestNamespace ns) {
    Table anchor = ShortStackFactory.table(ns);
    ContextMemory memory =
        memoriesAs(createUser(ns, null))
            .create(entityMemory(ns, "describable").withPrimaryEntity(tableRef(anchor)));

    ContextMemory described =
        memoriesAs(createUser(ns, null))
            .patch(
                memory.getId(),
                JsonUtils.readTree(
                    "[{\"op\":\"add\",\"path\":\"/description\",\"value\":\"Totals per order\"}]"));

    assertEquals("Totals per order", described.getDescription());
  }

  private static CreateContextMemory preference(TestNamespace ns, String name) {
    return new CreateContextMemory()
        .withName(ns.prefix(name))
        .withMemoryScope(ContextMemoryScope.USER_GLOBAL)
        .withEntityStatus(ContextMemoryStatus.APPROVED)
        .withQuestion("How should answers be formatted?")
        .withAnswer("Always answer in bullet points.")
        .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.PRIVATE));
  }

  private static CreateContextMemory entityMemory(TestNamespace ns, String name) {
    return new CreateContextMemory()
        .withName(ns.prefix(name))
        .withMemoryScope(ContextMemoryScope.ENTITY_SCOPED)
        .withEntityStatus(ContextMemoryStatus.APPROVED)
        .withQuestion("Which column holds the order total?")
        .withAnswer("orders.amount_usd, in US dollars.")
        .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.ENTITY));
  }

  private static Role denyTableView(TestNamespace ns) {
    Rule deny =
        new Rule()
            .withName("DenyTableView")
            .withEffect(Rule.Effect.DENY)
            .withOperations(List.of(MetadataOperation.VIEW_ALL))
            .withResources(List.of(Entity.TABLE));
    Policy policy =
        SdkClients.adminClient()
            .policies()
            .create(
                new CreatePolicy().withName(ns.prefix("deny-table-view")).withRules(List.of(deny)));
    return SdkClients.adminClient()
        .roles()
        .create(
            new CreateRole()
                .withName(ns.prefix("no-tables"))
                .withPolicies(List.of(policy.getFullyQualifiedName())));
  }

  private static User createUser(TestNamespace ns, Role role) {
    String name = "cmwrite_" + UUID.randomUUID().toString().substring(0, 8);
    CreateUser request = new CreateUser().withName(name).withEmail(name + "@test.openmetadata.org");
    if (role != null) {
      request.withRoles(List.of(role.getId()));
    }
    return ns.trackRoot(Entity.USER, SdkClients.adminClient().users().create(request));
  }

  private static ContextMemoryService memoriesAs(User user) {
    OpenMetadataClient client =
        SdkClients.createClient(user.getEmail(), user.getEmail(), new String[] {});
    return new ContextMemoryService(client.getHttpClient());
  }

  private static ContextMemoryService adminMemories() {
    return new ContextMemoryService(SdkClients.adminClient().getHttpClient());
  }

  private static List<UUID> ownerIds(ContextMemory memory) {
    return adminMemories().get(memory.getId().toString(), Entity.FIELD_OWNERS).getOwners().stream()
        .map(EntityReference::getId)
        .toList();
  }

  private static EntityReference userRef(User user) {
    return new EntityReference().withId(user.getId()).withType(Entity.USER);
  }

  private static EntityReference tableRef(Table table) {
    return new EntityReference().withId(table.getId()).withType(Entity.TABLE);
  }
}
