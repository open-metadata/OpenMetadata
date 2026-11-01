/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.tests.mcp;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.api.data.CreateContextFile;
import org.openmetadata.schema.api.data.CreateFolder;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemorySharedPrincipal;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.Folder;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.services.context.ContextMemoryService;
import org.openmetadata.service.Entity;

/** Names shared by different principal types must never grant each other's access. */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class McpContextMemoryPrincipalIdentityIT extends McpTestBase {
  private static final String FILES = "contextCenter/drive/files";
  private static final String ANSWER = "the-budget-is-only-for-the-listed-principal";

  @BeforeAll
  static void authenticateAdmin() throws Exception {
    initAuth();
  }

  @ParameterizedTest
  @ValueSource(strings = {Entity.TEAM, Entity.DOMAIN})
  void sharingAdmitsMembersButDeniesNamesakes(String principalType, TestNamespace ns)
      throws Exception {
    EntityReference principal = createPrincipal(ns, principalType);
    User namesake = createUser(ns, new CreateUser().withName(principal.getName()));
    User member = createMember(ns, principal);
    MemoryShareConfig sharing =
        new MemoryShareConfig()
            .withVisibility(MemoryVisibility.SHARED)
            .withSharedWith(List.of(new MemorySharedPrincipal().withPrincipal(principal)));
    Folder folder =
        post(
            "contextCenter/drive/folders",
            new CreateFolder().withName(ns.shortPrefix("folder")),
            Folder.class);
    try {
      ContextFile file = createFile(ns, folder);
      ContextMemory memory = createMemory(ns, sharing, null, file);

      assertEquals(memory.getId(), memoriesAs(member).get(memory.getId().toString()).getId());
      assertListed(memory.getId(), member, true);
      assertMcpAnswer(memory, member, true);
      assertCompanyContextAnswer(memory, member, true);

      assertMemoryHidden(memory, namesake);
      assertListed(memory.getId(), namesake, false);
      assertMcpAnswer(memory, namesake, false);
      assertCompanyContextAnswer(memory, namesake, false);
    } finally {
      delete("contextCenter/drive/folders/" + folder.getId() + "?hardDelete=true&recursive=true");
    }
  }

  @Test
  void aTeamNamesakeCannotReadPrivateMemory(TestNamespace ns) throws Exception {
    EntityReference team = createPrincipal(ns, Entity.TEAM);
    User namesake = createUser(ns, new CreateUser().withName(team.getName()));
    MemoryShareConfig privateShare =
        new MemoryShareConfig().withVisibility(MemoryVisibility.PRIVATE);
    ContextFile file = createFile(ns, null);
    ContextMemory memory = createMemory(ns, privateShare, team, file);
    assertMemoryHidden(memory, namesake);
    assertMcpAnswer(memory, namesake, false);
  }

  private static EntityReference createPrincipal(TestNamespace ns, String type) {
    String name = ns.shortPrefix(type);
    if (Entity.TEAM.equals(type)) {
      return ns.trackRoot(
              Entity.TEAM,
              SdkClients.adminClient()
                  .teams()
                  .create(new CreateTeam().withName(name).withTeamType(CreateTeam.TeamType.GROUP)))
          .getEntityReference();
    }
    return ns.trackRoot(
            Entity.DOMAIN,
            SdkClients.adminClient()
                .domains()
                .create(
                    new CreateDomain()
                        .withName(name)
                        .withDescription("Shared principal")
                        .withDomainType(CreateDomain.DomainType.AGGREGATE)))
        .getEntityReference();
  }

  private static User createMember(TestNamespace ns, EntityReference principal) {
    CreateUser request = new CreateUser().withName(ns.shortPrefix("member"));
    if (Entity.TEAM.equals(principal.getType())) {
      request.withTeams(List.of(principal.getId()));
    } else {
      request.withDomains(List.of(principal.getFullyQualifiedName()));
    }
    return createUser(ns, request);
  }

  private static User createUser(TestNamespace ns, CreateUser request) {
    return ns.trackRoot(
        Entity.USER,
        SdkClients.adminClient()
            .users()
            .create(request.withEmail(request.getName() + "@test.openmetadata.org")));
  }

  private static ContextFile createFile(TestNamespace ns, Folder folder) throws Exception {
    return ns.trackRoot(
        Entity.CONTEXT_FILE,
        post(
            FILES,
            new CreateContextFile()
                .withName(ns.shortPrefix("file") + "_" + UUID.randomUUID())
                .withFolder(folder == null ? null : folder.getFullyQualifiedName()),
            ContextFile.class));
  }

  private static ContextMemory createMemory(
      TestNamespace ns, MemoryShareConfig sharing, EntityReference owner, ContextFile file)
      throws Exception {
    return ns.trackRoot(
        Entity.CONTEXT_MEMORY,
        new ContextMemoryService(SdkClients.adminClient().getHttpClient())
            .create(
                new CreateContextMemory()
                    .withName(ns.shortPrefix("memory"))
                    .withQuestion("Who can read this budget?")
                    .withAnswer(ANSWER)
                    .withSourceType(ContextMemorySourceType.FILE_EXTRACTION)
                    .withSourceEntity(file.getEntityReference())
                    .withShareConfig(sharing)
                    .withOwners(owner == null ? null : List.of(owner))));
  }

  private static void assertMemoryHidden(ContextMemory memory, User user) {
    ContextMemoryService caller = memoriesAs(user);
    String id = memory.getId().toString();
    assertThrows(ForbiddenException.class, () -> caller.get(id));
    assertThrows(ForbiddenException.class, () -> caller.getByName(memory.getFullyQualifiedName()));
  }

  private static void assertListed(UUID id, User user, boolean visible) {
    ContextMemoryService caller = memoriesAs(user);
    boolean listed = false;
    String after = null;
    do {
      var page = caller.list(new ListParams().withLimit(100).withAfter(after));
      listed |= page.getData().stream().anyMatch(memory -> id.equals(memory.getId()));
      after = page.getPaging().getAfter();
    } while (after != null && !after.isEmpty());
    assertEquals(visible, listed);
  }

  private void assertMcpAnswer(ContextMemory memory, User user, boolean visible) throws Exception {
    JsonNode response =
        executeMcpRequest(
            McpTestUtils.createGetEntityToolCall(
                Entity.CONTEXT_MEMORY, memory.getFullyQualifiedName()),
            bearerFor(user));
    assertEquals(
        !visible, response.path("result").path("isError").asBoolean(false), response.toString());
    assertEquals(visible, response.toString().contains(ANSWER), response.toString());
  }

  private void assertCompanyContextAnswer(ContextMemory memory, User user, boolean visible)
      throws Exception {
    JsonNode response =
        executeMcpRequest(
            McpTestUtils.createToolCallRequest(
                "company_context", Map.of("fqn", memory.getFullyQualifiedName())),
            bearerFor(user));
    assertEquals(visible, response.toString().contains(ANSWER), response.toString());
  }

  private static ContextMemoryService memoriesAs(User user) {
    return new ContextMemoryService(clientFor(user).getHttpClient());
  }

  private static OpenMetadataClient clientFor(User user) {
    return SdkClients.createClient(user.getEmail(), user.getEmail(), new String[] {});
  }

  private static String bearerFor(User user) {
    return "Bearer " + tokenFor(user.getName());
  }
}
