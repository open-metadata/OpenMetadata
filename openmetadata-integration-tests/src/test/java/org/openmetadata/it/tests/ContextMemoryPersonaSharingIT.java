package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.api.teams.CreatePersona;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemorySharedPrincipal;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.services.context.ContextMemoryService;
import org.openmetadata.service.Entity;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class ContextMemoryPersonaSharingIT {
  @Test
  void directPersonaGrantsAccessUntilItIsRemoved(TestNamespace ns) {
    Persona persona = createPersona(ns, "assigned");
    User holder =
        createUser(
            ns, "holder", new CreateUser().withPersonas(List.of(persona.getEntityReference())));
    User outsider = createUser(ns, "outsider", new CreateUser());
    ContextMemory memory = createSharedMemory(ns, persona);
    ContextMemoryService holderMemories = memoriesFor(holder);

    assertVisible(holderMemories, memory);
    assertHidden(memoriesFor(outsider), memory);

    String holderId = holder.getId().toString();
    User updated = SdkClients.adminClient().users().get(holderId, "personas");
    updated.setPersonas(List.of());
    SdkClients.adminClient().users().update(holderId, updated);

    assertHidden(holderMemories, memory);
  }

  @Test
  void inheritedPersonaGrantsAccess(TestNamespace ns) {
    Persona persona = createPersona(ns, "inherited");
    User holder = createUser(ns, "team_member", new CreateUser());
    ns.trackRoot(
        Entity.TEAM,
        SdkClients.adminClient()
            .teams()
            .create(
                new CreateTeam()
                    .withName(ns.shortPrefix("persona_sharing_team"))
                    .withTeamType(CreateTeam.TeamType.GROUP)
                    .withUsers(List.of(holder.getId()))
                    .withDefaultPersona(persona.getId())));
    ContextMemory memory = createSharedMemory(ns, persona);

    assertVisible(memoriesFor(holder), memory);
  }

  @Test
  void explicitDefaultPersonaGrantsAccessWithoutAnAssignment(TestNamespace ns) {
    Persona persona = createPersona(ns, "default");
    User holder =
        createUser(
            ns,
            "default_holder",
            new CreateUser().withDefaultPersona(persona.getEntityReference()));
    ContextMemory memory = createSharedMemory(ns, persona);

    assertVisible(memoriesFor(holder), memory);
  }

  @Test
  void deletedPersonaCannotBeSharedWith(TestNamespace ns) {
    Persona persona = createPersona(ns, "deleted");
    SdkClients.adminClient()
        .personas()
        .delete(persona.getId().toString(), Map.of("hardDelete", "true"));

    OpenMetadataException error =
        assertThrows(
            OpenMetadataException.class,
            () -> adminMemories().create(sharedMemoryRequest(ns, persona)));
    assertEquals(404, error.getStatusCode());
  }

  private static Persona createPersona(TestNamespace ns, String suffix) {
    return ns.trackRoot(
        Entity.PERSONA,
        SdkClients.adminClient()
            .personas()
            .create(new CreatePersona().withName(ns.shortPrefix("memory_persona_" + suffix))));
  }

  private static User createUser(TestNamespace ns, String suffix, CreateUser request) {
    String name = ns.shortPrefix("memory_persona_" + suffix);
    return ns.trackRoot(
        Entity.USER,
        SdkClients.adminClient()
            .users()
            .create(request.withName(name).withEmail(name + "@example.com")));
  }

  private static ContextMemory createSharedMemory(TestNamespace ns, Persona persona) {
    ContextMemoryService admin = adminMemories();
    ContextMemory memory =
        ns.trackRoot(Entity.CONTEXT_MEMORY, admin.create(sharedMemoryRequest(ns, persona)));
    assertEquals(
        persona.getId(), memory.getShareConfig().getSharedWith().getFirst().getPrincipal().getId());
    Awaitility.await()
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(() -> assertEquals(Set.of(memory.getId()), search(admin, memory)));
    return memory;
  }

  private static CreateContextMemory sharedMemoryRequest(TestNamespace ns, Persona persona) {
    return new CreateContextMemory()
        .withName(ns.prefix("persona-sharing"))
        .withTitle("personasharing" + ns.uniqueShortId())
        .withQuestion("Who can read this memory?")
        .withAnswer("Users who hold the shared persona.")
        .withShareConfig(
            new MemoryShareConfig()
                .withVisibility(MemoryVisibility.SHARED)
                .withSharedWith(
                    List.of(
                        new MemorySharedPrincipal().withPrincipal(persona.getEntityReference()))));
  }

  private static ContextMemoryService adminMemories() {
    return new ContextMemoryService(SdkClients.adminClient().getHttpClient());
  }

  private static ContextMemoryService memoriesFor(User user) {
    return new ContextMemoryService(
        SdkClients.createClient(user.getName(), user.getEmail(), new String[0]).getHttpClient());
  }

  private static void assertVisible(ContextMemoryService reader, ContextMemory memory) {
    assertEquals(memory.getId(), reader.get(memory.getId().toString()).getId());
    assertEquals(Set.of(memory.getId()), search(reader, memory));
  }

  private static void assertHidden(ContextMemoryService reader, ContextMemory memory) {
    assertThrows(ForbiddenException.class, () -> reader.get(memory.getId().toString()));
    assertEquals(Set.of(), search(reader, memory));
  }

  private static Set<UUID> search(ContextMemoryService reader, ContextMemory memory) {
    return reader.list(new ListParams().addQueryParam("q", memory.getTitle())).getData().stream()
        .map(ContextMemory::getId)
        .collect(Collectors.toSet());
  }
}
