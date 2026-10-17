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
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.it.tests.ChangeRequestITSupport.*;

import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.Response;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.DeliveryStatus;
import org.openmetadata.schema.governance.changeRequest.MutationOp;
import org.openmetadata.schema.governance.changeRequest.MutationOpType;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.approval.ChangeRequestService;
import org.openmetadata.service.governance.approval.MutationPlanner;
import org.openmetadata.service.util.RestUtil;

// Each test deploys its own Enforce workflow, which receives the signals of every event on its
// entity type, so the class runs alone instead of beside the shared-lane tests.
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
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
  void laterEditReviewedByAnotherWorkflowLeavesThePendingRequestAlone(TestNamespace ns) {
    Glossary glossary = gatedGlossary(ns, "original display name");
    String scope = filterScopedTo(glossary.getFullyQualifiedName());
    WorkflowDefinition descriptionReview =
        deployWorkflow(ns, Entity.GLOSSARY, INCLUDE_DESCRIPTION, NO_EXCLUDE, scope);
    deployWorkflow(ns, Entity.GLOSSARY, "\"displayName\"", NO_EXCLUDE, scope);
    patchDescription(glossary.getId(), "proposed description");
    assertEquals(
        descriptionReview.getId(), onlyPendingRequest(glossary.getId()).getWorkflowDefinitionId());

    InvalidRequestException error =
        assertThrows(
            InvalidRequestException.class,
            () ->
                patch(
                    glossary.getId(),
                    "[{\"op\":\"replace\",\"path\":\"/displayName\",\"value\":\"n\"}]"));

    assertTrue(error.getMessage().contains("another approval workflow"), error.getMessage());
    ChangeRequest pending = onlyPendingRequest(glossary.getId());
    assertEquals(descriptionReview.getId(), pending.getWorkflowDefinitionId());
    assertEquals(1, pending.getActiveRevisionNumber());
    assertEquals("original display name", displayNameOf(glossary.getId()));
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

  @Test
  void patchClearingGatedOwnersIsHeld(TestNamespace ns) throws Exception {
    EntityReference owner = SharedEntities.get().USER2.getEntityReference();
    Glossary glossary = gatedGlossaryOwnedBy(ns, ORIGINAL_DN, owner);
    deployHookWorkflow(
        ns, "\"owners\"", NO_EXCLUDE, filterScopedTo(glossary.getFullyQualifiedName()));

    HttpResponse<String> response =
        rawPatch(glossary.getId(), "[{\"op\":\"replace\",\"path\":\"/owners\",\"value\":null}]");

    assertEquals(Response.Status.ACCEPTED.getStatusCode(), response.statusCode(), response.body());
    assertEquals(List.of(owner.getId()), ids(withRelations(glossary.getId()).getOwners()));
    MutationOp op = onlyOpOn(glossary.getId(), "owners");
    assertEquals(MutationOpType.REMOVE, op.getOp());
    assertEquals(owner.getId().toString(), op.getKey());
  }

  @Test
  void patchClearingGatedTagsIsHeld(TestNamespace ns) throws Exception {
    TagLabel tag = SharedEntities.get().PII_SENSITIVE_TAG_LABEL;
    Glossary glossary = glossaryTagged(ns, tag);
    deployHookWorkflow(
        ns, "\"tags\"", NO_EXCLUDE, filterScopedTo(glossary.getFullyQualifiedName()));

    HttpResponse<String> response =
        rawPatch(glossary.getId(), "[{\"op\":\"replace\",\"path\":\"/tags\",\"value\":null}]");

    assertEquals(Response.Status.ACCEPTED.getStatusCode(), response.statusCode(), response.body());
    assertEquals(List.of(tag.getTagFQN()), tagFqns(glossary.getId()));
    assertEquals(MutationOpType.REMOVE, onlyOpOn(glossary.getId(), "tags").getOp());
  }

  @Test
  void approvedPutAddsTheTagItSendsAndKeepsTheStoredOnes(TestNamespace ns) throws Exception {
    TagLabel stored = SharedEntities.get().PERSONAL_DATA_TAG_LABEL;
    TagLabel sent = SharedEntities.get().PII_SENSITIVE_TAG_LABEL;
    Glossary glossary = glossaryTagged(ns, stored);
    deployHookWorkflow(
        ns, "\"tags\"", NO_EXCLUDE, filterScopedTo(glossary.getFullyQualifiedName()));

    HttpResponse<String> response = rawPut(putOf(glossary).withTags(List.of(sent)));

    assertEquals(Response.Status.ACCEPTED.getStatusCode(), response.statusCode(), response.body());
    MutationOp op = onlyOpOn(glossary.getId(), "tags");
    assertEquals(MutationOpType.ADD, op.getOp());
    assertEquals(sent.getTagFQN(), op.getKey());
    resolveAs(
        SdkClients.user1Client(),
        awaitOpenApprovalTask(glossary.getFullyQualifiedName()),
        "approve",
        TaskResolutionType.Approved,
        null);
    Awaitility.await("approved tag published beside the stored one")
        .atMost(Duration.ofSeconds(120))
        .pollInterval(Duration.ofSeconds(2))
        .until(() -> tagFqns(glossary.getId()).contains(sent.getTagFQN()));
    assertEquals(
        Set.of(stored.getTagFQN(), sent.getTagFQN()), Set.copyOf(tagFqns(glossary.getId())));
  }

  @Test
  void putTagExcludingAStoredTagIsRejected(TestNamespace ns) throws Exception {
    List<String> exclusive = createMutuallyExclusiveTags(ns);
    Glossary glossary = glossaryTagged(ns, classificationTag(exclusive.get(0)));
    deployHookWorkflow(
        ns, "\"tags\"", NO_EXCLUDE, filterScopedTo(glossary.getFullyQualifiedName()));

    HttpResponse<String> response =
        rawPut(putOf(glossary).withTags(List.of(classificationTag(exclusive.get(1)))));

    assertEquals(
        Response.Status.BAD_REQUEST.getStatusCode(), response.statusCode(), response.body());
    assertTrue(requestsFor(glossary.getId()).isEmpty());
    assertEquals(List.of(exclusive.get(0)), tagFqns(glossary.getId()));
  }

  @Test
  void putSendingNoOwnersKeepsThemWithoutHolding(TestNamespace ns) throws Exception {
    EntityReference owner = SharedEntities.get().USER2.getEntityReference();
    Glossary glossary = gatedGlossaryOwnedBy(ns, ORIGINAL_DN, owner);
    deployHookWorkflow(
        ns, "\"owners\"", NO_EXCLUDE, filterScopedTo(glossary.getFullyQualifiedName()));

    ObjectNode body = (ObjectNode) JsonUtils.valueToTree(putOf(glossary));
    body.putArray("owners");

    HttpResponse<String> response =
        sendAsAdmin("PUT", "/v1/glossaries", "application/json", body.toString());

    assertEquals(Response.Status.OK.getStatusCode(), response.statusCode(), response.body());
    assertTrue(requestsFor(glossary.getId()).isEmpty());
    assertEquals(List.of(owner.getId()), ids(withRelations(glossary.getId()).getOwners()));
  }

  @Test
  void putOmittingGatedReviewersIsHeld(TestNamespace ns) throws Exception {
    Glossary ungoverned = gatedGlossary(ns, ORIGINAL_DN);
    rawPut(putOf(ungoverned).withReviewers(null));
    assertTrue(
        withRelations(ungoverned.getId()).getReviewers().isEmpty(),
        "a PUT clears omitted reviewers");

    Glossary glossary = gatedGlossary(ns, ORIGINAL_DN);
    deployHookWorkflow(
        ns, "\"reviewers\"", NO_EXCLUDE, filterScopedTo(glossary.getFullyQualifiedName()));

    HttpResponse<String> response = rawPut(putOf(glossary).withReviewers(null));

    assertEquals(Response.Status.ACCEPTED.getStatusCode(), response.statusCode(), response.body());
    assertEquals(
        List.of(SharedEntities.get().USER1.getId()),
        ids(withRelations(glossary.getId()).getReviewers()));
    assertEquals(MutationOpType.REMOVE, onlyOpOn(glossary.getId(), "reviewers").getOp());
  }

  private static Glossary glossaryTagged(TestNamespace ns, TagLabel tag) {
    Glossary glossary = gatedGlossary(ns, ORIGINAL_DN);
    patch(
        glossary.getId(),
        "[{\"op\":\"add\",\"path\":\"/tags\",\"value\":[%s]}]"
            .formatted(tagLabelJson(tag.getTagFQN())));
    return withRelations(glossary.getId());
  }

  private static TagLabel classificationTag(String tagFqn) {
    return JsonUtils.readValue(tagLabelJson(tagFqn), TagLabel.class);
  }

  /** The glossary's create request as a PUT body, carrying its reviewer and published values. */
  private static CreateGlossary putOf(Glossary glossary) {
    return new CreateGlossary()
        .withName(glossary.getName())
        .withDisplayName(glossary.getDisplayName())
        .withDescription(glossary.getDescription())
        .withReviewers(List.of(SharedEntities.get().USER1.getEntityReference()));
  }

  private static HttpResponse<String> rawPut(CreateGlossary create) throws Exception {
    return sendAsAdmin("PUT", "/v1/glossaries", "application/json", JsonUtils.pojoToJson(create));
  }

  private static Glossary withRelations(UUID glossaryId) {
    return SdkClients.adminClient()
        .glossaries()
        .get(glossaryId.toString(), "owners,reviewers,tags");
  }

  private static List<String> tagFqns(UUID glossaryId) {
    return listOrEmpty(withRelations(glossaryId).getTags()).stream()
        .map(TagLabel::getTagFQN)
        .toList();
  }

  private static List<UUID> ids(List<EntityReference> refs) {
    return listOrEmpty(refs).stream().map(EntityReference::getId).toList();
  }

  // A glossary PUT also restates its ontology configuration, so only the field under test is read.
  private static MutationOp onlyOpOn(UUID glossaryId, String field) {
    List<MutationOp> ops =
        onlyPendingRequest(glossaryId).getActiveRevision().getOps().stream()
            .filter(op -> field.equals(op.getField()))
            .toList();
    assertEquals(1, ops.size(), ops.toString());
    return ops.get(0);
  }
}
