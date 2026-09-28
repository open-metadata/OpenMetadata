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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.it.tests.ChangeRequestITSupport.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.governance.WithdrawChangeRequest;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestStatus;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ConflictException;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.network.HttpMethod;

@ExtendWith(TestNamespaceExtension.class)
class ChangeRequestResourceIT {
  private Glossary gated(TestNamespace ns) {
    Glossary glossary =
        gatedGlossaryOwnedBy(ns, "dn", SharedEntities.get().USER2.getEntityReference());
    deployHookWorkflow(ns, "\"description\"", "", filterScopedTo(glossary.getFullyQualifiedName()));
    return glossary;
  }

  private ChangeRequest stageAsUser2(Glossary glossary) {
    patchAs(
        SdkClients.user2Client(),
        glossary.getId(),
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"staged\"}]");
    return onlyPendingRequest(glossary.getId());
  }

  private static int visibleCount(OpenMetadataClient client, UUID entityId) {
    String body =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/v1/changeRequests?entityId=%s".formatted(entityId), null);
    JsonNode data = JsonUtils.readTree(body).path("data");
    return data.size();
  }

  private static ChangeRequest withdraw(OpenMetadataClient client, UUID id, int revision) {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            "/v1/changeRequests/%s/withdraw".formatted(id),
            new WithdrawChangeRequest().withExpectedRevision(revision),
            ChangeRequest.class);
  }

  @Test
  void requesterAndReviewerSeeTheRequestButOthersDoNot(TestNamespace ns) {
    Glossary glossary = gated(ns);
    stageAsUser2(glossary);
    assertEquals(1, visibleCount(SdkClients.user2Client(), glossary.getId()));
    assertEquals(1, visibleCount(SdkClients.user1Client(), glossary.getId()));
    assertEquals(0, visibleCount(SdkClients.user3Client(), glossary.getId()));
  }

  @Test
  void requesterWithdrawsAndTheReviewTaskCloses(TestNamespace ns) {
    Glossary glossary = gated(ns);
    ChangeRequest request = stageAsUser2(glossary);
    Task task = awaitOpenApprovalTask(glossary.getFullyQualifiedName());
    ChangeRequest withdrawn = withdraw(SdkClients.user2Client(), request.getId(), 1);
    assertEquals(ChangeRequestStatus.WITHDRAWN, withdrawn.getStatus());
    assertEquals(PUBLISHED, descriptionOf(glossary.getId()));
    Awaitility.await("withdrawn request's task closed")
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () ->
                SdkClients.adminClient().tasks().get(task.getId().toString()).getStatus()
                    != TaskEntityStatus.Open);
  }

  @Test
  void onlyTheRequesterCanWithdraw(TestNamespace ns) {
    Glossary glossary = gated(ns);
    ChangeRequest request = stageAsUser2(glossary);
    assertThrows(
        ForbiddenException.class, () -> withdraw(SdkClients.user1Client(), request.getId(), 1));
  }

  @Test
  void withdrawingAMovedRevisionConflicts(TestNamespace ns) {
    Glossary glossary = gated(ns);
    ChangeRequest request = stageAsUser2(glossary);
    assertThrows(
        ConflictException.class, () -> withdraw(SdkClients.user2Client(), request.getId(), 2));
  }

  @Test
  void listingNeedsAFilter() {
    assertThrows(
        InvalidRequestException.class,
        () ->
            SdkClients.adminClient()
                .getHttpClient()
                .executeForString(HttpMethod.GET, "/v1/changeRequests", null));
  }
}
