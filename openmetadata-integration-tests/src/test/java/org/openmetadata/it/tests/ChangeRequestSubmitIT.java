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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.ClientErrorException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestStatus;
import org.openmetadata.schema.governance.changeRequest.ChangeRevision;
import org.openmetadata.schema.governance.changeRequest.ChangeRevisionStatus;
import org.openmetadata.schema.governance.changeRequest.DeliveryStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.approval.ChangeRequestService;
import org.openmetadata.service.governance.approval.MutationPlanner;
import org.openmetadata.service.governance.approval.StagedChange;

@ExtendWith(TestNamespaceExtension.class)
class ChangeRequestSubmitIT {
  private Glossary glossary(TestNamespace ns) {
    CreateGlossary create =
        new CreateGlossary().withName(ns.shortPrefix("crg")).withDescription("published");
    return ns.trackRoot(Entity.GLOSSARY, SdkClients.adminClient().glossaries().create(create));
  }

  private StagedChange staged(Glossary glossary, String user, String field, String value) {
    String base = JsonUtils.pojoToJson(glossary);
    var proposed = JsonUtils.readTree(base).deepCopy();
    ((com.fasterxml.jackson.databind.node.ObjectNode) proposed).put(field, value);
    return new StagedChange(
        Entity.GLOSSARY,
        glossary.getId(),
        glossary.getFullyQualifiedName(),
        glossary.getVersion(),
        user,
        null,
        UUID.randomUUID(),
        MutationPlanner.plan(JsonUtils.readTree(base), proposed, Set.of(field), Set.of(field)));
  }

  private List<ChangeRequest> pendingFor(UUID entityId) {
    return Entity.getCollectionDAO()
        .changeRequestDAO()
        .listByEntitiesAndStatuses(
            List.of(entityId.toString()), List.of(ChangeRequestStatus.PENDING.value()));
  }

  @Test
  void submitCreatesPendingRequestAndLeavesEntityUntouched(TestNamespace ns) {
    Glossary glossary = glossary(ns);
    ChangeRequest request =
        ChangeRequestService.submit(staged(glossary, "alice", "description", "new"));
    assertEquals(1, request.getActiveRevisionNumber());
    assertEquals(ChangeRequestStatus.PENDING, request.getStatus());
    Glossary after = SdkClients.adminClient().glossaries().get(glossary.getId().toString(), "");
    assertEquals("published", after.getDescription());
    assertEquals(glossary.getVersion(), after.getVersion());
    // The staged workflow id is synthetic, so the post-commit delivery fails and is rescheduled.
    Awaitility.await("first delivery attempt of " + request.getId())
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofMillis(200))
        .untilAsserted(
            () -> {
              ChangeRequest reread = ChangeRequestService.get(request.getId());
              assertEquals(1, reread.getDeliveryAttempts());
              assertEquals(DeliveryStatus.PENDING, reread.getDeliveryStatus());
            });
  }

  @Test
  void sameUserSecondSubmitSupersedesCumulatively(TestNamespace ns) {
    Glossary glossary = glossary(ns);
    ChangeRequest first = ChangeRequestService.submit(staged(glossary, "bob", "description", "d1"));
    ChangeRequest second =
        ChangeRequestService.submit(staged(glossary, "bob", "displayName", "n1"));
    assertEquals(first.getId(), second.getId());
    assertEquals(2, second.getActiveRevisionNumber());
    ChangeRevision active = ChangeRequestService.activeRevision(second);
    assertEquals(Set.of("description", "displayName"), MutationPlanner.fieldsOf(active.getOps()));
    ChangeRevision prior =
        Entity.getCollectionDAO().changeRevisionDAO().findById(first.getActiveRevisionId());
    assertEquals(ChangeRevisionStatus.SUPERSEDED, prior.getStatus());
    assertNotEquals(prior.getDigest(), active.getDigest());
  }

  @Test
  void differentUsersGetIndependentRequests(TestNamespace ns) {
    Glossary glossary = glossary(ns);
    ChangeRequestService.submit(staged(glossary, "carol", "description", "c"));
    ChangeRequestService.submit(staged(glossary, "dave", "description", "d"));
    assertEquals(2, pendingFor(glossary.getId()).size());
  }

  @Test
  void staleBaseVersionIsRejectedWith409(TestNamespace ns) {
    Glossary glossary = glossary(ns);
    StagedChange fresh = staged(glossary, "erin", "description", "x");
    StagedChange stale =
        new StagedChange(
            fresh.entityType(),
            fresh.entityId(),
            fresh.entityFqn(),
            glossary.getVersion() - 0.1,
            fresh.requestedBy(),
            null,
            fresh.workflowDefinitionId(),
            fresh.ops());
    ClientErrorException error =
        assertThrows(ClientErrorException.class, () -> ChangeRequestService.submit(stale));
    assertEquals(409, error.getResponse().getStatus());
    assertTrue(pendingFor(glossary.getId()).isEmpty());
  }

  @Test
  void concurrentSubmitsBySameUserYieldOneActiveRequest(TestNamespace ns) throws Exception {
    Glossary glossary = glossary(ns);
    CountDownLatch start = new CountDownLatch(1);
    List<CompletableFuture<Integer>> results = new ArrayList<>();
    for (String value : List.of("p", "q")) {
      results.add(
          CompletableFuture.supplyAsync(
              () -> submitAfter(start, staged(glossary, "frank", "description", value))));
    }
    start.countDown();
    int succeeded = 0;
    for (CompletableFuture<Integer> result : results) {
      succeeded += result.get();
    }
    assertTrue(succeeded >= 1);
    List<ChangeRequest> pending = pendingFor(glossary.getId());
    assertEquals(1, pending.size());
    assertEquals(succeeded, pending.get(0).getActiveRevisionNumber());
  }

  // 1 when the submit committed, 0 when it lost the race with a retryable 409.
  private static int submitAfter(CountDownLatch start, StagedChange change) {
    int committed = 0;
    try {
      start.await();
      ChangeRequestService.submit(change);
      committed = 1;
    } catch (ClientErrorException e) {
      assertEquals(409, e.getResponse().getStatus());
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
    return committed;
  }
}
