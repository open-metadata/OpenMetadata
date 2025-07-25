/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.resources.glossary;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.FORBIDDEN;
import static jakarta.ws.rs.core.Response.Status.NOT_FOUND;
import static jakarta.ws.rs.core.Response.Status.OK;
import static java.util.Collections.emptyList;
import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.schema.type.ColumnDataType.BIGINT;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.GLOSSARY;
import static org.openmetadata.service.Entity.GLOSSARY_TERM;
import static org.openmetadata.service.exception.CatalogExceptionMessage.entityIsNotEmpty;
import static org.openmetadata.service.exception.CatalogExceptionMessage.glossaryTermMismatch;
import static org.openmetadata.service.exception.CatalogExceptionMessage.notReviewer;
import static org.openmetadata.service.resources.databases.TableResourceTest.getColumn;
import static org.openmetadata.service.resources.glossary.GlossaryResourceTest.waitForTaskToBeCreated;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.EntityUtil.getFqn;
import static org.openmetadata.service.util.EntityUtil.getId;
import static org.openmetadata.service.util.EntityUtil.toTagLabels;
import static org.openmetadata.service.util.TestUtils.*;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.socket.client.IO;
import io.socket.client.Socket;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.function.Predicate;
import java.util.stream.IntStream;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.api.ValidateGlossaryTagsRequest;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.TermReference;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.EntityHierarchy;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.GlossaryTerm.Status;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.CustomPropertyConfig;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskDetails;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.feeds.FeedResource.ThreadList;
import org.openmetadata.service.resources.feeds.FeedResourceTest;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.resources.metadata.TypeResourceTest;
import org.openmetadata.service.resources.tags.ClassificationResourceTest;
import org.openmetadata.service.resources.tags.TagResourceTest;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.MoveGlossaryTermMessage;
import org.openmetadata.service.util.MoveGlossaryTermResponse;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;
import org.testcontainers.shaded.com.google.common.collect.Lists;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Slf4j
public class GlossaryTermResourceTest extends EntityResourceTest<GlossaryTerm, CreateGlossaryTerm> {
  private final GlossaryResourceTest glossaryTest = new GlossaryResourceTest();
  private final FeedResourceTest taskTest = new FeedResourceTest();

  public GlossaryTermResourceTest() {
    super(
        Entity.GLOSSARY_TERM,
        GlossaryTerm.class,
        GlossaryTermResource.GlossaryTermList.class,
        "glossaryTerms",
        GlossaryTermResource.FIELDS);
  }

