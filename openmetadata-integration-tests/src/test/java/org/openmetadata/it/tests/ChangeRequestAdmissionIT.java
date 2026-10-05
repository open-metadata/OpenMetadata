/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.ChangeRequestITSupport.*;

import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.Response;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Set;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.DeliveryStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.service.governance.approval.ChangeRequestService;
import org.openmetadata.service.governance.approval.MutationPlanner;
import org.openmetadata.service.util.RestUtil;

@ExtendWith(TestNamespaceExtension.class)
class ChangeRequestAdmissionIT {
  private static final String INCLUDE_DESCRIPTION = "\"description\"";
  private static final String NO_EXCLUDE = "";

  private Glossary gated(TestNamespace ns) {
    Glossary glossary = gatedGlossary(ns, "original display name");
    deployHookWorkflow(
        ns, INCLUDE_DESCRIPTION, NO_EXCLUDE, filterScopedTo(glossary.getFullyQualifiedName()));
    return glossary;
  }

  @Test
  void humanPatchOfGatedFieldIsStagedNotPublished(TestNamespace ns) {
    Glossary glossary = gated(ns);
    patchDescription(glossary.getId(), "proposed");
    assertEquals(PUBLISHED, descriptionOf(glossary.getId()));
    assertEquals(glossary.getVersion(), fetch(glossary.getId()).getVersion());
    ChangeRequest request = onlyPendingRequest(glossary.getId());
    assertEquals("admin", request.getRequestedBy());
    assertEquals(
        Set.of("description"), MutationPlanner.fieldsOf(request.getActiveRevision().getOps()));
    // Delivery is synchronous, but a signal fans out to every hook workflow on the entity type, and
    // a parallel test tearing its workflow down makes that attempt fail and retry after backoff.
    Awaitility.await("change request delivered")
        .atMost(Duration.ofSeconds(120))
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () ->
                ChangeRequestService.get(request.getId()).getDeliveryStatus()
                    == DeliveryStatus.DELIVERED);
  }

  @Test
  void humanPutOfGatedFieldIsStagedNotPublished(TestNamespace ns) {
    Glossary glossary = gated(ns);
    putDescription(glossary.getId(), "proposed via put");
    assertEquals(PUBLISHED, descriptionOf(glossary.getId()));
    onlyPendingRequest(glossary.getId());
  }

  @Test
  void heldPatchAnswersAcceptedWithThePublishedEntity(TestNamespace ns) throws Exception {
    Glossary glossary = gated(ns);
    HttpResponse<String> response =
        rawPatch(
            glossary.getId(),
            "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"proposed\"}]");
    assertHeldResponse(response, glossary);
  }

  @Test
  void heldPutAnswersAcceptedWithThePublishedEntity(TestNamespace ns) throws Exception {
    Glossary glossary = gated(ns);
    HttpResponse<String> response = rawPutDescription(glossary, "proposed via raw put");
    assertHeldResponse(response, glossary);
  }

  @Test
  void publishedPatchAnswersOkWithoutPendingChangeHeader(TestNamespace ns) throws Exception {
    Glossary glossary = gated(ns);
    HttpResponse<String> response =
        rawPatch(
            glossary.getId(), "[{\"op\":\"replace\",\"path\":\"/displayName\",\"value\":\"n\"}]");
    assertEquals(Response.Status.OK.getStatusCode(), response.statusCode(), response.body());
    assertTrue(response.headers().firstValue(RestUtil.PENDING_CHANGE_HEADER).isEmpty());
  }

  // A held edit answers 202 with the unchanged entity, its ETag, and the change request id.
  private static void assertHeldResponse(HttpResponse<String> response, Glossary glossary) {
    assertEquals(Response.Status.ACCEPTED.getStatusCode(), response.statusCode(), response.body());
    assertEquals(
        onlyPendingRequest(glossary.getId()).getId().toString(),
        response.headers().firstValue(RestUtil.PENDING_CHANGE_HEADER).orElseThrow());
    assertTrue(response.headers().firstValue(HttpHeaders.ETAG).isPresent());
    assertEquals(PUBLISHED, JsonUtils.readValue(response.body(), Glossary.class).getDescription());
  }

  @Test
  void mixedRequestIsStagedWhole(TestNamespace ns) {
    Glossary glossary = gated(ns);
    patch(
        glossary.getId(),
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"d\"},"
            + "{\"op\":\"replace\",\"path\":\"/displayName\",\"value\":\"n\"}]");
    assertEquals("original display name", displayNameOf(glossary.getId()));
    ChangeRequest request = onlyPendingRequest(glossary.getId());
    assertEquals(
        Set.of("description", "displayName"),
        MutationPlanner.fieldsOf(request.getActiveRevision().getOps()));
  }

  @Test
  void nonGatedOnlyRequestPublishesImmediately(TestNamespace ns) {
    Glossary glossary = gated(ns);
    patch(glossary.getId(), "[{\"op\":\"replace\",\"path\":\"/displayName\",\"value\":\"n\"}]");
    assertEquals("n", displayNameOf(glossary.getId()));
    assertTrue(requestsFor(glossary.getId()).isEmpty());
  }

  @Test
  void gatedChangeCombinedWithRenameIsStagedWhole(TestNamespace ns) {
    Glossary glossary = gated(ns);
    patch(
        glossary.getId(),
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"d\"},"
            + "{\"op\":\"replace\",\"path\":\"/name\",\"value\":\"renamed\"}]");
    Glossary after = fetch(glossary.getId());
    assertEquals(PUBLISHED, after.getDescription());
    assertEquals(glossary.getName(), after.getName());
    assertEquals(
        Set.of("description", "name"),
        MutationPlanner.fieldsOf(
            onlyPendingRequest(glossary.getId()).getActiveRevision().getOps()));
  }

  @Test
  void botWithoutImpersonationPublishesAsToday(TestNamespace ns) {
    Glossary glossary = gated(ns);
    patchAs(
        SdkClients.botClient(),
        glossary.getId(),
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"from bot\"}]");
    assertEquals("from bot", descriptionOf(glossary.getId()));
    assertTrue(requestsFor(glossary.getId()).isEmpty());
  }

  @Test
  void botImpersonatingHumanIsGatedAsThatHuman(TestNamespace ns) {
    Glossary glossary = gated(ns);
    User botUser = createBotUser(ns, "cr");
    createBot(ns.prefix("cr_bot"), botUser, true);
    User human = SharedEntities.get().USER2;
    OpenMetadataClient asHuman = impersonationClient(generateBotToken(botUser), human.getName());
    patchAs(
        asHuman,
        glossary.getId(),
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"impersonated\"}]");
    assertEquals(PUBLISHED, descriptionOf(glossary.getId()));
    ChangeRequest request = onlyPendingRequest(glossary.getId());
    assertEquals(human.getName(), request.getRequestedBy());
    assertEquals(botUser.getName(), request.getImpersonatedBy());
  }

  @Test
  void entityOutsideTheFilterIsNotGated(TestNamespace ns) {
    Glossary gatedOne = gated(ns);
    Glossary other = gatedGlossary(ns, "other");
    patchDescription(other.getId(), "free edit");
    assertEquals("free edit", descriptionOf(other.getId()));
    assertTrue(requestsFor(other.getId()).isEmpty());
    assertTrue(requestsFor(gatedOne.getId()).isEmpty());
  }

  @Test
  void changeGatedByTwoWorkflowsIsRejected(TestNamespace ns) {
    Glossary glossary = gated(ns);
    deployHookWorkflow(
        ns, "\"displayName\"", NO_EXCLUDE, filterScopedTo(glossary.getFullyQualifiedName()));
    InvalidRequestException error =
        assertThrows(
            InvalidRequestException.class,
            () ->
                patch(
                    glossary.getId(),
                    "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"d\"},"
                        + "{\"op\":\"replace\",\"path\":\"/displayName\",\"value\":\"n\"}]"));
    assertTrue(error.getMessage().contains("different approval workflows"));
    assertTrue(requestsFor(glossary.getId()).isEmpty());
  }

  @Test
  void onlyTheReviewingWorkflowStartsForARequest(TestNamespace ns) {
    Glossary glossary = gated(ns);
    deployHookWorkflow(
        ns, "\"displayName\"", NO_EXCLUDE, filterScopedTo(glossary.getFullyQualifiedName()));
    patchDescription(glossary.getId(), "only description");
    onlyPendingRequest(glossary.getId());
    assertEquals(1, awaitApprovalTaskCount(glossary.getFullyQualifiedName(), 1).size());
    assertNoSecondTaskFor(glossary.getFullyQualifiedName());
  }

  @Test
  void hookWorkflowWithElasticsearchFilterIsRejected(TestNamespace ns) {
    String esFilter =
        JsonUtils.pojoToJson(java.util.Map.of("glossary", "{\"query\":{\"match_all\":{}}}"));
    InvalidRequestException error =
        assertThrows(
            InvalidRequestException.class,
            () -> deployHookWorkflow(ns, INCLUDE_DESCRIPTION, NO_EXCLUDE, esFilter));
    assertTrue(error.getMessage().contains("JSON Logic"));
  }

  @Test
  void reactiveWorkflowDoesNotStartOnStagedChange(TestNamespace ns) {
    Glossary glossary = gated(ns);
    patchDescription(glossary.getId(), "staged only");
    onlyPendingRequest(glossary.getId());
    awaitApprovalTaskCount(glossary.getFullyQualifiedName(), 1);
  }

  @Test
  void newHookWorkflowGatesImmediatelyWithoutWaitingForCacheExpiry(TestNamespace ns) {
    Glossary glossary = gatedGlossary(ns, "dn");
    patchDescription(glossary.getId(), "free before workflow");
    assertEquals("free before workflow", descriptionOf(glossary.getId()));
    deployHookWorkflow(
        ns, INCLUDE_DESCRIPTION, NO_EXCLUDE, filterScopedTo(glossary.getFullyQualifiedName()));
    patchDescription(glossary.getId(), "gated after workflow");
    assertEquals("free before workflow", descriptionOf(glossary.getId()));
    onlyPendingRequest(glossary.getId());
  }
}