  @Order(0)
  @Test
  void get_listGlossaryTermsWithDifferentFilters() throws IOException {
    // Create the following glossary
    // glossary1
    // - term1
    //   - term11
    //   - term12
    Glossary glossary1 = createGlossary("glossãry1", null, emptyList());

    GlossaryTerm term1 = createTerm(glossary1, null, "term1");
    GlossaryTerm term11 = createTerm(glossary1, term1, "term11");
    GlossaryTerm term12 = createTerm(glossary1, term1, "term12");
    term1.setChildren(List.of(term11.getEntityReference(), term12.getEntityReference()));

    // Create the following glossary
    // glossary2
    // - term2
    //   - term21
    //   - term22
    Glossary glossary2 = createGlossary("词汇表二", null, null);

    GlossaryTerm term2 = createTerm(glossary2, null, "term2");
    GlossaryTerm term21 = createTerm(glossary2, term2, "term21");
    GlossaryTerm term22 = createTerm(glossary2, term2, "term22");
    term2.setChildren(List.of(term21.getEntityReference(), term22.getEntityReference()));

    // List terms without any filters
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("fields", "children,relatedTerms,reviewers,tags");
    ResultList<GlossaryTerm> list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    List<GlossaryTerm> expectedTerms =
        Arrays.asList(
            GLOSSARY1_TERM1, GLOSSARY2_TERM1, term1, term11, term12, term2, term21, term22);
    assertContains(expectedTerms, list.getData());

    // List terms under glossary1
    queryParams = new HashMap<>();
    queryParams.put("fields", "children,relatedTerms,reviewers,tags");
    queryParams.put("glossary", glossary1.getId().toString());
    list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertContains(Arrays.asList(term1, term11, term12), list.getData());

    // List terms under glossary1 parent term1
    queryParams = new HashMap<>();
    queryParams.put("fields", "children,relatedTerms,reviewers,tags");
    queryParams.put("glossary", glossary1.getId().toString());
    queryParams.put("parent", term1.getId().toString());
    list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertContains(Arrays.asList(term11, term12), list.getData());

    // List terms under glossary2
    queryParams = new HashMap<>();
    queryParams.put("fields", "children,relatedTerms,reviewers,tags");
    queryParams.put("glossary", glossary2.getId().toString());
    list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertContains(Arrays.asList(term2, term21, term22), list.getData());

    // List terms under glossary 2 but give glossary term1 in glossary 1 as parent
    queryParams.put("fields", "children,relatedTerms,reviewers,tags");
    queryParams.put("parent", term1.getId().toString());
    Map<String, String> map = Collections.unmodifiableMap(queryParams);
    assertResponse(
        () -> listEntities(map, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        glossaryTermMismatch(term1.getId().toString(), glossary2.getId().toString()));
  }

  @Test
  void test_inheritGlossaryReviewerAndOwner(TestInfo test) throws IOException {
    //
    // When reviewers are not set for a glossary term, carry it forward from the glossary
    //
    Glossary glossary = createGlossary(test, listOf(USER1_REF), List.of(USER2_REF));

    // Create term t1 in the glossary without reviewers and owner
    CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withName("t1")
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("desc");
    GlossaryTerm t1 = assertOwnerInheritance(create, USER2_REF);
    t1 = getEntity(t1.getId(), "reviewers,owners", ADMIN_AUTH_HEADERS);
    assertEntityReferences(glossary.getReviewers(), t1.getReviewers()); // Reviewers are inherited

    // Create term t12 under t1 without reviewers and owner
    create =
        create
            .withName("t12")
            .withGlossary(glossary.getFullyQualifiedName())
            .withParent(t1.getFullyQualifiedName());
    GlossaryTerm t12 = assertOwnerInheritance(create, USER2_REF);
    t12 = getEntity(t12.getId(), "reviewers,owners", ADMIN_AUTH_HEADERS);
    assertEntityReferences(glossary.getReviewers(), t12.getReviewers()); // Reviewers are inherited
  }

  @Test
  void test_inheritDomain(TestInfo test) throws IOException {
    // When domain is not set for a glossary term, carry it forward from the glossary
    CreateGlossary createGlossary =
        glossaryTest.createRequest(test).withDomains(List.of(DOMAIN.getFullyQualifiedName()));
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    // Create term t1 in the glossary without domain
    CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withName("t1")
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("desc");

    GlossaryTerm t1 = assertSingleDomainInheritance(create, DOMAIN.getEntityReference());

    // Create terms t12 under t1 without reviewers and owner
    create =
        create
            .withName("t12")
            .withGlossary(glossary.getFullyQualifiedName())
            .withParent(t1.getFullyQualifiedName());
    assertSingleDomainInheritance(create, DOMAIN.getEntityReference());
  }

  @Test
  void test_commonPrefixTagLabelCount(TestInfo test) throws IOException {
    //
    // Create glossary terms that start with common prefix and make sure usage count is correct
    //
    Glossary glossary = createGlossary(test, null, null);

    // Create nested terms a -> aa -> aaa;
    GlossaryTerm a = createTerm(glossary, null, "a", null);
    GlossaryTerm aa = createTerm(glossary, null, "aa", null);
    GlossaryTerm aaa = createTerm(glossary, null, "aaa", null);

    // Apply each of the tag to a table
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable createTable =
        tableResourceTest
            .createRequest(tableResourceTest.getEntityName(test))
            .withTags(toTagLabels(a, aa, aaa));
    tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Ensure prefix based tagLabel doesn't double count due too common prefix
    for (GlossaryTerm term : List.of(a, aa, aaa)) {
      term = getEntity(term.getId(), "usageCount", ADMIN_AUTH_HEADERS);
      assertEquals(1, term.getUsageCount());
    }
  }

  @Test
  @Execution(ExecutionMode.SAME_THREAD)
  void patch_addDeleteReviewers(TestInfo test) throws IOException {
    // Note: We are disabling the GlossaryTermApprovalWorkflow to avoid the Workflow Kicking it and
    // adding extra ChangeDescriptions.
    WorkflowHandler.getInstance().suspendWorkflow("GlossaryTermApprovalWorkflow");
    CreateGlossaryTerm create =
        createRequest(getEntityName(test), "desc", "", null).withReviewers(null).withSynonyms(null);
    GlossaryTerm term = createEntity(create, ADMIN_AUTH_HEADERS);

    // Add reviewer USER1, synonym1, reference1 in PATCH request
    String origJson = JsonUtils.pojoToJson(term);
    TermReference reference1 =
        new TermReference().withName("reference1").withEndpoint(URI.create("http://reference1"));

    // NOTE: We are patching outside the `patchEntityAndCheck` method in order to be able to wait
    // for the Task to be Created.
    // The Task is created asynchronously from the Glossary Approval Workflow.
    // This allows us to be sure the Status will be updated to IN_REVIEW.
    term.withReviewers(List.of(USER1_REF))
        .withSynonyms(List.of("synonym1"))
        .withReferences(List.of(reference1));

    ChangeDescription change = getChangeDescription(term, MINOR_UPDATE);
    fieldAdded(change, "reviewers", List.of(USER1_REF));
    fieldAdded(change, "synonyms", List.of("synonym1"));
    fieldAdded(change, "references", List.of(reference1));
    term = patchEntityAndCheck(term, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Add reviewer USER2, synonym2, reference2 in PATCH request
    // Changes from this PATCH is consolidated with the previous changes
    origJson = JsonUtils.pojoToJson(term);
    TermReference reference2 =
        new TermReference().withName("reference2").withEndpoint(URI.create("http://reference2"));
    term.withReviewers(List.of(USER1_REF, USER2_REF))
        .withSynonyms(List.of("synonym1", "synonym2"))
        .withReferences(List.of(reference1, reference2));
    change = getChangeDescription(term, MINOR_UPDATE);
    fieldAdded(change, "reviewers", List.of(USER2_REF));
    fieldAdded(change, "synonyms", List.of("synonym2"));
    fieldAdded(change, "references", List.of(reference2));
    term = patchEntityAndCheck(term, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Remove a reviewer USER1, synonym1, reference1 in PATCH request
    // Changes from this PATCH is consolidated with the previous changes resulting in no change
    origJson = JsonUtils.pojoToJson(term);
    term.withReviewers(List.of(USER2_REF))
        .withSynonyms(List.of("synonym2"))
        .withReferences(List.of(reference2));
    change = getChangeDescription(term, MINOR_UPDATE);
    fieldDeleted(change, "reviewers", List.of(USER1_REF));
    fieldDeleted(change, "synonyms", List.of("synonym1"));
    fieldDeleted(change, "references", List.of(reference1));
    patchEntityAndCheck(term, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Note: We are re-enabling the GlossaryTermApprovalWorkflow.
    WorkflowHandler.getInstance().resumeWorkflow("GlossaryTermApprovalWorkflow");
  }

  @Test
  void patch_addDeleteRelatedTerms(TestInfo test) throws IOException {
    CreateGlossaryTerm create =
        createRequest(getEntityName(test), "", "", null).withReviewers(null).withSynonyms(null);
    GlossaryTerm term = createEntity(create, ADMIN_AUTH_HEADERS);

    // Add reference1 in PATCH request
    String origJson = JsonUtils.pojoToJson(term);
    TermReference reference1 =
        new TermReference().withName("reference1").withEndpoint(URI.create("http://reference1"));
    term.withReferences(List.of(reference1));
    ChangeDescription change = getChangeDescription(term, MINOR_UPDATE);
    fieldAdded(change, "references", List.of(reference1));
    term = patchEntityAndCheck(term, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Remove reference in PATCH request
    origJson = JsonUtils.pojoToJson(term);
    term.withReferences(null);
    change = getChangeDescription(term, MINOR_UPDATE);
    fieldDeleted(change, "references", List.of(reference1));
    patchEntityAndCheck(term, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void test_GlossaryTermApprovalWorkflow(TestInfo test) throws IOException {
    //
    // glossary1 create without reviewers is created with Approved status
    //
    CreateGlossary createGlossary =
        glossaryTest.createRequest(getEntityName(test, 1)).withReviewers(null);
    Glossary glossary1 = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    // term g1t1 under glossary1 is created in Approved mode without reviewers
    GlossaryTerm g1t1 = createTerm(glossary1, null, "g1t1");
    assertEquals(Status.APPROVED, g1t1.getStatus());

    //
    // glossary2 created with reviewers user1, user2
    // Glossary term g2t1 created under it are in `Draft` status. Automatically a Request Approval
    // task is created.
    // Only a reviewer can change the status to `Approved`. When the status changes to `Approved`,
    // the Request Approval task is automatically resolved.
    //
    createGlossary =
        glossaryTest
            .createRequest(getEntityName(test, 2))
            .withReviewers(listOf(USER1.getEntityReference(), USER2.getEntityReference()));
    Glossary glossary2 = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    // Creating a glossary term g2t1 should be in `Draft` mode (because glossary has reviewers)
    GlossaryTerm g2t1 = createTerm(glossary2, null, "g2t1");
    assertEquals(Status.DRAFT, g2t1.getStatus());
    waitForTaskToBeCreated(g2t1.getFullyQualifiedName());
    assertEquals(
        Status.IN_REVIEW, getEntity(g2t1.getId(), authHeaders(USER1.getName())).getStatus());
    assertApprovalTask(g2t1, TaskStatus.Open); // A Request Approval task is opened

    // Non reviewer - even Admin - can't change the `Draft` to `Approved` status using PATCH
    String json = JsonUtils.pojoToJson(g2t1);
    g2t1.setStatus(Status.APPROVED);
    assertResponse(
        () -> patchEntity(g2t1.getId(), json, g2t1, ADMIN_AUTH_HEADERS),
        FORBIDDEN,
        notReviewer("admin"));

    // A reviewer can change the `Draft` to `Approved` status using PATCH or PUT
    GlossaryTerm g2t1Updated = patchEntity(g2t1.getId(), json, g2t1, authHeaders(USER1.getName()));
    assertEquals(Status.APPROVED, g2t1Updated.getStatus());
    assertApprovalTask(g2t1, TaskStatus.Closed); // The Request Approval task is closed

    //
    // Glossary terms g2t2 created is in `Draft` status. Automatically a Request Approval task is
    // created.
    // Only a reviewer can resolve the task. Resolving the task changes g2t1 status from `Draft` to
    // `Approved`.
    //
    GlossaryTerm g2t2 = createTerm(glossary2, null, "g2t2");
    assertEquals(Status.DRAFT, g2t2.getStatus());
    waitForTaskToBeCreated(g2t2.getFullyQualifiedName());
    assertEquals(
        Status.IN_REVIEW, getEntity(g2t2.getId(), authHeaders(USER1.getName())).getStatus());
    Thread approvalTask =
        assertApprovalTask(g2t2, TaskStatus.Open); // A Request Approval task is opened
    int taskId = approvalTask.getTask().getId();

    // Even admin can't resolve the task
    ResolveTask resolveTask = new ResolveTask().withNewValue(Status.APPROVED.value());
    assertResponse(
        () -> taskTest.resolveTask(taskId, resolveTask, ADMIN_AUTH_HEADERS),
        FORBIDDEN,
        notReviewer("admin"));

    // Reviewer resolves the task. Glossary is approved. And task is resolved.
    taskTest.resolveTask(taskId, resolveTask, authHeaders(USER1.getName()));
    assertApprovalTask(g2t2, TaskStatus.Closed); // A Request Approval task is opened
    g2t2 = getEntity(g2t2.getId(), authHeaders(USER1.getName()));
    assertEquals(Status.APPROVED, g2t2.getStatus());

    //
    // Glossary terms g2t3 created is in `Draft` status. Automatically a Request Approval task is
    // created.
    // Only a reviewer can close the task. Closing the task moves g2t1 from `Draft` to `Rejected`
    // state.
    //
    GlossaryTerm g2t3 = createTerm(glossary2, null, "g2t3");
    assertEquals(Status.DRAFT, g2t3.getStatus());
    waitForTaskToBeCreated(g2t3.getFullyQualifiedName());
    assertEquals(
        Status.IN_REVIEW, getEntity(g2t3.getId(), authHeaders(USER1.getName())).getStatus());
    approvalTask = assertApprovalTask(g2t3, TaskStatus.Open); // A Request Approval task is opened
    int taskId2 = approvalTask.getTask().getId();

    // Even admin can't close the task
    assertResponse(
        () ->
            taskTest.resolveTask(
                taskId2, new ResolveTask().withNewValue("rejected"), ADMIN_AUTH_HEADERS),
        FORBIDDEN,
        notReviewer("admin"));

    // Reviewer closes the task. Glossary term is rejected. And task is resolved.
    taskTest.resolveTask(
        taskId2, new ResolveTask().withNewValue("rejected"), authHeaders(USER1.getName()));
    assertApprovalTask(g2t3, TaskStatus.Closed); // A Request Approval task is opened
    g2t3 = getEntity(g2t3.getId(), authHeaders(USER1.getName()));
    assertEquals(Status.REJECTED, g2t3.getStatus());

    //
    // Glossary terms g2t4 created is in `Draft` status. Automatically a Request Approval task is
    // created.
    // Only a reviewer changes the status to `Rejected`. This automatically closes Request Approval
    // task.
    //
    final GlossaryTerm g2t4 = createTerm(glossary2, null, "g2t4");
    assertEquals(Status.DRAFT, g2t4.getStatus());
    waitForTaskToBeCreated(g2t4.getFullyQualifiedName());
    assertEquals(
        Status.IN_REVIEW, getEntity(g2t4.getId(), authHeaders(USER1.getName())).getStatus());
    assertApprovalTask(g2t4, TaskStatus.Open); // A Request Approval task is opened

    // Non reviewer - even Admin - can't change the `Draft` to `Approved` status using PATCH
    String json2 = JsonUtils.pojoToJson(g2t4);
    g2t4.setStatus(Status.REJECTED);
    assertResponse(
        () -> patchEntity(g2t4.getId(), json2, g2t4, ADMIN_AUTH_HEADERS),
        FORBIDDEN,
        notReviewer("admin"));

    // A reviewer can change the `Draft` to `Rejected` status using PATCH
    GlossaryTerm g2t4Updated = patchEntity(g2t4.getId(), json2, g2t4, authHeaders(USER1.getName()));
    assertEquals(Status.REJECTED, g2t4Updated.getStatus());
    assertApprovalTask(g2t4, TaskStatus.Closed); // The Request Approval task is closed

    // Creating a glossary term g2t5 should be in `Draft` mode (because glossary has reviewers)
    // adding a new reviewer should add the person as assignee to the task

    GlossaryTerm g2t5 = createTerm(glossary2, null, "g2t5");
    assertEquals(Status.DRAFT, g2t5.getStatus());
    waitForTaskToBeCreated(g2t5.getFullyQualifiedName());
    g2t5 = getEntity(g2t5.getId(), authHeaders(USER1.getName()));
    assertEquals(Status.IN_REVIEW, g2t5.getStatus());
    assertApprovalTask(g2t5, TaskStatus.Open); // A Request Approval task is opened

    String origJson = JsonUtils.pojoToJson(g2t5);

    // Add reviewer DATA_CONSUMER  in PATCH request
    List<EntityReference> newReviewers = List.of(DATA_CONSUMER_REF, USER1_REF, USER2_REF);
    g2t5.withReviewers(newReviewers);

    double previousVersion = g2t5.getVersion();
    g2t5 = patchEntityUsingFqn(g2t5.getFullyQualifiedName(), origJson, g2t5, ADMIN_AUTH_HEADERS);

    // Due to the Glossary Workflow changing the Status from 'DRAFT' to 'IN_REVIEW' as a
    // GovernanceBot, two changes are created.
    assertEquals(g2t5.getVersion(), Math.round((previousVersion + 0.1) * 10.0) / 10.0);
    assertTrue(
        g2t5.getReviewers().containsAll(newReviewers)
            && newReviewers.containsAll(g2t5.getReviewers()));
    assertEquals(g2t5.getStatus(), Status.IN_REVIEW);

    Thread approvalTask1 =
        assertApprovalTask(g2t5, TaskStatus.Open); // A Request Approval task is opened

    // adding the reviewer should add the person as assignee to the task
    assertTrue(
        approvalTask1.getTask().getAssignees().stream()
            .anyMatch(assignee -> assignee.getId().equals(DATA_CONSUMER_REF.getId())),
        "The list of assignees does not contain the expected ID: " + DATA_CONSUMER_REF.getId());
  }

  @Test
  void patch_usingFqn_addDeleteReviewers(TestInfo test) throws IOException {
    CreateGlossaryTerm create =
        createRequest(getEntityName(test), "", "", null).withReviewers(null).withSynonyms(null);
    GlossaryTerm term = createEntity(create, ADMIN_AUTH_HEADERS);

    // Add reviewer USER1, synonym1, reference1 in PATCH request
    String origJson = JsonUtils.pojoToJson(term);
    TermReference reference1 =
        new TermReference().withName("reference1").withEndpoint(URI.create("http://reference1"));
    term.withReviewers(List.of(USER1_REF))
        .withSynonyms(List.of("synonym1"))
        .withReferences(List.of(reference1));
    ChangeDescription change = getChangeDescription(term, MINOR_UPDATE);
    fieldAdded(change, "reviewers", List.of(USER1_REF));
    fieldAdded(change, "synonyms", List.of("synonym1"));
    fieldAdded(change, "references", List.of(reference1));
    term = patchEntityUsingFqnAndCheck(term, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Add reviewer USER2, synonym2, reference2 in PATCH request
    // Changes from this PATCH is consolidated with the previous changes
    origJson = JsonUtils.pojoToJson(term);
    TermReference reference2 =
        new TermReference().withName("reference2").withEndpoint(URI.create("http://reference2"));
    term.withReviewers(List.of(USER1_REF, USER2_REF))
        .withSynonyms(List.of("synonym1", "synonym2"))
        .withReferences(List.of(reference1, reference2));
    change = getChangeDescription(term, MINOR_UPDATE);
    fieldAdded(change, "reviewers", List.of(USER2_REF));
    fieldAdded(change, "synonyms", List.of("synonym2"));
    fieldAdded(change, "references", List.of(reference2));
    term = patchEntityUsingFqnAndCheck(term, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Remove a reviewer USER1, synonym1, reference1 in PATCH request
    // Changes from this PATCH is consolidated with the previous changes resulting in no change
    origJson = JsonUtils.pojoToJson(term);
    term.withReviewers(List.of(USER2_REF))
        .withSynonyms(List.of("synonym2"))
        .withReferences(List.of(reference2));
    change = getChangeDescription(term, MINOR_UPDATE);
    fieldDeleted(change, "reviewers", List.of(USER1_REF));
    fieldDeleted(change, "synonyms", List.of("synonym1"));
    fieldDeleted(change, "references", List.of(reference1));
    patchEntityUsingFqnAndCheck(term, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void patch_usingFqn_addDeleteRelatedTerms(TestInfo test) throws IOException {
    CreateGlossaryTerm create =
        createRequest(getEntityName(test), "", "", null).withReviewers(null).withSynonyms(null);
    GlossaryTerm term = createEntity(create, ADMIN_AUTH_HEADERS);

    // Add reference1 in PATCH request
    String origJson = JsonUtils.pojoToJson(term);
    TermReference reference1 =
        new TermReference().withName("reference1").withEndpoint(URI.create("http://reference1"));
    term.withReferences(List.of(reference1));
    ChangeDescription change = getChangeDescription(term, MINOR_UPDATE);
    fieldAdded(change, "references", List.of(reference1));
    term = patchEntityUsingFqnAndCheck(term, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Remove reference in PATCH request
    origJson = JsonUtils.pojoToJson(term);
    term.withReferences(null);
    change = getChangeDescription(term, MINOR_UPDATE);
    fieldDeleted(change, "references", List.of(reference1));
    patchEntityUsingFqnAndCheck(term, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void patch_usingFqn_addDeleteTags(TestInfo test) throws IOException {
    Glossary glossary = createGlossary(getEntityName(test), null, null);

    // Create glossary term1 in glossary
    CreateGlossaryTerm create =
        createRequest(getEntityName(test), "", "", null)
            .withGlossary(glossary.getFullyQualifiedName())
            .withReviewers(null)
            .withSynonyms(null);
    GlossaryTerm term1 = createEntity(create, ADMIN_AUTH_HEADERS);

    // Create glossary term11 under term1 in glossary
    create =
        createRequest("t1", "", "", null)
            .withGlossary(glossary.getFullyQualifiedName())
            .withReviewers(null)
            .withSynonyms(null)
            .withParent(term1.getFullyQualifiedName());
    GlossaryTerm term11 = createEntity(create, ADMIN_AUTH_HEADERS);

    // Apply tags to term11
    String json = JsonUtils.pojoToJson(term11);
    ChangeDescription change = new ChangeDescription();
    fieldAdded(change, FIELD_TAGS, List.of(PERSONAL_DATA_TAG_LABEL));
    term11.setTags(List.of(PERSONAL_DATA_TAG_LABEL));
    patchEntityUsingFqnAndCheck(term11, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertEquals(term11.getTags().get(0).getTagFQN(), PERSONAL_DATA_TAG_LABEL.getTagFQN());

    // Apply tags to term1
    json = JsonUtils.pojoToJson(term1);
    term1.setTags(List.of(PERSONAL_DATA_TAG_LABEL));
    patchEntityUsingFqnAndCheck(term1, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // After adding tags to parent, make sure the parent and child still has tags
    term11 = getEntity(term11.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(term11.getTags().get(0).getTagFQN(), PERSONAL_DATA_TAG_LABEL.getTagFQN());

    term1 = getEntity(term1.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(term1.getTags().get(0).getTagFQN(), PERSONAL_DATA_TAG_LABEL.getTagFQN());
  }

  @Test
  void testInheritedPermissionFromParent(TestInfo test) throws IOException {
    // Glossary g has owner dataConsumer
    Glossary g =
        createGlossary(getEntityName(test), null, List.of(DATA_CONSUMER.getEntityReference()));
    // dataConsumer as owner of g can create glossary term t1 under it
    GlossaryTerm t1 =
        createTerm(
            g,
            null,
            "t1",
            null,
            List.of(DATA_STEWARD.getEntityReference()),
            authHeaders(DATA_CONSUMER.getName()));
    // dataSteward who is owner of term t1 can create term t11 under it
    createTerm(
        g,
        t1,
        "t11",
        null,
        List.of(DATA_STEWARD.getEntityReference()),
        authHeaders(DATA_STEWARD.getName()));
  }

  protected Thread assertApprovalTask(GlossaryTerm term, TaskStatus expectedTaskStatus)
      throws HttpResponseException {
    String entityLink =
        new EntityLink(Entity.GLOSSARY_TERM, term.getFullyQualifiedName()).getLinkString();
    ThreadList threads =
        taskTest.listTasks(entityLink, null, null, expectedTaskStatus, 100, ADMIN_AUTH_HEADERS);
    assertEquals(1, threads.getData().size());
    Thread taskThread = threads.getData().get(0);
    TaskDetails taskDetails = taskThread.getTask();
    assertNotNull(taskDetails);
    assertEquals(expectedTaskStatus, taskDetails.getStatus());
    return taskThread;
  }

  @Test
  void patch_addDeleteTags(TestInfo test) throws IOException {
    // Create glossary term1 in glossary g1
    CreateGlossaryTerm create =
        createRequest(getEntityName(test), "", "", null).withReviewers(null).withSynonyms(null);
    GlossaryTerm term1 = createEntity(create, ADMIN_AUTH_HEADERS);

    // Create glossary term11 under term1 in glossary g1
    create =
        createRequest("t1", "", "", null)
            .withReviewers(null)
            .withSynonyms(null)
            .withParent(term1.getFullyQualifiedName());
    GlossaryTerm term11 = createEntity(create, ADMIN_AUTH_HEADERS);

    // Apply tags to term11
    String json = JsonUtils.pojoToJson(term11);
    ChangeDescription change = new ChangeDescription();
    fieldAdded(change, FIELD_TAGS, List.of(PERSONAL_DATA_TAG_LABEL));
    term11.setTags(List.of(PERSONAL_DATA_TAG_LABEL));
    patchEntityAndCheck(term11, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertEquals(term11.getTags().get(0).getTagFQN(), PERSONAL_DATA_TAG_LABEL.getTagFQN());

    // Apply tags to term1
    json = JsonUtils.pojoToJson(term1);
    term1.setTags(List.of(PERSONAL_DATA_TAG_LABEL));
    patchEntityAndCheck(term1, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // After adding tags to parent, make sure the parent and child still has tags
    term11 = getEntity(term11.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(term11.getTags().get(0).getTagFQN(), PERSONAL_DATA_TAG_LABEL.getTagFQN());

    term1 = getEntity(term1.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(term1.getTags().get(0).getTagFQN(), PERSONAL_DATA_TAG_LABEL.getTagFQN());
  }

  @Test
  void createGlossaryTerm_LanguageTest() throws IOException {
    // Create glossary term1 in glossary g1
    for (String name : getAllHelloWorldTranslations()) {
      CreateGlossaryTerm create = createRequest(name);
      GlossaryTerm createdEntity = createEntity(create, ADMIN_AUTH_HEADERS);
      GlossaryTerm glossaryGet =
          getEntityByName(createdEntity.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);
      assertEquals(name, glossaryGet.getName());
    }
  }

  @Test
  void patch_addDeleteStyle(TestInfo test) throws IOException {
    Glossary glossary = createGlossary(getEntityName(test), null, null);

    // Create glossary term1 in glossary
    CreateGlossaryTerm create =
        createRequest(getEntityName(test), "", "", null)
            .withGlossary(glossary.getFullyQualifiedName())
            .withReviewers(null)
            .withSynonyms(null)
            .withStyle(null);
    GlossaryTerm term1 = createEntity(create, ADMIN_AUTH_HEADERS);

    // Create glossary term11 under term1 in glossary
    create =
        createRequest("t1", "", "", null)
            .withGlossary(glossary.getFullyQualifiedName())
            .withSynonyms(null)
            .withReviewers(null)
            .withSynonyms(null)
            .withParent(term1.getFullyQualifiedName());
    GlossaryTerm term11 = createEntity(create, ADMIN_AUTH_HEADERS);

    // Apply style to term11
    String json = JsonUtils.pojoToJson(term11);
    ChangeDescription change = getChangeDescription(term11, MINOR_UPDATE);
    Style style = new Style().withIconURL("http://termIcon").withColor("#9FE2BF");
    fieldAdded(change, "style", style);
    term11.setStyle(style);
    term11 = patchEntityAndCheck(term11, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertStyle(style, term11.getStyle());

    // Apply style to term1
    json = JsonUtils.pojoToJson(term1);
    change = getChangeDescription(term1, MINOR_UPDATE);
    style = new Style().withIconURL("http://termIcon1").withColor("#9FE2DF");
    fieldAdded(change, "style", style);
    term1.setStyle(style);
    term1 = patchEntityAndCheck(term1, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertStyle(style, term1.getStyle());

    // remove style to term1
    // Changes from this PATCH is consolidated with the previous changes resulting in no change
    json = JsonUtils.pojoToJson(term1);
    term1.setStyle(null);
    change = getChangeDescription(term1, MINOR_UPDATE);
    fieldDeleted(change, "style", style);
    patchEntityAndCheck(term1, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    term1 = getEntity(term1.getId(), ADMIN_AUTH_HEADERS);
    assertNull(term1.getStyle());
  }

  @Test
  @Order(Integer.MAX_VALUE)
  void delete_recursive(TestInfo test) throws IOException {
    Glossary g1 = createGlossary(test, null, emptyList());

    // Create glossary term t1 in glossary g1
    GlossaryTerm t1 = createTerm(g1, null, "t1");
    TagLabel t1Label = EntityUtil.toTagLabel(t1);

    // Create glossary term t11 under t1
    GlossaryTerm t11 = createTerm(g1, t1, "t11");
    TagLabel t11Label = EntityUtil.toTagLabel(t11);

    // Create glossary term t111 under t11
    GlossaryTerm t111 = createTerm(g1, t11, "t111");
    TagLabel t111Label = EntityUtil.toTagLabel(t111);

    // Create glossary term t12, t121, t1211 under t1
    GlossaryTerm t12 = createTerm(g1, t1, "t12");
    GlossaryTerm t121 = createTerm(g1, t12, "t121");
    createTerm(g1, t121, "t121");

    // Assign glossary terms to a table
    // t1 assigned to table. t11 assigned column1 and t111 assigned to column2
    TableResourceTest tableResourceTest = new TableResourceTest();
    List<Column> columns =
        Arrays.asList(getColumn(C1, BIGINT, t11Label), getColumn("c2", BIGINT, t111Label));
    CreateTable createTable =
        tableResourceTest
            .createRequest("glossaryTermDelTest")
            .withTags(List.of(t1Label))
            .withColumns(columns);
    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    //
    // Glossary that has terms and glossary terms that have children CAN'T BE DELETED without
    // recursive flag
    //

    // g1 glossary is not empty and can't be deleted
    assertResponse(
        () -> glossaryTest.deleteEntity(g1.getId(), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        entityIsNotEmpty(GLOSSARY));

    // t1 is not empty and can't be deleted
    assertResponse(
        () -> deleteEntity(t1.getId(), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        entityIsNotEmpty(GLOSSARY_TERM));

    // t11 is not empty and can't be deleted
    assertResponse(
        () -> deleteEntity(t11.getId(), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        entityIsNotEmpty(GLOSSARY_TERM));

    //
    // Glossary that has terms and glossary terms that have children CAN BE DELETED recursive flag
    //

    // Delete both t11 and the child t11
    deleteAndCheckEntity(t11, true, true, ADMIN_AUTH_HEADERS);
    assertEntityDeleted(t11.getId(), true);
    assertEntityDeleted(t111.getId(), true);

    // Check to see the tags assigned are deleted
    table = tableResourceTest.getEntity(table.getId(), "tags, columns", ADMIN_AUTH_HEADERS);
    assertTrue(table.getColumns().get(0).getTags().isEmpty()); // tag t11 removed
    assertTrue(table.getColumns().get(1).getTags().isEmpty()); // tag t111 removed
    assertFalse(table.getTags().isEmpty()); // tag t1 still exists

    // Delete the entire glossary
    glossaryTest.deleteAndCheckEntity(g1, true, true, ADMIN_AUTH_HEADERS);
    glossaryTest.assertEntityDeleted(g1.getId(), true);
    assertEntityDeleted(t1.getId(), true);

    // Check to see the tags assigned are deleted
    table = tableResourceTest.getEntity(table.getId(), "tags, columns", ADMIN_AUTH_HEADERS);
    assertTrue(table.getColumns().get(0).getTags().isEmpty()); // tag t11 is removed
    assertTrue(table.getColumns().get(1).getTags().isEmpty()); // tag t111 is removed
    assertTrue(table.getTags().isEmpty()); // tag t1 is removed
  }

  @Test
  void patchWrongReviewers(TestInfo test) throws IOException {
    GlossaryTerm entity = createEntity(createRequest(test, 0), ADMIN_AUTH_HEADERS);

    // Add random domain reference
    EntityReference reviewerReference =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER);
    String originalJson = JsonUtils.pojoToJson(entity);
    ChangeDescription change = getChangeDescription(entity, MINOR_UPDATE);
    entity.setReviewers(List.of(reviewerReference));

    assertResponse(
        () -> patchEntityAndCheck(entity, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change),
        NOT_FOUND,
        String.format("user instance for %s not found", reviewerReference.getId()));
  }

  @Test
  public void test_buildGlossaryTermNestedHierarchy(TestInfo test) throws HttpResponseException {
    // Gives Nested Hierarchy for exact match of user input term
    CreateGlossaryTerm create =
        createRequest("parentGlossaryTerm", "", "", null)
            .withReviewers(null)
            .withSynonyms(null)
            .withStyle(null);
    GlossaryTerm parentGlossaryTerm = createEntity(create, ADMIN_AUTH_HEADERS);

    // Create glossary childGlossaryTerm under parentGlossaryTerm in glossary g1
    create =
        createRequest("childGlossaryTerm", "", "", null)
            .withSynonyms(null)
            .withReviewers(null)
            .withSynonyms(null)
            .withParent(parentGlossaryTerm.getFullyQualifiedName());
    GlossaryTerm childGlossaryTerm = createEntity(create, ADMIN_AUTH_HEADERS);
    String response =
        getResponseFormSearchWithHierarchy("glossary_term_search_index", "*childGlossaryTerm*");
    List<EntityHierarchy> glossaries = JsonUtils.readObjects(response, EntityHierarchy.class);
    boolean isChild =
        glossaries.stream()
            .filter(glossary -> "g1".equals(glossary.getName())) // Find glossary with name "g1"
            .findFirst()
            .map(
                g1Glossary ->
                    g1Glossary.getChildren().stream() // Work with this glossary's children
                        .filter(
                            glossary ->
                                "parentGlossaryTerm"
                                    .equals(glossary.getName())) // Find the specific parent term
                        .flatMap(
                            glossary ->
                                glossary
                                    .getChildren()
                                    .stream()) // Flatten the stream of children terms
                        .anyMatch(
                            term ->
                                "childGlossaryTerm"
                                    .equals(
                                        term.getName()))) // Check if the specific child term exists
            .orElse(false); // Return false if no glossary named "g1" was found

    assertTrue(isChild, "childGlossaryTerm should be a child of parentGlossaryTerm");
  }

  @Test
  void get_entityWithDifferentFields_200_OK(TestInfo test) throws IOException {
    CreateGlossaryTerm create =
        createRequest(
            getEntityName(test), "description", "displayName", Lists.newArrayList(USER1_REF));
    create.setReviewers(List.of(USER1_REF));
    create.setTags(List.of(USER_ADDRESS_TAG_LABEL, GLOSSARY2_TERM1_LABEL));

    GlossaryTerm entity = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    waitForTaskToBeCreated(entity.getFullyQualifiedName(), 60000L * 3);

    entity = validateGetWithDifferentFields(entity, false);
    validateEntityReferences(entity.getOwners());
    assertListNotEmpty(entity.getTags());

    entity = validateGetWithDifferentFields(entity, true);
    validateEntityReferences(entity.getOwners());
    assertListNotEmpty(entity.getTags());
  }

  @Test
  void get_glossaryTermsWithPagination_200(TestInfo test) throws IOException {
    // get Pagination results for same name entities
    boolean supportsSoftDelete = true;
    int numEntities = 5;

    List<UUID> createdUUIDs = new ArrayList<>();
    for (int i = 0; i < numEntities; i++) {
      // Create GlossaryTerms with different parent glossaries
      CreateGlossary createGlossary =
          glossaryTest.createRequest("Glossary" + (i + 1), "", "", null);
      Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);
      CreateGlossaryTerm createGlossaryTerm =
          createRequest("commonTerm", "", "", null)
              .withRelatedTerms(null)
              .withGlossary(glossary.getName())
              .withTags(List.of(PII_SENSITIVE_TAG_LABEL, PERSONAL_DATA_TAG_LABEL))
              .withReviewers(glossary.getReviewers());
      GlossaryTerm glossaryTerm = createEntity(createGlossaryTerm, ADMIN_AUTH_HEADERS);
      createdUUIDs.add(glossaryTerm.getId());
    }

    CreateGlossary createGlossary = glossaryTest.createRequest("Glossary0", "", "", null);
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);
    GlossaryTerm entity =
        createEntity(
            createRequest("commonTerm", "", "", null)
                .withRelatedTerms(null)
                .withGlossary(glossary.getName())
                .withTags(List.of(PII_SENSITIVE_TAG_LABEL, PERSONAL_DATA_TAG_LABEL))
                .withReviewers(glossary.getReviewers()),
            ADMIN_AUTH_HEADERS);
    deleteAndCheckEntity(entity, ADMIN_AUTH_HEADERS);

    Predicate<GlossaryTerm> matchDeleted = e -> e.getId().equals(entity.getId());

    // Test listing entities that include deleted, non-deleted, and all the entities
    for (Include include : List.of(Include.NON_DELETED, Include.ALL, Include.DELETED)) {
      if (!supportsSoftDelete && include.equals(Include.DELETED)) {
        continue;
      }
      Map<String, String> queryParams = new HashMap<>();
      queryParams.put("include", include.value());

      // List all entities and use it for checking pagination
      ResultList<GlossaryTerm> allEntities =
          listEntities(queryParams, 1000000, null, null, ADMIN_AUTH_HEADERS);
      Awaitility.await()
          .atMost(Duration.ofSeconds(1))
          .until(() -> !allEntities.getData().isEmpty());

      int totalRecords = allEntities.getData().size();

      // List entity with "limit" set from 1 to numEntities size with fixed steps
      for (int limit = 1; limit < numEntities; limit += 2) { // fixed step for consistency
        String after = null;
        String before;
        int pageCount = 0;
        int indexInAllTables = 0;
        ResultList<GlossaryTerm> forwardPage;
        ResultList<GlossaryTerm> backwardPage;
        boolean foundDeleted = false;
        do { // For each limit (or page size) - forward scroll till the end
          LOG.debug(
              "Limit {} forward pageCount {} indexInAllTables {} totalRecords {} afterCursor {}",
              limit,
              pageCount,
              indexInAllTables,
              totalRecords,
              after);
          forwardPage = listEntities(queryParams, limit, null, after, ADMIN_AUTH_HEADERS);
          foundDeleted = forwardPage.getData().stream().anyMatch(matchDeleted) || foundDeleted;
          after = forwardPage.getPaging().getAfter();
          before = forwardPage.getPaging().getBefore();
          assertEntityPagination(allEntities.getData(), forwardPage, limit, indexInAllTables);

          if (pageCount == 0) { // CASE 0 - First page is being returned. There is no before-cursor
            assertNull(before);
          } else {
            // Make sure scrolling back based on before cursor returns the correct result
            backwardPage = listEntities(queryParams, limit, before, null, ADMIN_AUTH_HEADERS);
            assertEntityPagination(
                allEntities.getData(), backwardPage, limit, (indexInAllTables - limit));
          }

          indexInAllTables += forwardPage.getData().size();
          pageCount++;
        } while (after != null);

        boolean includeAllOrDeleted =
            Include.ALL.equals(include) || Include.DELETED.equals(include);
        if (includeAllOrDeleted) {
          assertTrue(!supportsSoftDelete || foundDeleted);
        } else { // non-delete
          assertFalse(foundDeleted);
        }

        // We have now reached the last page - test backward scroll till the beginning
        pageCount = 0;
        indexInAllTables = totalRecords - limit - forwardPage.getData().size();
        foundDeleted = forwardPage.getData().stream().anyMatch(matchDeleted);
        do {
          LOG.debug(
              "Limit {} backward pageCount {} indexInAllTables {} totalRecords {} afterCursor {}",
              limit,
              pageCount,
              indexInAllTables,
              totalRecords,
              after);
          forwardPage = listEntities(queryParams, limit, before, null, ADMIN_AUTH_HEADERS);
          foundDeleted = forwardPage.getData().stream().anyMatch(matchDeleted) || foundDeleted;
          before = forwardPage.getPaging().getBefore();
          assertEntityPagination(allEntities.getData(), forwardPage, limit, indexInAllTables);
          pageCount++;
          indexInAllTables -= forwardPage.getData().size();
        } while (before != null);

        if (includeAllOrDeleted) {
          assertTrue(!supportsSoftDelete || foundDeleted);
        } else { // non-delete
          assertFalse(foundDeleted);
        }
      }

      // Before running "deleted" delete all created entries otherwise the test doesn't work with
      // just one element.
      if (Include.ALL.equals(include)) {
        for (GlossaryTerm toBeDeleted : allEntities.getData()) {
          if (createdUUIDs.contains(toBeDeleted.getId())
              && Boolean.FALSE.equals(toBeDeleted.getDeleted())) {
            deleteAndCheckEntity(toBeDeleted, ADMIN_AUTH_HEADERS);
          }
        }
      }
    }
  }

  @Test
  void test_performance_listEntities() throws IOException {
    Glossary glossary = createGlossary("词汇表三", null, null);
    List<Map<String, Object>> result =
        createTerms(glossary, IntStream.range(0, 500).mapToObj(i -> "term" + i).toList());

    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("fields", "children,relatedTerms,reviewers,tags");
    queryParams.put("limit", "10000");
    queryParams.put("directChildrenOf", "词汇表三");
    ResultList<GlossaryTerm> list =
        assertTimeout(Duration.ofSeconds(3), () -> listEntities(queryParams, ADMIN_AUTH_HEADERS));
    assertEquals(result.size(), list.getData().size());
  }

  public GlossaryTerm createTerm(Glossary glossary, GlossaryTerm parent, String termName)
      throws IOException {
    return createTerm(glossary, parent, termName, glossary.getReviewers());
  }

  public GlossaryTerm createTerm(
      Glossary glossary, GlossaryTerm parent, String termName, List<EntityReference> reviewers)
      throws IOException {
    return createTerm(glossary, parent, termName, reviewers, emptyList(), ADMIN_AUTH_HEADERS);
  }

  public GlossaryTerm createTerm(
      Glossary glossary,
      GlossaryTerm parent,
      String termName,
      List<EntityReference> reviewers,
      List<EntityReference> owners,
      Map<String, String> createdBy)
      throws IOException {
    CreateGlossaryTerm createGlossaryTerm =
        createRequest(termName, "d", "", null)
            .withGlossary(getFqn(glossary))
            .withStyle(new Style().withColor("#FF5733").withIconURL("https://img"))
            .withParent(getFqn(parent))
            .withOwners(owners)
            .withReviewers(reviewers);
    return createAndCheckEntity(createGlossaryTerm, createdBy);
  }

  private List<Map<String, Object>> createTerms(Glossary glossary, List<String> termNames)
      throws HttpResponseException {
    String pathUrl = "/createMany/";
    String glossaryFqn = getFqn(glossary);
    WebTarget target = getCollection().path(pathUrl);
    List<CreateGlossaryTerm> createGlossaryTerms =
        termNames.stream()
            .map(
                name ->
                    createRequest(name, "d", "", null)
                        .withRelatedTerms(null)
                        .withSynonyms(List.of("performance1", "performance2"))
                        .withStyle(new Style().withColor("#FF5733").withIconURL("https://img"))
                        .withGlossary(glossaryFqn))
            .toList();
    return TestUtils.post(
        target, createGlossaryTerms, List.class, OK.getStatusCode(), ADMIN_AUTH_HEADERS);
  }

  public void assertContains(List<GlossaryTerm> expectedTerms, List<GlossaryTerm> actualTerms)
      throws HttpResponseException {
    assertEquals(expectedTerms.size(), actualTerms.size());
    for (GlossaryTerm expected : expectedTerms) {
      GlossaryTerm actual =
          actualTerms.stream()
              .filter(a -> EntityUtil.glossaryTermMatch.test(a, expected))
              .findAny()
              .orElse(null);
      assertNotNull(
          actual, "Expected glossaryTerm " + expected.getFullyQualifiedName() + " not found");
      assertEquals(expected.getFullyQualifiedName(), actual.getFullyQualifiedName());
      assertEquals(expected.getSynonyms(), actual.getSynonyms());
      assertEquals(expected.getParent(), actual.getParent());
      assertEquals(expected.getStyle(), actual.getStyle());
      TestUtils.assertEntityReferences(expected.getChildren(), actual.getChildren());
      TestUtils.assertEntityReferences(expected.getReviewers(), actual.getReviewers());
      TestUtils.validateTags(expected.getTags(), actual.getTags());
    }
    TestUtils.validateAlphabeticalOrdering(actualTerms, EntityUtil.compareGlossaryTerm);
  }

  @Override
  public CreateGlossaryTerm createRequest(String name) {
    return new CreateGlossaryTerm()
        .withName(name)
        .withDescription("description")
        .withSynonyms(List.of("syn1", "syn2", "syn3"))
        .withGlossary(GLOSSARY1.getName())
        .withRelatedTerms(Arrays.asList(getFqn(GLOSSARY1_TERM1), getFqn(GLOSSARY2_TERM1)));
  }

  @Override
  public void validateCreatedEntity(
      GlossaryTerm entity, CreateGlossaryTerm request, Map<String, String> authHeaders)
      throws HttpResponseException {
    // TODO fix this
    assertReference(request.getParent(), entity.getParent());
    //    assertReference(request.getGlossary(), entity.getGlossary());

    // Validate fully qualified name
    String fqn =
        entity.getParent() == null
            ? FullyQualifiedName.build(entity.getGlossary().getName(), entity.getName())
            : FullyQualifiedName.add(entity.getParent().getFullyQualifiedName(), entity.getName());
    assertEquals(fqn, entity.getFullyQualifiedName());
    assertEquals(entity.getStyle(), request.getStyle());
    // Validate glossary that holds this term is present
    assertReference(request.getGlossary(), entity.getGlossary());

    if (request.getParent() != null) {
      assertReference(request.getParent(), entity.getParent());
    }

    assertEntityReferenceNames(request.getRelatedTerms(), entity.getRelatedTerms());
    assertEntityReferences(request.getReviewers(), entity.getReviewers());

    // Entity specific validation
    TestUtils.validateTags(request.getTags(), entity.getTags());
  }

  @Override
  public void compareEntities(
      GlossaryTerm expected, GlossaryTerm patched, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertReference(expected.getGlossary(), patched.getGlossary());
    assertReference(expected.getParent(), patched.getParent());
    assertEquals(expected.getFullyQualifiedName(), patched.getFullyQualifiedName());

    // Entity specific validation
    TestUtils.validateTags(expected.getTags(), patched.getTags());
  }

  @Override
  public GlossaryTerm validateGetWithDifferentFields(GlossaryTerm term, boolean byName)
      throws HttpResponseException {
    String fields = "";
    term =
        byName
            ? getEntityByName(term.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(term.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNull(
        term.getChildren(), term.getRelatedTerms(), term.getReviewers(), term.getOwners());
    assertTrue(term.getTags().isEmpty());

    fields = "children,relatedTerms,reviewers,owners,tags";
    term =
        byName
            ? getEntityByName(term.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(term.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(
        term.getRelatedTerms(), term.getReviewers(), term.getOwners(), term.getTags());
    assertListNotEmpty(term.getRelatedTerms(), term.getReviewers());
    // Checks for other owner, tags, and followers is done in the base class
    return term;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    switch (fieldName) {
      case "glossary" -> assertEntityReferenceFieldChange(expected, actual);
      case "synonyms" -> {
        @SuppressWarnings("unchecked")
        List<String> expectedStrings =
            expected instanceof List
                ? (List<String>) expected
                : JsonUtils.readObjects(expected.toString(), String.class);
        List<String> actualStrings = JsonUtils.readObjects(actual.toString(), String.class);
        assertStrings(expectedStrings, actualStrings);
      }
      case "references" -> {
        @SuppressWarnings("unchecked")
        List<TermReference> expectedTermRefs =
            expected instanceof List
                ? (List<TermReference>) expected
                : JsonUtils.readObjects(expected.toString(), TermReference.class);
        List<TermReference> actualTermRefs =
            JsonUtils.readObjects(actual.toString(), TermReference.class);
        assertTermReferences(expectedTermRefs, actualTermRefs);
      }
      case "status" -> {
        Status expectedStatus = Status.fromValue(expected.toString());
        Status actualStatus = Status.fromValue(actual.toString());
        assertEquals(expectedStatus, actualStatus);
      }
      default -> assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  @Override
  public GlossaryTerm createAndCheckEntity(
      CreateGlossaryTerm create, Map<String, String> authHeaders) throws IOException {
    int termCount = getGlossary(create.getGlossary()).getTermCount();
    GlossaryTerm term = super.createAndCheckEntity(create, authHeaders);
    assertEquals(termCount + 1, getGlossary(create.getGlossary()).getTermCount());
    return term;
  }

  @Override
  public GlossaryTerm updateAndCheckEntity(
      CreateGlossaryTerm request,
      Response.Status status,
      Map<String, String> authHeaders,
      UpdateType updateType,
      ChangeDescription changeDescription)
      throws IOException {
    int termCount = getGlossary(request.getGlossary()).getTermCount();
    GlossaryTerm term =
        super.updateAndCheckEntity(request, status, authHeaders, updateType, changeDescription);
    if (status == Response.Status.CREATED) {
      assertEquals(termCount + 1, getGlossary(request.getGlossary()).getTermCount());
    }
    return term;
  }

  public void renameGlossaryTermAndCheck(GlossaryTerm term, String newName) throws IOException {
    String oldName = term.getName();
    String json = JsonUtils.pojoToJson(term);
    ChangeDescription change = getChangeDescription(term, MINOR_UPDATE);
    fieldUpdated(change, "name", oldName, newName);
    term.setName(newName);
    term.setFullyQualifiedName(
        FullyQualifiedName.build(term.getGlossary().getFullyQualifiedName(), newName));
    patchEntityAndCheck(term, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // GET the glossary term and check all the children are renamed
    GlossaryTerm getTerm = getEntity(term.getId(), ADMIN_AUTH_HEADERS);
    for (EntityReference ref : getTerm.getChildren()) {
      assertTrue(ref.getFullyQualifiedName().startsWith(getTerm.getFullyQualifiedName()));
    }

    // List children glossary terms with this term as the parent and ensure rename
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("parent", term.getId().toString());
    List<GlossaryTerm> children = listEntities(queryParams, ADMIN_AUTH_HEADERS).getData();
    for (GlossaryTerm child : listOrEmpty(children)) {
      assertTrue(child.getFullyQualifiedName().startsWith(getTerm.getFullyQualifiedName()));
    }
  }

  public GlossaryTerm moveGlossaryTerm(
      EntityReference newGlossary, EntityReference newParent, GlossaryTerm term)
      throws IOException {
    EntityReference oldGlossary = term.getGlossary();
    EntityReference oldParent = term.getParent();
    String json = JsonUtils.pojoToJson(term);

    // Changes description for glossary term parent change
    UpdateType update = null;
    ChangeDescription change = null;
    // Changes description for glossary change for glossary term
    if (!newGlossary.getId().equals(oldGlossary.getId())) {
      update = MINOR_UPDATE;
      change = getChangeDescription(term, update);
      fieldUpdated(change, "glossary", oldGlossary, newGlossary);
    }
    if (newParent == null && oldParent != null) {
      update = MINOR_UPDATE;
      change = change == null ? getChangeDescription(term, update) : change;
      fieldDeleted(change, "parent", oldParent);
    } else if (oldParent == null && newParent != null) {
      update = MINOR_UPDATE;
      change = change == null ? getChangeDescription(term, update) : change;
      fieldAdded(change, "parent", newParent);
    } else if (!Objects.equals(getId(newParent), getId(oldParent))) {
      update = MINOR_UPDATE;
      change = change == null ? getChangeDescription(term, update) : change;
      fieldUpdated(change, "parent", oldParent, newParent);
    } else {
      update = update != null ? update : MINOR_UPDATE;
      change = change == null ? getChangeDescription(term, update) : change;
    }

    String parentFQN =
        newParent == null ? newGlossary.getFullyQualifiedName() : newParent.getFullyQualifiedName();
    term.setFullyQualifiedName(FullyQualifiedName.add(parentFQN, term.getName()));
    term.setParent(newParent);
    term.setGlossary(newGlossary);
    term = patchEntityAndCheck(term, json, ADMIN_AUTH_HEADERS, update, change);
    assertChildrenFqnChanged(term);
    return term;
  }

  public void assertChildrenFqnChanged(GlossaryTerm term) throws HttpResponseException {
    // GET the glossary term and check all the children are renamed
    GlossaryTerm newTerm = getEntity(term.getId(), ADMIN_AUTH_HEADERS);
    for (EntityReference ref : newTerm.getChildren()) {
      assertTrue(ref.getFullyQualifiedName().startsWith(newTerm.getFullyQualifiedName()));
    }

    // List children glossary terms with this term as the parent and ensure rename
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("parent", term.getId().toString());
    List<GlossaryTerm> children = listEntities(queryParams, ADMIN_AUTH_HEADERS).getData();
    for (GlossaryTerm child : listOrEmpty(children)) {
      assertTrue(child.getFullyQualifiedName().startsWith(newTerm.getFullyQualifiedName()));
    }
  }

  @Test
  public void test_getImmediateChildrenGlossaryTermsWithParentFQN() throws IOException {
    Glossary glossary1 = createGlossary("glossary1", null, null);

    GlossaryTerm term1 = createTerm(glossary1, null, "term1");
    GlossaryTerm term11 = createTerm(glossary1, term1, "term11");
    GlossaryTerm term12 = createTerm(glossary1, term1, "term12");
    GlossaryTerm term111 = createTerm(glossary1, term11, "term111");
    term1.setChildren(List.of(term11.getEntityReference(), term12.getEntityReference()));

    // List children glossary terms with  term1 as the parent and getting immediate children only
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("directChildrenOf", term1.getFullyQualifiedName());
    queryParams.put("fields", "childrenCount,children");
    List<GlossaryTerm> children = listEntities(queryParams, ADMIN_AUTH_HEADERS).getData();

    assertEquals(term1.getChildren().size(), children.size());

    for (GlossaryTerm responseChild : children) {
      assertTrue(
          responseChild.getFullyQualifiedName().startsWith(responseChild.getFullyQualifiedName()));
      if (responseChild.getChildren() == null) {
        assertNull(responseChild.getChildrenCount());
      } else {
        assertEquals(responseChild.getChildren().size(), responseChild.getChildrenCount());
      }
    }

    GlossaryTerm response = getEntity(term1.getId(), "childrenCount", ADMIN_AUTH_HEADERS);
    assertEquals(term1.getChildren().size(), response.getChildrenCount());

    queryParams = new HashMap<>();
    queryParams.put("directChildrenOf", glossary1.getFullyQualifiedName());
    queryParams.put("fields", "childrenCount");
    children = listEntities(queryParams, ADMIN_AUTH_HEADERS).getData();
    assertEquals(term1.getChildren().size(), children.get(0).getChildrenCount());
  }

  @Test
  @Override
  protected void post_entityAlreadyExists_409_conflict(TestInfo test) throws HttpResponseException {
    CreateGlossaryTerm create =
        createRequest("post_entityAlreadyExists_409_conflict", "", "", null);
    // Create first time using POST
    createEntity(create, ADMIN_AUTH_HEADERS);
    // Second time creating the same entity using POST should fail
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createEntity(create, ADMIN_AUTH_HEADERS));
    assertTrue(
        exception
            .getMessage()
            .contains(
                String.format(
                    "A term with the name '%s' already exists in '%s' glossary.",
                    create.getName(), create.getGlossary())));
  }

  @Test
  void test_createDuplicateGlossaryTerm() throws IOException {
    Glossary glossary = createGlossary("TestDuplicateGlossary", null, null);

    GlossaryTerm term1 = createTerm(glossary, null, "TestTerm");
    CreateGlossaryTerm createDuplicateTerm =
        new CreateGlossaryTerm()
            .withName("TestTerm")
            .withDescription("check creation of duplicate terms")
            .withGlossary(glossary.getName());

    HttpResponseException exception =
        assertThrows(
            HttpResponseException.class,
            () -> createEntity(createDuplicateTerm, ADMIN_AUTH_HEADERS));
    assertTrue(
        exception
            .getMessage()
            .contains(
                String.format(
                    "A term with the name '%s' already exists in '%s' glossary.",
                    term1.getName(), glossary.getName())));
  }

  @Test
  void test_validateGlossaryTermTagsWithSoftDeletedAssets(TestInfo test) throws IOException {

    // Create a mutually exclusive classification and tag
    ClassificationResourceTest classificationTest = new ClassificationResourceTest();
    CreateClassification createClassification =
        classificationTest.createRequest("mutuallyExclusive").withMutuallyExclusive(true);
    Classification classification =
        classificationTest.createEntity(createClassification, ADMIN_AUTH_HEADERS);

    TagResourceTest tagResourceTest = new TagResourceTest();
    CreateTag createTag =
        tagResourceTest.createRequest("mutual1").withClassification(classification.getName());
    Tag tag1 = tagResourceTest.createEntity(createTag, ADMIN_AUTH_HEADERS);
    createTag =
        tagResourceTest.createRequest("mutual2").withClassification(classification.getName());
    Tag tag2 = tagResourceTest.createEntity(createTag, ADMIN_AUTH_HEADERS);

    CreateGlossary createGlossary =
        glossaryTest
            .createRequest("GlossaryWithSoftDeletedAssets")
            .withTags(List.of(EntityUtil.toTagLabel(tag1)));
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    // Create a glossary term with the mutually exclusive tag
    CreateGlossaryTerm createTerm =
        createRequest("term1")
            .withGlossary(glossary.getFullyQualifiedName())
            .withTags(List.of(EntityUtil.toTagLabel(tag1)));
    GlossaryTerm term = createAndCheckEntity(createTerm, ADMIN_AUTH_HEADERS);

    // Create two tables and add them as assets to the glossary term
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable createTable1 = tableResourceTest.createRequest(test, 1);
    createTable1.setName("table1");
    Table table1 = tableResourceTest.createEntity(createTable1, ADMIN_AUTH_HEADERS);

    CreateTable createTable2 = tableResourceTest.createRequest(test, 1);
    createTable2.setName("table2");
    Table table2 = tableResourceTest.createEntity(createTable2, ADMIN_AUTH_HEADERS);

    // Add the tables to the glossary term
    Map<String, Object> payload =
        Map.of(
            "assets",
            List.of(
                new EntityReference().withId(table1.getId()).withType("table"),
                new EntityReference().withId(table2.getId()).withType("table")),
            "dryRun",
            false);

    WebTarget target = getCollection().path(String.format("/%s/assets/add", term.getId()));
    TestUtils.put(target, payload, BulkOperationResult.class, OK, ADMIN_AUTH_HEADERS);

    // Soft delete one of the tables
    tableResourceTest.deleteEntity(table1.getId(), ADMIN_AUTH_HEADERS);

    // Try to validate adding another tag from the same mutually exclusive classification
    ValidateGlossaryTagsRequest validateRequest =
        new ValidateGlossaryTagsRequest()
            .withGlossaryTags(
                List.of(
                    new TagLabel()
                        .withTagFQN(tag2.getFullyQualifiedName())
                        .withSource(TagLabel.TagSource.CLASSIFICATION)
                        .withLabelType(TagLabel.LabelType.MANUAL)));

    // Validate the request using TestUtils.put to get the response entity
    target = getResource(term.getId()).path("/tags/validate");
    BulkOperationResult result =
        TestUtils.put(target, validateRequest, BulkOperationResult.class, OK, ADMIN_AUTH_HEADERS);
    assertNotNull(result.getFailedRequest());
    assertFalse(result.getFailedRequest().isEmpty());

    // Extract FQNs from failed requests
    Set<String> failedFqns = new HashSet<>();
    for (BulkResponse failedReq : result.getFailedRequest()) {
      Object requestObj = failedReq.getRequest();
      if (requestObj instanceof Map<?, ?> requestMap) {
        String fqn = (String) requestMap.get("fullyQualifiedName");
        System.out.println("Failed FQN: " + fqn);
        failedFqns.add(fqn);
      }
    }
    // Assert both table FQNs are present
    assertTrue(
        failedFqns.contains(table1.getFullyQualifiedName()),
        "Failed requests should contain soft-deleted table FQN");
    assertTrue(
        failedFqns.contains(table2.getFullyQualifiedName()),
        "Failed requests should contain non-deleted table FQN");
  }

  @Test
  void test_bulkAddAssetsToGlossaryTerm() throws IOException {
    TagLabel glossaryTag =
        new TagLabel()
            .withTagFQN("PII.Sensitive")
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.MANUAL);
    CreateGlossary createGlossary =
        glossaryTest.createRequest("GlossaryWithTags").withTags(List.of(glossaryTag));
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    CreateGlossaryTerm createTerm =
        createRequest("TermForBulkAdd").withGlossary(glossary.getFullyQualifiedName());
    GlossaryTerm term = createEntity(createTerm, ADMIN_AUTH_HEADERS);

    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable createTable = tableResourceTest.createRequest("BulkAddTable");
    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    Map<String, Object> payload =
        Map.of(
            "assets",
            List.of(new EntityReference().withId(table.getId()).withType("table")),
            "dryRun",
            false);

    WebTarget target = getCollection().path(String.format("/%s/assets/add", term.getId()));
    TestUtils.put(target, payload, BulkOperationResult.class, OK, ADMIN_AUTH_HEADERS);

    Table updatedTable = tableResourceTest.getEntity(table.getId(), "tags", ADMIN_AUTH_HEADERS);
    assertTrue(
        updatedTable.getTags().stream()
            .anyMatch(t -> t.getTagFQN().equals(glossaryTag.getTagFQN())),
        "Table should have inherited the tag from the parent glossary");

    tableResourceTest.deleteEntity(table.getId(), ADMIN_AUTH_HEADERS);
    deleteEntity(term.getId(), ADMIN_AUTH_HEADERS);
  }

  @Test
  void test_validateCustomPropertyUpdate() throws IOException {
    // This test verifies handling of corrupt custom property values by testing:
    // 1. You can still update other properties even when a property contains corrupt enum Key
    // 2. The system prevents updates to corrupt property (does not block other entity updates) if
    // invalid values are still present.
    // 3. You can successfully update a corrupted property by fixing or removing its invalid value

    Glossary glossary = createGlossary("TestCustomPropsGlossary", null, null);

    // Define custom property definitions
    TypeResourceTest typeResourceTest = new TypeResourceTest();
    Type entityType =
        typeResourceTest.getEntityByName(
            Entity.GLOSSARY_TERM, "customProperties", ADMIN_AUTH_HEADERS);

    CustomProperty enumCp =
        new CustomProperty()
            .withName("certified")
            .withDescription("Certification status")
            .withPropertyType(ENUM_TYPE.getEntityReference())
            .withCustomPropertyConfig(
                new CustomPropertyConfig()
                    .withConfig(
                        Map.of(
                            "values",
                            List.of("draft", "official", "verified"),
                            "multiSelect",
                            true)));

    entityType =
        typeResourceTest.addAndCheckCustomProperty(
            entityType.getId(), enumCp, OK, ADMIN_AUTH_HEADERS);

    CustomProperty sensitivityCp =
        new CustomProperty()
            .withName("sensitivity")
            .withDescription("Data sensitivity")
            .withPropertyType(ENUM_TYPE.getEntityReference())
            .withCustomPropertyConfig(
                new CustomPropertyConfig()
                    .withConfig(
                        Map.of(
                            "values",
                            List.of("confidential", "internal", "public", "restricted"),
                            "multiSelect",
                            false)));

    entityType =
        typeResourceTest.addAndCheckCustomProperty(
            entityType.getId(), sensitivityCp, OK, ADMIN_AUTH_HEADERS);

    // Create a glossary term
    CreateGlossaryTerm createTerm =
        new CreateGlossaryTerm()
            .withName("TestCustomPropsTerm")
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("TestCustomPropsTerm");
    GlossaryTerm term = createAndCheckEntity(createTerm, ADMIN_AUTH_HEADERS);

    // Simulate a term with an invalid value for one property (as if created in version <1.5x)
    // by directly setting the extension with an invalid value inside database
    // Get the repository to directly access the database
    GlossaryTermRepository termRepository =
        (GlossaryTermRepository) Entity.getEntityRepository(GLOSSARY_TERM);

    // Create corrupt data with an invalid enum value and store inside database bypassing validation
    JsonNode corruptExtension =
        JsonUtils.valueToTree(Map.of("certified", List.of("wrongValue", "official")));
    term.setExtension(corruptExtension);
    termRepository.storeExtension(term);
    // Verify the corrupt extension was stored
    GlossaryTerm termWithCorruptData = getEntity(term.getId(), "extension", ADMIN_AUTH_HEADERS);

    JsonNode updatedExtension = JsonUtils.valueToTree(termWithCorruptData.getExtension());
    assertEquals("wrongValue", updatedExtension.get("certified").get(1).asText());

    // SCENARIO 1: Try to update a different property with a valid value via the API
    // The API should allow updating other properties even with corrupt data present
    String json = JsonUtils.pojoToJson(termWithCorruptData);

    // Get the existing extension and add the new field to it
    Map<String, Object> existingExtension =
        (Map<String, Object>) termWithCorruptData.getExtension();
    Map<String, Object> extensionUpdate = new HashMap<>(existingExtension);
    extensionUpdate.put("sensitivity", List.of("internal"));
    termWithCorruptData.setExtension(extensionUpdate);

    // Patch the entity with our updated extension that preserves the corrupt field
    GlossaryTerm updatedTerm =
        patchEntity(term.getId(), json, termWithCorruptData, ADMIN_AUTH_HEADERS);

    // Verify both the corrupt data and new valid property are present after the update
    JsonNode resultExtension = JsonUtils.valueToTree(updatedTerm.getExtension());
    assertEquals("wrongValue", resultExtension.get("certified").get(1).asText());
    assertEquals("internal", resultExtension.get("sensitivity").get(0).asText());

    // SCENARIO 2: Try to modify existing corrupt property by adding new valid value and not
    // removing the wrong one
    // This should fail with a 400 error
    String jsonForWrongUpdate = JsonUtils.pojoToJson(updatedTerm);
    Map<String, Object> invalidExtension = new HashMap<>(existingExtension);
    invalidExtension.put("certified", List.of("wrongValue", "official"));
    invalidExtension.put("sensitivity", List.of("internal"));
    updatedTerm.setExtension(invalidExtension);

    // Expect a 400 error when trying to update the corrupt property with another wrong value
    HttpResponseException exception =
        assertThrows(
            HttpResponseException.class,
            () -> patchEntity(term.getId(), jsonForWrongUpdate, updatedTerm, ADMIN_AUTH_HEADERS));
    assertEquals(400, exception.getStatusCode());
    assertTrue(
        exception.getMessage().contains("Values '[wrongValue"),
        "Error should mention the invalid values");

    // SCENARIO 3: Remove wrong values in corrupt property and add only valid values
    // This should succeed
    String jsonForValidUpdate = JsonUtils.pojoToJson(updatedTerm);
    Map<String, Object> validExtension = new HashMap<>();
    validExtension.put("certified", List.of("draft", "official"));
    validExtension.put("sensitivity", List.of("internal"));
    updatedTerm.setExtension(validExtension);

    ObjectMapper mapper = new ObjectMapper();
    ArrayNode patchArray = mapper.createArrayNode();
    ObjectNode patchOp = mapper.createObjectNode();
    patchOp.put("op", "replace");
    patchOp.put("path", "/extension");
    patchOp.set("value", mapper.valueToTree(validExtension));
    patchArray.add(patchOp);

    // This should succeed since we're replacing the corrupt property with valid values
    GlossaryTerm properlyUpdatedTerm = patchEntity(term.getId(), patchArray, ADMIN_AUTH_HEADERS);

    // Verify the corrupt data is replaced with valid values
    JsonNode finalExtension = JsonUtils.valueToTree(properlyUpdatedTerm.getExtension());
    JsonNode certifiedValues = finalExtension.get("certified");
    assertNotNull(certifiedValues, "Certified values should exist");
    assertTrue(certifiedValues.isArray(), "Certified should be an array");
    assertEquals(2, certifiedValues.size(), "Should contain 2 values");
  }

  public Glossary createGlossary(
      TestInfo test, List<EntityReference> reviewers, List<EntityReference> owners)
      throws IOException {
    return createGlossary(glossaryTest.getEntityName(test), reviewers, owners);
  }

  public Glossary createGlossary(
      String name, List<EntityReference> reviewers, List<EntityReference> owners)
      throws IOException {
    CreateGlossary create =
        glossaryTest.createRequest(name).withReviewers(reviewers).withOwners(owners);
    return glossaryTest.createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  public Glossary getGlossary(String name) throws IOException {
    return glossaryTest.getEntityByName(name, glossaryTest.getAllowedFields(), ADMIN_AUTH_HEADERS);
  }

  public static Set<String> getAllHelloWorldTranslations() {
    Set<String> translations = new HashSet<>();

    // Contains letters, numbers, and no special characters.
    translations.add("HelloWorld123");
    // Contains letters, an underscore, and no special characters.
    translations.add("BC_Test");
    // Contains letters and a hyphen.
    translations.add("OM-Test");
    // Contains letters, a period, and an uppercase letter.
    translations.add("OMData.Test");
    // Contains letters, a space, and an apostrophe.
    translations.add("John's Cafe");
    // Contains letters, a space, an ampersand, and a period.
    translations.add("ACME & Co.");
    // Contains letters, spaces, opening and closing parentheses.
    translations.add("This (is) a test");
    // Contains Spanish characters
    translations.add("Buenos días");
    translations.add("Cómo estás");
    translations.add("Háblame en español");
    translations.add("Gracias");
    translations.add("Hola mundo");
    translations.add("áéíóú ÁÉÍÓÚ");
    // Contains Russian characters
    translations.add("Привет мир");
    // Contains Greek characters
    translations.add("Γειά σου κόσμε");
    // Contains Arabic characters
    translations.add("مرحبا العالم");

    // Contains Hebrew characters
    translations.add("שלום עולם");

    // Contains Chinese characters
    translations.add("你好世界");

    // Contains Korean characters
    translations.add("안녕하세요 세상");

    // Contains Japanese characters
    translations.add("こんにちは世界");

    // Contains Thai characters
    translations.add("สวัสดีชาวโลก");
    translations.add("สวัสดี");
    translations.add("ที่อยู่");
    translations.add("พยัญชนะ");
    translations.add("ลูกค้า");

    // Contains Vietnamese characters
    translations.add("Xin chào thế giới");
    translations.add("Xin chào");

    // Contains Hindi characters
    translations.add("नमस्ते दुनिया");
    translations.add("नमस्ते");

    // Contains Tamil characters
    translations.add("வணக்கம் உலகம்");
    translations.add("வணக்கம்");

    // Contains Marathi characters
    translations.add("नमस्कार जग");

    // Contains Bengali characters
    translations.add("ওহে বিশ্ব");
    translations.add("ওহে");

    // Contains Gujarati characters
    translations.add("નમસ્તે વિશ્વ");
    translations.add("નમસ્તે");

    // Contains Kannada characters
    translations.add("ಹಲೋ ವಿಶ್ವ");
    translations.add("ಹಲೋ");

    // Contains Malayalam characters
    translations.add("ഹലോ ലോകം");
    translations.add("ഹലോ");

    // Contains Punjabi characters
    translations.add("ਹੈਲੋ ਵਰਲਡ");
    translations.add("ਹੈਲੋ");

    // Contains Telugu characters
    translations.add("హలో ప్రపంచం");
    translations.add("హలో");

    // Contains Nepali characters
    translations.add("नमस्कार संसार");

    // Contains Urdu characters
    translations.add("ہیلو دنیا");
    translations.add("ہیلو");

    // Contains Filipino characters
    translations.add("Kamusta mundo");
    translations.add("Kamusta");

    // Contains Indonesian characters
    translations.add("Halo dunia");
    translations.add("Halo");

    // Contains Malay characters
    translations.add("Helo dunia");
    translations.add("Helo");

    // Contains Turkish characters
    translations.add("Merhaba dünya");
    translations.add("Merhaba");

    // Contains Italian characters
    translations.add("Ciao mondo");
    translations.add("Ciao");
    translations.add("àèéìíîòóùú");

    // Contains French characters
    translations.add("Bonjour le monde");
    translations.add("Bonjour");
    translations.add("àâäéèêëîïôöùûüÿçœæ");

    // Contains German characters
    translations.add("Hallo Welt");
    translations.add("Hallo");
    translations.add("äöüÄÖÜß");

    // Contains Portuguese characters
    translations.add("Olá mundo");
    translations.add("Olá");
    return translations;
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void test_asyncMoveGlossaryTerm(TestInfo test) throws Exception {
    // Create 2 glossaries with 2 terms each, add assets to them as well
    Glossary glossary1 = createGlossary("AsyncMoveGlossary1", null, null);
    Glossary glossary2 = createGlossary("AsyncMoveGlossary2", null, null);

    // Create terms in glossary1
    GlossaryTerm term1 = createTerm(glossary1, null, "term1");
    GlossaryTerm term2 = createTerm(glossary1, null, "term2");

    // Create terms in glossary2
    GlossaryTerm term3 = createTerm(glossary2, null, "term3");
    GlossaryTerm term4 = createTerm(glossary2, null, "term4");

    // In Glossary1 and term1 in the glossary, add a child term as well, child term should have an
    // asset
    GlossaryTerm childTerm1 = createTerm(glossary1, term1, "childTerm1");
    GlossaryTerm grandChildTerm1 = createTerm(glossary1, childTerm1, "grandChildTerm1");

    // Create tables and add them as assets to the terms
    TableResourceTest tableResourceTest = new TableResourceTest();

    // Create table for term1
    CreateTable createTable1 = tableResourceTest.createRequest(test, 1);
    createTable1.setName("tableMove1");
    Table table1 = tableResourceTest.createEntity(createTable1, ADMIN_AUTH_HEADERS);

    // Create table for term2
    CreateTable createTable2 = tableResourceTest.createRequest(test, 1);
    createTable2.setName("tableMove2");
    Table table2 = tableResourceTest.createEntity(createTable2, ADMIN_AUTH_HEADERS);

    // Create table for childTerm1
    CreateTable createTable3 = tableResourceTest.createRequest(test, 1);
    createTable3.setName("tableMove3");
    Table table3 = tableResourceTest.createEntity(createTable3, ADMIN_AUTH_HEADERS);

    // Create table for term3
    CreateTable createTable4 = tableResourceTest.createRequest(test, 1);
    createTable4.setName("tableMove4");
    Table table4 = tableResourceTest.createEntity(createTable4, ADMIN_AUTH_HEADERS);

    // Add assets to terms
    addAssetsToGlossaryTerm(term1, List.of(table1));
    addAssetsToGlossaryTerm(term2, List.of(table2));
    addAssetsToGlossaryTerm(childTerm1, List.of(table3));
    addAssetsToGlossaryTerm(term3, List.of(table4));

    // Test Scenario 1: Move childTerm1 from term1 to term2 within the same glossary
    EntityReference parentTerm2Ref =
        new EntityReference().withId(term2.getId()).withType("glossaryTerm");
    MoveGlossaryTermMessage moveMessage1 =
        receiveMoveEntityMessage(childTerm1.getId(), parentTerm2Ref);
    assertEquals("COMPLETED", moveMessage1.getStatus());
    assertEquals(childTerm1.getName(), moveMessage1.getEntityName());
    assertNull(moveMessage1.getError());

    // Verify the move was successful
    GlossaryTerm movedChildTerm1 = getEntity(childTerm1.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(term2.getId(), movedChildTerm1.getParent().getId());
    assertEquals(glossary1.getId(), movedChildTerm1.getGlossary().getId());
    assertTrue(movedChildTerm1.getFullyQualifiedName().startsWith(term2.getFullyQualifiedName()));

    // Verify grandChildTerm1 FQN was updated
    GlossaryTerm updatedGrandChild = getEntity(grandChildTerm1.getId(), ADMIN_AUTH_HEADERS);
    assertTrue(
        updatedGrandChild
            .getFullyQualifiedName()
            .startsWith(movedChildTerm1.getFullyQualifiedName()));

    // Test Scenario 2: Move childTerm1 to root of glossary1 (no parent)
    EntityReference glossary1Ref =
        new EntityReference().withId(glossary1.getId()).withType("glossary");
    MoveGlossaryTermMessage moveMessage2 =
        receiveMoveEntityMessage(childTerm1.getId(), glossary1Ref);
    assertEquals("COMPLETED", moveMessage2.getStatus());
    assertEquals(childTerm1.getName(), moveMessage2.getEntityName());
    assertNull(moveMessage2.getError());

    // Verify the move was successful
    GlossaryTerm movedToRootChildTerm1 = getEntity(childTerm1.getId(), ADMIN_AUTH_HEADERS);
    assertNull(movedToRootChildTerm1.getParent());
    assertEquals(glossary1.getId(), movedToRootChildTerm1.getGlossary().getId());
    assertTrue(
        movedToRootChildTerm1
            .getFullyQualifiedName()
            .startsWith(glossary1.getFullyQualifiedName()));

    // Test Scenario 3: Move childTerm1 to a different glossary (glossary2) under term3
    EntityReference parentTerm3Ref =
        new EntityReference().withId(term3.getId()).withType("glossaryTerm");
    MoveGlossaryTermMessage moveMessage3 =
        receiveMoveEntityMessage(childTerm1.getId(), parentTerm3Ref);
    assertEquals("COMPLETED", moveMessage3.getStatus());
    assertEquals(childTerm1.getName(), moveMessage3.getEntityName());
    assertNull(moveMessage3.getError());

    // Verify the move was successful
    GlossaryTerm movedToGlossary2ChildTerm1 = getEntity(childTerm1.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(term3.getId(), movedToGlossary2ChildTerm1.getParent().getId());
    assertEquals(glossary2.getId(), movedToGlossary2ChildTerm1.getGlossary().getId());
    assertTrue(
        movedToGlossary2ChildTerm1
            .getFullyQualifiedName()
            .startsWith(term3.getFullyQualifiedName()));

    // Test Scenario 4: Move childTerm1 to root of glossary2 (no parent)
    EntityReference glossary2Ref =
        new EntityReference().withId(glossary2.getId()).withType("glossary");
    MoveGlossaryTermMessage moveMessage4 =
        receiveMoveEntityMessage(childTerm1.getId(), glossary2Ref);
    assertEquals("COMPLETED", moveMessage4.getStatus());
    assertEquals(childTerm1.getName(), moveMessage4.getEntityName());
    assertNull(moveMessage4.getError());

    // Verify the move was successful
    GlossaryTerm movedToGlossary2RootChildTerm1 = getEntity(childTerm1.getId(), ADMIN_AUTH_HEADERS);
    assertNull(movedToGlossary2RootChildTerm1.getParent());
    assertEquals(glossary2.getId(), movedToGlossary2RootChildTerm1.getGlossary().getId());
    assertTrue(
        movedToGlossary2RootChildTerm1
            .getFullyQualifiedName()
            .startsWith(glossary2.getFullyQualifiedName()));

    // Test Scenario 5: Move back to glossary1 under term1
    EntityReference parentTerm1Ref =
        new EntityReference().withId(term1.getId()).withType("glossaryTerm");
    MoveGlossaryTermMessage moveMessage5 =
        receiveMoveEntityMessage(childTerm1.getId(), parentTerm1Ref);
    assertEquals("COMPLETED", moveMessage5.getStatus());
    assertEquals(childTerm1.getName(), moveMessage5.getEntityName());
    assertNull(moveMessage5.getError());

    // Verify the move was successful
    GlossaryTerm movedBackChildTerm1 = getEntity(childTerm1.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(term1.getId(), movedBackChildTerm1.getParent().getId());
    assertEquals(glossary1.getId(), movedBackChildTerm1.getGlossary().getId());
    assertTrue(
        movedBackChildTerm1.getFullyQualifiedName().startsWith(term1.getFullyQualifiedName()));

    // Test Scenario 6: Try to move a term to its own child (should fail)
    EntityReference childTerm1Ref =
        new EntityReference().withId(childTerm1.getId()).withType("glossaryTerm");
    MoveGlossaryTermMessage failedMoveMessage =
        receiveMoveEntityMessage(term1.getId(), childTerm1Ref);
    assertEquals("FAILED", failedMoveMessage.getStatus());
    assertEquals(term1.getName(), failedMoveMessage.getEntityName());
    assertNotNull(failedMoveMessage.getError());
    assertTrue(failedMoveMessage.getError().contains("Can't move Glossary term"));

    // Verify the failed move didn't change the term
    GlossaryTerm unchangedTerm1 = getEntity(term1.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(glossary1.getId(), unchangedTerm1.getGlossary().getId());
    assertNull(unchangedTerm1.getParent()); // Should still be at root

    // Clean up
    tableResourceTest.deleteEntity(table1.getId(), ADMIN_AUTH_HEADERS);
    tableResourceTest.deleteEntity(table2.getId(), ADMIN_AUTH_HEADERS);
    tableResourceTest.deleteEntity(table3.getId(), ADMIN_AUTH_HEADERS);
    tableResourceTest.deleteEntity(table4.getId(), ADMIN_AUTH_HEADERS);
  }

  @Test
  void test_GlossaryTermReviewerFilterSkipsWorkflow(TestInfo test) throws Exception {
    // 1. Create glossary with reviewers
    CreateGlossary createGlossary =
        glossaryTest
            .createRequest(getEntityName(test, 1))
            .withReviewers(listOf(USER1.getEntityReference(), USER2.getEntityReference()));
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    // 2. Create a glossary term
    GlossaryTerm term = createTerm(glossary, null, "testTerm");
    assertEquals(Status.DRAFT, term.getStatus());
    // 2a. Approve the term, now we know, a new workflow is created for non reviewers
    waitForTaskToBeCreated(term.getFullyQualifiedName(), 30000L);
    Thread approvalTask = assertApprovalTask(term, TaskStatus.Open);
    int taskId = approvalTask.getTask().getId();
    taskTest.resolveTask(
        taskId, new ResolveTask().withNewValue("approved"), authHeaders(USER1.getName()));

    // 3. Update as reviewer (should NOT trigger workflow)
    String jsonReviewer = JsonUtils.pojoToJson(term);
    term.setDescription("Updated by reviewer USER1 " + System.currentTimeMillis());
    patchEntity(term.getId(), jsonReviewer, term, authHeaders(USER1.getName()));

    // Wait a short period and assert NO approval task is created
    boolean taskCreatedByReviewer = false;
    try {
      waitForTaskToBeCreated(term.getFullyQualifiedName(), 5000L); // 5s timeout
      taskCreatedByReviewer = true;
    } catch (Exception e) {
      // Expected: timeout means no task was created
    }
    assertFalse(
        taskCreatedByReviewer, "No approval task should be created when reviewer updates the term");

    // 4. Update as non-reviewer (admin) (should trigger workflow)
    String jsonAdmin = JsonUtils.pojoToJson(term);
    term.setDescription("Updated by admin (non-reviewer) " + System.currentTimeMillis());
    patchEntity(term.getId(), jsonAdmin, term, ADMIN_AUTH_HEADERS);

    // Wait for approval task to be created (should succeed)
    waitForTaskToBeCreated(term.getFullyQualifiedName(), 30000L); // 30s timeout

    // Assert the approval task is present and open, that means the workflow was triggered
    assertApprovalTask(term, TaskStatus.Open);
  }

  @Test
  void test_GlossaryTermWorkflow_ExistingSchema_UpdateReviewers_NoWorkflow(TestInfo test)
      throws Exception {
    // Test 1: Update reviewers -> No workflow triggered
    CreateGlossary createGlossary =
        glossaryTest
            .createRequest(getEntityName(test))
            .withReviewers(listOf(USER1.getEntityReference()));
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    // Create and approve term first
    GlossaryTerm term = createTerm(glossary, null, "updateReviewersTest");
    waitForTaskToBeCreated(term.getFullyQualifiedName(), 30000L);
    Thread approvalTask = assertApprovalTask(term, TaskStatus.Open);
    taskTest.resolveTask(
        approvalTask.getTask().getId(),
        new ResolveTask().withNewValue("Approved"),
        authHeaders(USER1.getName()));

    // Update only reviewers - should NOT trigger workflow due to exclude field
    String json = JsonUtils.pojoToJson(term);
    term.setReviewers(listOf(USER2.getEntityReference()));
    patchEntity(term.getId(), json, term, ADMIN_AUTH_HEADERS);

    // Verify no workflow task was created
    boolean taskCreated = wasWorkflowTaskCreated(term.getFullyQualifiedName(), 5000L);
    assertFalse(
        taskCreated, "No workflow should be triggered when only reviewers field is updated");
  }

  @Test
  void test_GlossaryTermWorkflow_ExistingSchema_UpdateByReviewer_NoWorkflow(TestInfo test)
      throws Exception {
    // Test 2: Update done by reviewers -> No workflow triggered
    CreateGlossary createGlossary =
        glossaryTest
            .createRequest(getEntityName(test))
            .withReviewers(listOf(USER1.getEntityReference(), USER2.getEntityReference()));
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    // Create and approve term first
    GlossaryTerm term = createTerm(glossary, null, "updateByReviewerTest");
    waitForTaskToBeCreated(term.getFullyQualifiedName(), 30000L);
    Thread approvalTask = assertApprovalTask(term, TaskStatus.Open);
    taskTest.resolveTask(
        approvalTask.getTask().getId(),
        new ResolveTask().withNewValue("Approved"),
        authHeaders(USER1.getName()));

    // Update by reviewer USER1 - should NOT trigger workflow (isReviewer = true)
    String json = JsonUtils.pojoToJson(term);
    term.setDescription("Updated by reviewer USER1");
    patchEntity(term.getId(), json, term, authHeaders(USER1.getName()));

    // Verify no workflow task was created
    boolean taskCreated = wasWorkflowTaskCreated(term.getFullyQualifiedName(), 5000L);
    assertFalse(taskCreated, "No workflow should be triggered when reviewer updates the term");
  }

  @Test
  void test_GlossaryTermWorkflow_ExistingSchema_UpdateReviewersAndDescription_WorkflowTriggered(
      TestInfo test) throws Exception {
    // Test 3: Update "reviewers" and description -> workflow triggered
    CreateGlossary createGlossary =
        glossaryTest
            .createRequest(getEntityName(test))
            .withReviewers(listOf(USER1.getEntityReference()));
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    // Create and approve term first
    GlossaryTerm term = createTerm(glossary, null, "updateBothFieldsTest");
    waitForTaskToBeCreated(term.getFullyQualifiedName(), 30000L);
    Thread approvalTask = assertApprovalTask(term, TaskStatus.Open);
    taskTest.resolveTask(
        approvalTask.getTask().getId(),
        new ResolveTask().withNewValue("Approved"),
        authHeaders(USER1.getName()));

    // Update both reviewers and description - should trigger workflow (not only excluded field)
    String json = JsonUtils.pojoToJson(term);
    term.setReviewers(listOf(USER2.getEntityReference()));
    term.setDescription("Updated both reviewers and description");
    patchEntity(term.getId(), json, term, ADMIN_AUTH_HEADERS);

    // Verify workflow task was created
    boolean taskCreated = wasWorkflowTaskCreated(term.getFullyQualifiedName(), 30000L);
    assertTrue(
        taskCreated,
        "Workflow should be triggered when both reviewers and description are updated");
  }

  @Test
  void test_GlossaryTermWorkflow_ExistingSchema_UpdateByNonReviewer_WorkflowTriggered(TestInfo test)
      throws Exception {
    // Test 4: Update done by non reviewers -> workflow triggered
    CreateGlossary createGlossary =
        glossaryTest
            .createRequest(getEntityName(test))
            .withReviewers(listOf(USER1.getEntityReference()));
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    // Create and approve term first
    GlossaryTerm term = createTerm(glossary, null, "updateByNonReviewerTest");
    waitForTaskToBeCreated(term.getFullyQualifiedName(), 30000L);
    Thread approvalTask = assertApprovalTask(term, TaskStatus.Open);
    taskTest.resolveTask(
        approvalTask.getTask().getId(),
        new ResolveTask().withNewValue("Approved"),
        authHeaders(USER1.getName()));

    // Ensure DATA_CONSUMER has permission to update terms - add as owner
    String json = JsonUtils.pojoToJson(term);
    term.setOwners(listOf(DATA_CONSUMER.getEntityReference()));
    term = patchEntity(term.getId(), json, term, ADMIN_AUTH_HEADERS);

    // Update by non-reviewer (DATA_CONSUMER) - should trigger workflow (isReviewer = false)
    json = JsonUtils.pojoToJson(term);
    term.setDescription("Updated by non-reviewer DATA_CONSUMER");
    patchEntity(term.getId(), json, term, authHeaders(DATA_CONSUMER.getName()));

    // Verify workflow task was created
    boolean taskCreated = wasWorkflowTaskCreated(term.getFullyQualifiedName(), 30000L);
    assertTrue(taskCreated, "Workflow should be triggered when non-reviewer updates the term");
  }

  @Test
  void test_GlossaryTermWorkflow_PatchedSchema_IsOwnerFilter_NoWorkflow(TestInfo test)
      throws Exception {
    // Test 5: Include isOwner custom jsonLogic filter by patch, trigger an update by updating
    // owners - no workflow
    CreateGlossary createGlossary =
        glossaryTest
            .createRequest(getEntityName(test))
            .withReviewers(listOf(USER1.getEntityReference()))
            .withOwners(listOf(USER2.getEntityReference()));
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    // Create and approve term first
    GlossaryTerm term =
        createTerm(
            glossary,
            null,
            "isOwnerFilterTest",
            listOf(USER1.getEntityReference()),
            listOf(USER2.getEntityReference()),
            ADMIN_AUTH_HEADERS);
    waitForTaskToBeCreated(term.getFullyQualifiedName(), 30000L);
    Thread approvalTask = assertApprovalTask(term, TaskStatus.Open);
    taskTest.resolveTask(
        approvalTask.getTask().getId(),
        new ResolveTask().withNewValue("Approved"),
        authHeaders(USER1.getName()));

    // Patch workflow to include isOwner in OR condition
    String patchJson =
        "[{\"op\":\"replace\",\"path\":\"/trigger/config/filter\",\"value\":\"{\\\"or\\\":[{\\\"isReviewer\\\":{\\\"var\\\":\\\"updatedBy\\\"}},{\\\"isOwner\\\":{\\\"var\\\":\\\"updatedBy\\\"}}]}\"}]";
    patchWorkflowDefinition("GlossaryTermApprovalWorkflow", patchJson);

    // Update by owner USER2 - should NOT trigger workflow (isOwner = true in OR condition)
    String json = JsonUtils.pojoToJson(term);
    term.setDescription("Updated by owner USER2");
    patchEntity(term.getId(), json, term, authHeaders(USER2.getName()));

    // Verify no workflow task was created
    boolean taskCreated = wasWorkflowTaskCreated(term.getFullyQualifiedName(), 5000L);
    assertFalse(
        taskCreated,
        "No workflow should be triggered when owner updates the term with isOwner filter");
  }

  @Test
  void test_GlossaryTermWorkflow_PatchedSchema_DescriptionEqualsFilter_NoWorkflow(TestInfo test)
      throws Exception {
    // Test 6: Use basic jsonLogic operation, like description = 'UpdatedTerm'
    CreateGlossary createGlossary =
        glossaryTest
            .createRequest(getEntityName(test))
            .withReviewers(listOf(USER1.getEntityReference()));
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    // Create and approve term first
    GlossaryTerm term = createTerm(glossary, null, "descriptionEqualsTest");
    waitForTaskToBeCreated(term.getFullyQualifiedName(), 30000L);
    Thread approvalTask = assertApprovalTask(term, TaskStatus.Open);
    taskTest.resolveTask(
        approvalTask.getTask().getId(),
        new ResolveTask().withNewValue("Approved"),
        authHeaders(USER1.getName()));

    // Patch workflow to check if description equals 'UpdatedTerm'
    String patchJson =
        "[{\"op\":\"replace\",\"path\":\"/trigger/config/filter\",\"value\":\"{\\\"==\\\":[{\\\"var\\\":\\\"description\\\"},\\\"UpdatedTerm\\\"]}\"}]";
    patchWorkflowDefinition("GlossaryTermApprovalWorkflow", patchJson);

    // Update term description to exactly 'UpdatedTerm' - should NOT trigger workflow (equals
    // condition true, negated = false)
    String json = JsonUtils.pojoToJson(term);
    term.setDescription("UpdatedTerm");
    patchEntity(term.getId(), json, term, ADMIN_AUTH_HEADERS);

    // Verify no workflow task was created
    boolean taskCreated = wasWorkflowTaskCreated(term.getFullyQualifiedName(), 5000L);
    assertFalse(
        taskCreated,
        "No workflow should be triggered when description matches the filter condition");
  }

  @Test
  void test_GlossaryTermWorkflow_PatchedSchema_AndOperator_NoTrigger(TestInfo test)
      throws Exception {
    // Test 7: Instead of using OR, use AND - no trigger
    CreateGlossary createGlossary =
        glossaryTest
            .createRequest(getEntityName(test))
            .withReviewers(listOf(USER1.getEntityReference()));
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    // Create and approve term first
    GlossaryTerm term = createTerm(glossary, null, "andOperatorNoTriggerTest");
    waitForTaskToBeCreated(term.getFullyQualifiedName(), 30000L);
    Thread approvalTask = assertApprovalTask(term, TaskStatus.Open);
    taskTest.resolveTask(
        approvalTask.getTask().getId(),
        new ResolveTask().withNewValue("Approved"),
        authHeaders(USER1.getName()));

    // Patch workflow to use AND: isReviewer AND description exists
    String patchJson =
        "[{\"op\":\"replace\",\"path\":\"/trigger/config/filter\",\"value\":\"{\\\"and\\\":[{\\\"isReviewer\\\":{\\\"var\\\":\\\"updatedBy\\\"}},{\\\"!=\\\":[{\\\"var\\\":\\\"description\\\"},null]}]}\"}]";
    patchWorkflowDefinition("GlossaryTermApprovalWorkflow", patchJson);

    // Update by reviewer USER1 with description - should NOT trigger (isReviewer=true AND
    // description exists=true, result=true, negated=false)
    String json = JsonUtils.pojoToJson(term);
    term.setDescription("Updated by reviewer with description");
    patchEntity(term.getId(), json, term, authHeaders(USER1.getName()));

    // Verify no workflow task was created
    boolean taskCreated = wasWorkflowTaskCreated(term.getFullyQualifiedName(), 5000L);
    assertFalse(taskCreated, "No workflow should be triggered when AND condition is true");
  }

  @Test
  void test_GlossaryTermWorkflow_PatchedSchema_AndOperator_Trigger(TestInfo test) throws Exception {
    // Test 8: Instead of using OR, use AND - trigger
    CreateGlossary createGlossary =
        glossaryTest
            .createRequest(getEntityName(test))
            .withReviewers(listOf(USER1.getEntityReference()));
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    // Create and approve term first
    GlossaryTerm term = createTerm(glossary, null, "andOperatorTriggerTest");
    waitForTaskToBeCreated(term.getFullyQualifiedName(), 30000L);
    Thread approvalTask = assertApprovalTask(term, TaskStatus.Open);
    taskTest.resolveTask(
        approvalTask.getTask().getId(),
        new ResolveTask().withNewValue("Approved"),
        authHeaders(USER1.getName()));

    // Patch workflow to use AND: isReviewer AND description exists
    String patchJson =
        "[{\"op\":\"replace\",\"path\":\"/trigger/config/filter\",\"value\":\"{\\\"and\\\":[{\\\"isReviewer\\\":{\\\"var\\\":\\\"updatedBy\\\"}},{\\\"!=\\\":[{\\\"var\\\":\\\"description\\\"},null]}]}\"}]";
    patchWorkflowDefinition("GlossaryTermApprovalWorkflow", patchJson);

    // Update by non-reviewer (admin) with description - should trigger (isReviewer=false AND
    // description exists=true, result=false, negated=true)
    String json = JsonUtils.pojoToJson(term);
    term.setDescription("Updated by non-reviewer admin");
    patchEntity(term.getId(), json, term, ADMIN_AUTH_HEADERS);

    // Verify workflow task was created
    boolean taskCreated = wasWorkflowTaskCreated(term.getFullyQualifiedName(), 30000L);
    assertTrue(taskCreated, "Workflow should be triggered when AND condition is false");
  }

  /**
   * Helper method to receive move entity message via WebSocket
   */
  protected MoveGlossaryTermMessage receiveMoveEntityMessage(UUID id, EntityReference newParent)
      throws Exception {
    UUID userId = getAdminUserId();
    String uri = String.format("http://localhost:%d", APP.getLocalPort());

    IO.Options options = new IO.Options();
    options.path = "/api/v1/push/feed";
    options.query = "userId=" + userId.toString();
    options.transports = new String[] {"websocket"};
    options.reconnection = false;
    options.timeout = 10000; // 10 seconds

    Socket socket = IO.socket(uri, options);

    CountDownLatch connectLatch = new CountDownLatch(1);
    CountDownLatch messageLatch = new CountDownLatch(1);
    final String[] receivedMessage = new String[1];

    socket
        .on(
            Socket.EVENT_CONNECT,
            args -> {
              LOG.info("Connected to Socket.IO server");
              connectLatch.countDown();
            })
        .on(
            WebSocketManager.MOVE_GLOSSARY_TERM_CHANNEL,
            args -> {
              receivedMessage[0] = (String) args[0];
              LOG.info("Received move message: {}", receivedMessage[0]);
              messageLatch.countDown();
              socket.disconnect();
            })
        .on(
            Socket.EVENT_CONNECT_ERROR,
            args -> {
              LOG.error("Socket.IO connect error: {}", args[0]);
              connectLatch.countDown();
              messageLatch.countDown();
            })
        .on(Socket.EVENT_DISCONNECT, args -> LOG.info("Disconnected from Socket.IO server"));

    socket.connect();
    if (!connectLatch.await(10, TimeUnit.SECONDS)) {
      fail("Could not connect to Socket.IO server");
    }

    // Initiate the move operation after connection is established
    MoveGlossaryTermResponse moveResponse = moveEntityAsync(id, newParent);
    assertNotNull(moveResponse.getJobId());
    assertTrue(moveResponse.getMessage().contains("Move operation initiated"));

    if (!messageLatch.await(30, TimeUnit.SECONDS)) {
      fail("Did not receive move notification via Socket.IO within the expected time.");
    }

    String receivedJson = receivedMessage[0];
    if (receivedJson == null) {
      fail("Received message is null.");
    }

    return JsonUtils.readValue(receivedJson, MoveGlossaryTermMessage.class);
  }

  /**
   * Helper method to initiate async move operation
   */
  protected MoveGlossaryTermResponse moveEntityAsync(UUID id, EntityReference newParent)
      throws HttpResponseException {
    try {
      WebTarget target = getCollection().path(String.format("/%s/moveAsync", id));

      // Create MoveGlossaryTermRequest
      Map<String, Object> payload = new HashMap<>();
      if (newParent != null) {
        payload.put("parent", newParent);
      }

      LOG.info("Moving entity with id {}, target:{}", id, target);
      return TestUtils.put(
          target,
          payload,
          MoveGlossaryTermResponse.class,
          Response.Status.ACCEPTED,
          TestUtils.ADMIN_AUTH_HEADERS);
    } catch (HttpResponseException e) {
      LOG.error("Failed to move entity with id {}: {}", id, e.getMessage());
      throw e;
    }
  }

  /**
   * Helper method to add assets to a glossary term
   */
  private void addAssetsToGlossaryTerm(GlossaryTerm term, List<Table> tables)
      throws HttpResponseException {
    List<EntityReference> assets =
        tables.stream()
            .map(table -> new EntityReference().withId(table.getId()).withType("table"))
            .toList();

    Map<String, Object> payload = Map.of("assets", assets, "dryRun", false);

    WebTarget target = getCollection().path(String.format("/%s/assets/add", term.getId()));
    TestUtils.put(target, payload, BulkOperationResult.class, OK, ADMIN_AUTH_HEADERS);
  }

  /**
   * Helper method to get workflow definition by name
   */
  private WebTarget getWorkflowDefinitionByName(String name) {
    return getResource("governance/workflowDefinitions/name/" + name);
  }

  /**
   * Helper method to patch workflow definition
   */
  private void patchWorkflowDefinition(String name, String jsonPatchString) throws Exception {
    ObjectMapper mapper = new ObjectMapper();
    JsonNode patch = mapper.readTree(jsonPatchString);

    WebTarget target = getWorkflowDefinitionByName(name);
    Response response =
        SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS)
            .method(
                "PATCH",
                jakarta.ws.rs.client.Entity.entity(
                    patch.toString(), MediaType.APPLICATION_JSON_PATCH_JSON_TYPE));

    assertEquals(200, response.getStatus(), "Failed to patch workflow definition");
    java.lang.Thread.sleep(1000); // Wait for change to take effect
  }

  /**
   * Helper method to check if workflow task was created
   */
  private boolean wasWorkflowTaskCreated(String termFqn, long timeoutMs) {
    try {
      waitForTaskToBeCreated(termFqn, timeoutMs);
      return true;
    } catch (Exception e) {
      return false;
    }
  }
}
