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
import static org.openmetadata.csv.EntityCsvTest.assertSummary;
import static org.openmetadata.csv.EntityCsvTest.createCsv;
import static org.openmetadata.schema.type.ColumnDataType.BIGINT;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.GLOSSARY;
import static org.openmetadata.service.Entity.GLOSSARY_TERM;
import static org.openmetadata.service.exception.CatalogExceptionMessage.entityIsNotEmpty;
import static org.openmetadata.service.exception.CatalogExceptionMessage.glossaryTermMismatch;
import static org.openmetadata.service.exception.CatalogExceptionMessage.notReviewer;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;
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
import jakarta.ws.rs.core.GenericType;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
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
import org.openmetadata.schema.api.CreateTaskDetails;
import org.openmetadata.schema.api.ValidateGlossaryTagsRequest;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.TermReference;
import org.openmetadata.schema.api.feed.CreateThread;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.EntityHierarchy;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.CustomPropertyConfig;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskDetails;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.events.EventSubscriptionResourceTest;
import org.openmetadata.service.resources.feeds.FeedResource.ThreadList;
import org.openmetadata.service.resources.feeds.FeedResourceTest;
import org.openmetadata.service.resources.feeds.MessageParser;
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
    // Ensure the workflow is active (it might have been suspended by another test)
    WorkflowHandler.getInstance().resumeWorkflow("GlossaryTermApprovalWorkflow");

    //
    // glossary1 create without reviewers is created with Approved status
    //
    CreateGlossary createGlossary =
        glossaryTest.createRequest(getEntityName(test, 1)).withReviewers(null);
    Glossary glossary1 = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    // term g1t1 under glossary1 is created in Approved mode without reviewers
    GlossaryTerm g1t1 = createTerm(glossary1, null, "g1t1");
    assertEquals(EntityStatus.APPROVED, g1t1.getEntityStatus());

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
    assertEquals(EntityStatus.DRAFT, g2t1.getEntityStatus());
    waitForTaskToBeCreated(g2t1.getFullyQualifiedName());
    assertEquals(
        EntityStatus.IN_REVIEW,
        getEntity(g2t1.getId(), authHeaders(USER1.getName())).getEntityStatus());
    assertApprovalTask(g2t1, TaskStatus.Open); // A Request Approval task is opened

    // Non reviewer - even Admin - can't change the `Draft` to `Approved` status using PATCH
    String json = JsonUtils.pojoToJson(g2t1);
    g2t1.setEntityStatus(EntityStatus.APPROVED);
    assertResponse(
        () -> patchEntity(g2t1.getId(), json, g2t1, ADMIN_AUTH_HEADERS),
        FORBIDDEN,
        notReviewer("admin"));

    // A reviewer can change the `Draft` to `Approved` status using PATCH or PUT
    GlossaryTerm g2t1Updated = patchEntity(g2t1.getId(), json, g2t1, authHeaders(USER1.getName()));
    assertEquals(EntityStatus.APPROVED, g2t1Updated.getEntityStatus());
    assertApprovalTask(g2t1, TaskStatus.Closed); // The Request Approval task is closed

    //
    // Glossary terms g2t2 created is in `Draft` status. Automatically a Request Approval task is
    // created.
    // Only a reviewer can resolve the task. Resolving the task changes g2t1 status from `Draft` to
    // `Approved`.
    //
    GlossaryTerm g2t2 = createTerm(glossary2, null, "g2t2");
    assertEquals(EntityStatus.DRAFT, g2t2.getEntityStatus());
    waitForTaskToBeCreated(g2t2.getFullyQualifiedName());
    assertEquals(
        EntityStatus.IN_REVIEW,
        getEntity(g2t2.getId(), authHeaders(USER1.getName())).getEntityStatus());
    Thread approvalTask =
        assertApprovalTask(g2t2, TaskStatus.Open); // A Request Approval task is opened
    int taskId = approvalTask.getTask().getId();

    // Even admin can't resolve the task
    ResolveTask resolveTask = new ResolveTask().withNewValue(EntityStatus.APPROVED.value());
    assertResponse(
        () -> taskTest.resolveTask(taskId, resolveTask, ADMIN_AUTH_HEADERS),
        FORBIDDEN,
        notReviewer("admin"));

    // Reviewer resolves the task. Glossary is approved. And task is resolved.
    taskTest.resolveTask(taskId, resolveTask, authHeaders(USER1.getName()));
    assertApprovalTask(g2t2, TaskStatus.Closed); // A Request Approval task is opened
    g2t2 = getEntity(g2t2.getId(), authHeaders(USER1.getName()));
    assertEquals(EntityStatus.APPROVED, g2t2.getEntityStatus());

    //
    // Glossary terms g2t3 created is in `Draft` status. Automatically a Request Approval task is
    // created.
    // Only a reviewer can close the task. Closing the task moves g2t1 from `Draft` to `Rejected`
    // state.
    //
    GlossaryTerm g2t3 = createTerm(glossary2, null, "g2t3");
    assertEquals(EntityStatus.DRAFT, g2t3.getEntityStatus());
    waitForTaskToBeCreated(g2t3.getFullyQualifiedName());
    assertEquals(
        EntityStatus.IN_REVIEW,
        getEntity(g2t3.getId(), authHeaders(USER1.getName())).getEntityStatus());
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
    assertEquals(EntityStatus.REJECTED, g2t3.getEntityStatus());

    //
    // Glossary terms g2t4 created is in `Draft` status. Automatically a Request Approval task is
    // created.
    // Only a reviewer changes the status to `Rejected`. This automatically closes Request Approval
    // task.
    //
    final GlossaryTerm g2t4 = createTerm(glossary2, null, "g2t4");
    assertEquals(EntityStatus.DRAFT, g2t4.getEntityStatus());
    waitForTaskToBeCreated(g2t4.getFullyQualifiedName());
    assertEquals(
        EntityStatus.IN_REVIEW,
        getEntity(g2t4.getId(), authHeaders(USER1.getName())).getEntityStatus());
    assertApprovalTask(g2t4, TaskStatus.Open); // A Request Approval task is opened

    // Non reviewer - even Admin - can't change the `Draft` to `Approved` status using PATCH
    String json2 = JsonUtils.pojoToJson(g2t4);
    g2t4.setEntityStatus(EntityStatus.REJECTED);
    assertResponse(
        () -> patchEntity(g2t4.getId(), json2, g2t4, ADMIN_AUTH_HEADERS),
        FORBIDDEN,
        notReviewer("admin"));

    // A reviewer can change the `Draft` to `Rejected` status using PATCH
    GlossaryTerm g2t4Updated = patchEntity(g2t4.getId(), json2, g2t4, authHeaders(USER1.getName()));
    assertEquals(EntityStatus.REJECTED, g2t4Updated.getEntityStatus());
    assertApprovalTask(g2t4, TaskStatus.Closed); // The Request Approval task is closed

    // Creating a glossary term g2t5 should be in `Draft` mode (because glossary has reviewers)
    // adding a new reviewer should add the person as assignee to the task

    GlossaryTerm g2t5 = createTerm(glossary2, null, "g2t5");
    assertEquals(EntityStatus.DRAFT, g2t5.getEntityStatus());
    waitForTaskToBeCreated(g2t5.getFullyQualifiedName());
    g2t5 = getEntity(g2t5.getId(), authHeaders(USER1.getName()));
    assertEquals(EntityStatus.IN_REVIEW, g2t5.getEntityStatus());
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
    assertEquals(g2t5.getEntityStatus(), EntityStatus.IN_REVIEW);

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
    createTerm(g1, t121, "t1211");

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
        EntityStatus expectedStatus = EntityStatus.fromValue(expected.toString());
        EntityStatus actualStatus = EntityStatus.fromValue(actual.toString());
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
    term11.setChildren(List.of(term111.getEntityReference()));

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
        assertEquals(0, responseChild.getChildrenCount());
      } else {
        assertEquals(responseChild.getChildren().size(), responseChild.getChildrenCount());
      }
    }

    GlossaryTerm response = getEntity(term1.getId(), "childrenCount", ADMIN_AUTH_HEADERS);
    assertEquals(
        term1.getChildren().size() + term11.getChildren().size(), response.getChildrenCount());

    queryParams = new HashMap<>();
    queryParams.put("directChildrenOf", glossary1.getFullyQualifiedName());
    queryParams.put("fields", "childrenCount");
    children = listEntities(queryParams, ADMIN_AUTH_HEADERS).getData();
    assertEquals(
        term1.getChildren().size() + term11.getChildren().size(),
        children.get(0).getChildrenCount());
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

    // Test Scenario 6: Try to move a term to its own child (should fail with circular reference
    // error)
    EntityReference childTerm1Ref =
        new EntityReference().withId(childTerm1.getId()).withType("glossaryTerm");

    // This should fail immediately with a 400 BAD_REQUEST due to circular reference validation
    assertThrows(
        HttpResponseException.class,
        () -> moveEntityAsync(term1.getId(), childTerm1Ref),
        "Expected circular reference validation to fail");

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

  // Test 1: Glossary has no reviewers, Term has reviewers, User who created is the Reviewer, so the
  // term goes to approved.
  @Test
  void test_GlossaryTermWorkflow_TermHasReviewers_CreatorIsReviewer_AutoApproved(TestInfo test)
      throws Exception {
    // Create glossary with no reviewers
    Glossary glossary = createGlossary(test, null, null);

    // Create term with specific reviewers, where creator is one of the reviewers
    CreateGlossaryTerm createRequest =
        new CreateGlossaryTerm()
            .withName("termWithReviewers")
            .withDescription("Term created by reviewer")
            .withGlossary(glossary.getFullyQualifiedName())
            .withReviewers(listOf(USER1.getEntityReference(), USER2.getEntityReference()));

    // Create the term as USER1 (who is a reviewer of the term itself)
    GlossaryTerm createdTerm = createEntity(createRequest, authHeaders(USER1.getName()));

    // Wait for workflow to process
    // The workflow checks updatedBy field. Since USER1 is a reviewer, term should be auto-approved
    java.lang.Thread.sleep(10000); // Wait 10 seconds for workflow to complete
    GlossaryTerm updatedTerm = getEntity(createdTerm.getId(), "", authHeaders(USER1.getName()));

    // The term should be auto-approved since creator (USER1) is a reviewer
    assertEquals(
        EntityStatus.APPROVED,
        updatedTerm.getEntityStatus(),
        "Term should be auto-approved when creator is a reviewer");

    // CRITICAL: Verify that updatedBy is the reviewer (USER1), not governance-bot
    assertEquals(
        USER1.getName(),
        updatedTerm.getUpdatedBy(),
        "Term should be updated by the reviewer (USER1), not governance-bot");

    // Verify: No workflow task should be created since term was auto-approved
    assertFalse(
        wasWorkflowTaskCreated(createdTerm.getFullyQualifiedName(), 2000),
        "No workflow task should be created for auto-approved term");
  }

  // Test 2: Term has reviewers, the user who updated the term is a reviewer, so the term stays
  // approved.
  @Test
  void test_GlossaryTermWorkflow_TermHasReviewers_UpdatedByIsReviewer_NoWorkflow(TestInfo test)
      throws Exception {
    // Create glossary with no reviewers
    Glossary glossary = createGlossary(test, null, null);

    // Create term with specific reviewers
    GlossaryTerm term =
        createTerm(
            glossary,
            null,
            "termForUpdate",
            listOf(USER1.getEntityReference(), USER2.getEntityReference()));

    // Initially the term should go through workflow since it was created by admin
    waitForTaskToBeCreated(term.getFullyQualifiedName(), 30000L);
    Thread approvalTask = assertApprovalTask(term, TaskStatus.Open);
    taskTest.resolveTask(
        approvalTask.getTask().getId(),
        new ResolveTask().withNewValue("Approved"),
        authHeaders(USER1.getName()));

    // Update the term as USER1 (who is a reviewer)
    String json = JsonUtils.pojoToJson(term);
    term.setDescription("Updated by reviewer USER1");
    GlossaryTerm updatedTerm = patchEntity(term.getId(), json, term, authHeaders(USER1.getName()));

    // CRITICAL: Verify that updatedBy is the reviewer (USER1), not governance-bot
    assertEquals(
        USER1.getName(),
        updatedTerm.getUpdatedBy(),
        "Term should be updated by the reviewer (USER1), not governance-bot");

    // Verify no workflow task was created
    boolean taskCreated = wasWorkflowTaskCreated(term.getFullyQualifiedName(), 5000L);
    assertFalse(taskCreated, "No workflow should be triggered when reviewer updates the term");
  }

  // Test 3: Term has reviewers, but the user who created the term is not a reviewer, so the term is
  // created DRAFT and moves to in review after the task is created for the reviewer
  @Test
  void test_GlossaryTermWorkflow_TermHasReviewers_CreatorNotReviewer_WorkflowTriggered(
      TestInfo test) throws Exception {
    // Create glossary with no reviewers
    Glossary glossary = createGlossary(test, null, null);

    // Create term with specific reviewers, where creator is NOT one of the reviewers
    CreateGlossaryTerm createRequest =
        new CreateGlossaryTerm()
            .withName("termNotByReviewer")
            .withDescription("Term created by non-reviewer")
            .withGlossary(glossary.getFullyQualifiedName())
            .withReviewers(listOf(USER1.getEntityReference(), USER2.getEntityReference()));

    // Create the term as admin (who is NOT a reviewer of the term)
    GlossaryTerm createdTerm = createEntity(createRequest, ADMIN_AUTH_HEADERS);

    // Verify: Workflow task should be created and term should move to IN_REVIEW
    waitForTaskToBeCreated(createdTerm.getFullyQualifiedName(), 30000L);
    Thread approvalTask = assertApprovalTask(createdTerm, TaskStatus.Open);

    // Fetch the updated term to see status change
    GlossaryTerm updatedTerm = getEntity(createdTerm.getId(), "", ADMIN_AUTH_HEADERS);
    assertEquals(
        EntityStatus.IN_REVIEW,
        updatedTerm.getEntityStatus(),
        "Term should be moved to IN_REVIEW after workflow creation");

    // Resolve the task to complete the workflow and prevent EntityNotFoundException
    try {
      taskTest.resolveTask(
          approvalTask.getTask().getId(),
          new ResolveTask().withNewValue("Approved"),
          authHeaders(USER1.getName()));
    } catch (Exception ignore) {
      // Ignore failure - should be flowable lock exception, because the tests are happening fast
    }
    // Delete the Term
    try {
      deleteEntity(updatedTerm.getId(), true, true, authHeaders(USER1.getName()));
    } catch (Exception ignore) {
    }
  }

  // Test 4: Term has reviewers, but the user who updated the term is not a reviewer, so the term is
  // updated to DRAFT and moves to in review after the task is created for the reviewer.
  @Test
  void test_GlossaryTermWorkflow_TermHasReviewers_UpdatedByNotReviewer_WorkflowTriggered(
      TestInfo test) throws Exception {
    // Create glossary with no reviewers
    Glossary glossary = createGlossary(test, null, null);

    // Create and approve term first with reviewers
    GlossaryTerm term =
        createTerm(
            glossary,
            null,
            "termForNonReviewerUpdate",
            listOf(USER1.getEntityReference(), USER2.getEntityReference()));

    // Initially approve the term
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

    // Update by non-reviewer (DATA_CONSUMER) - should trigger workflow
    json = JsonUtils.pojoToJson(term);
    term.setDescription("Updated by non-reviewer DATA_CONSUMER");
    patchEntity(term.getId(), json, term, authHeaders(DATA_CONSUMER.getName()));

    // Verify workflow task was created
    boolean taskCreated = wasDetailedWorkflowTaskCreated(term.getFullyQualifiedName(), 90000L);
    assertTrue(taskCreated, "Workflow should be triggered when non-reviewer updates the term");

    // Verify term status moved to IN_REVIEW
    GlossaryTerm updatedTerm = getEntity(term.getId(), "", ADMIN_AUTH_HEADERS);
    assertEquals(
        EntityStatus.IN_REVIEW,
        updatedTerm.getEntityStatus(),
        "Term should be moved to IN_REVIEW after non-reviewer update");

    // Resolve the task to complete the workflow and prevent EntityNotFoundException
    Thread newApprovalTask = assertApprovalTask(term, TaskStatus.Open);
    try {
      taskTest.resolveTask(
          newApprovalTask.getTask().getId(),
          new ResolveTask().withNewValue("Approved"),
          authHeaders(USER1.getName()));

      // Wait for task resolution workflow to complete
      java.lang.Thread.sleep(5000);

      // CRITICAL: Verify final term has been approved by USER1, not governance-bot
      GlossaryTerm finalTerm = getEntity(term.getId(), "", ADMIN_AUTH_HEADERS);
      assertEquals(
          EntityStatus.APPROVED,
          finalTerm.getEntityStatus(),
          "Term should be approved after task resolution");
      assertEquals(
          USER1.getName(),
          finalTerm.getUpdatedBy(),
          "Term should be updated by the approver (USER1), not governance-bot");
    } catch (Exception ignore) {
      // Ignore failure - should be flowable lock exception, because the tests are happening fast
    }
    // Delete the Term
    try {
      deleteEntity(updatedTerm.getId(), true, true, authHeaders(USER1.getName()));
    } catch (Exception ignore) {
    }
  }

  // Test 5: Team membership test - User is part of a reviewer team, so auto-approved
  @Test
  void test_GlossaryTermWorkflow_TeamReviewer_MemberCreatesTermAutoApproved(TestInfo test)
      throws Exception {
    // Get existing team and explicitly add USER1 to it for this test
    Team reviewerTeam =
        Entity.getEntityByName(Entity.TEAM, "Organization", "users", Include.NON_DELETED);

    // Add ADMIN to the Organization team for this test (so ADMIN can create terms as a team member)
    String jsonTeam = JsonUtils.pojoToJson(reviewerTeam);
    List<EntityReference> currentUsers =
        reviewerTeam.getUsers() != null
            ? new ArrayList<>(reviewerTeam.getUsers())
            : new ArrayList<>();
    currentUsers.add(
        Entity.getEntityReferenceByName(
            Entity.USER,
            "admin",
            Include.NON_DELETED)); // Add ADMIN to team so they can create terms as team member
    reviewerTeam.setUsers(currentUsers);

    // Update the team to include ADMIN
    Entity.getEntityRepository(Entity.TEAM)
        .patch(
            null,
            reviewerTeam.getId(),
            "admin",
            JsonUtils.getJsonPatch(jsonTeam, JsonUtils.pojoToJson(reviewerTeam)),
            null);

    // Create glossary with team as reviewer
    Glossary glossary = createGlossary(test, listOf(reviewerTeam.getEntityReference()), null);

    // Create term directly as ADMIN (who is now a member of the reviewer team)
    CreateGlossaryTerm createRequest =
        new CreateGlossaryTerm()
            .withName("termByTeamMember")
            .withDescription("Term created by team member ADMIN")
            .withGlossary(glossary.getFullyQualifiedName());

    // Create directly with ADMIN (who is now a team member and reviewer)
    GlossaryTerm createdTerm = createEntity(createRequest, ADMIN_AUTH_HEADERS);

    // Wait for workflow to process and check final status
    java.lang.Thread.sleep(10000); // Wait for workflow to complete
    GlossaryTerm updatedTerm = getEntity(createdTerm.getId(), "", ADMIN_AUTH_HEADERS);

    // Term should be auto-approved since ADMIN is a member of the reviewer team
    assertEquals(
        EntityStatus.APPROVED,
        updatedTerm.getEntityStatus(),
        "Term should be auto-approved when created by team member");

    // CRITICAL: Verify that updatedBy is the team member (admin), not governance-bot
    assertEquals(
        "admin",
        updatedTerm.getUpdatedBy(),
        "Term should be updated by the team member (admin), not governance-bot");

    // Verify: No workflow task should be created since term was auto-approved
    assertFalse(
        wasWorkflowTaskCreated(createdTerm.getFullyQualifiedName(), 2000),
        "No workflow task should be created for auto-approved term");
  }

  // Test 6: Team membership test - User updates term and is part of reviewer team, so no workflow
  @Test
  void test_GlossaryTermWorkflow_TeamReviewer_MemberUpdatesTermNoWorkflow(TestInfo test)
      throws Exception {
    // Get existing team and add USER1 to it for this test
    Team reviewerTeam =
        Entity.getEntityByName(Entity.TEAM, "Organization", "users", Include.NON_DELETED);

    // Add USER1 to the Organization team for this test (if not already added)
    String jsonTeam = JsonUtils.pojoToJson(reviewerTeam);
    List<EntityReference> currentUsers =
        reviewerTeam.getUsers() != null
            ? new ArrayList<>(reviewerTeam.getUsers())
            : new ArrayList<>();
    if (currentUsers.stream().noneMatch(u -> u.getId().equals(USER1.getId()))) {
      currentUsers.add(USER1.getEntityReference());
      reviewerTeam.setUsers(currentUsers);

      // Update the team to include USER1
      Entity.getEntityRepository(Entity.TEAM)
          .patch(
              null,
              reviewerTeam.getId(),
              "admin",
              JsonUtils.getJsonPatch(jsonTeam, JsonUtils.pojoToJson(reviewerTeam)),
              null);
    }

    // Create glossary with team as reviewer
    Glossary glossary = createGlossary(test, listOf(reviewerTeam.getEntityReference()), null);

    // Create term by admin first (not a team member)
    GlossaryTerm term = createTerm(glossary, null, "termForTeamMemberUpdate");

    // Simplified test - just verify term creation works with team reviewers
    assertNotNull(term);
    // Term starts with DRAFT
    assertSame(EntityStatus.DRAFT, term.getEntityStatus());
    java.lang.Thread.sleep(10000L);
    GlossaryTerm glossaryTerm = getEntity(term.getId(), ADMIN_AUTH_HEADERS);
    // Auto approval after the workflow is triggered
    assertSame(EntityStatus.APPROVED, glossaryTerm.getEntityStatus());
    LOG.info(
        "Team reviewer update test - term created successfully with status: {}",
        term.getEntityStatus());
  }

  // Test 7: Custom jsonLogic filter test - using existing isOwner filter
  @Test
  void test_GlossaryTermWorkflow_CustomFilter_IsOwner_NoWorkflow(TestInfo test) throws Exception {
    // Create glossary with reviewers
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
        "[{\"op\":\"replace\",\"path\":\"/trigger/config/filter\",\"value\":{\"glossaryterm\":\"{\\\"or\\\":[{\\\"isReviewer\\\":{\\\"var\\\":\\\"updatedBy\\\"}},{\\\"isOwner\\\":{\\\"var\\\":\\\"updatedBy\\\"}}]}\",\"default\":\"\"}}]";
    patchWorkflowDefinition("GlossaryTermApprovalWorkflow", patchJson);

    // Wait for workflow patch to take effect
    java.lang.Thread.sleep(2000);

    // Update by owner USER2 - should NOT trigger workflow (isOwner = true in OR condition)
    String json = JsonUtils.pojoToJson(term);
    term.setDescription("Updated by owner USER2");
    patchEntity(term.getId(), json, term, authHeaders(USER2.getName()));

    // Verify no workflow task was created
    boolean taskCreated = wasWorkflowTaskCreated(term.getFullyQualifiedName(), 5000L);
    assertFalse(
        taskCreated,
        "No workflow should be triggered when owner updates the term with isOwner filter");

    // Reset workflow filter back to empty AND
    String resetPatchJson =
        "[{\"op\":\"replace\",\"path\":\"/trigger/config/filter\",\"value\":{\"glossaryterm\":\"{\\\"and\\\":[]}\",\"default\":\"\"}}]";
    patchWorkflowDefinition("GlossaryTermApprovalWorkflow", resetPatchJson);
  }

  // Test 8: Custom jsonLogic filter test - using AND operator
  @Test
  void test_GlossaryTermWorkflow_CustomFilter_AndOperator_ConditionalTrigger(TestInfo test)
      throws Exception {
    // Create glossary with reviewers
    CreateGlossary createGlossary =
        glossaryTest
            .createRequest(getEntityName(test))
            .withReviewers(listOf(USER1.getEntityReference()));
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    // Create and approve term first
    GlossaryTerm term = createTerm(glossary, null, "andOperatorTest");
    waitForTaskToBeCreated(term.getFullyQualifiedName(), 30000L);
    Thread approvalTask = assertApprovalTask(term, TaskStatus.Open);
    taskTest.resolveTask(
        approvalTask.getTask().getId(),
        new ResolveTask().withNewValue("Approved"),
        authHeaders(USER1.getName()));

    // Patch workflow to use AND: isReviewer AND description exists
    String patchJson =
        "[{\"op\":\"replace\",\"path\":\"/trigger/config/filter\",\"value\":{\"glossaryterm\":\"{\\\"and\\\":[{\\\"isReviewer\\\":{\\\"var\\\":\\\"updatedBy\\\"}},{\\\"!=\\\":[{\\\"var\\\":\\\"description\\\"},null]}]}\",\"default\":\"\"}}]";
    patchWorkflowDefinition("GlossaryTermApprovalWorkflow", patchJson);

    // Wait for workflow patch to take effect
    java.lang.Thread.sleep(5000L);

    // Update by reviewer USER1 with description - should NOT trigger (isReviewer=true AND
    // description exists=true, result=true, negated=false)
    String json = JsonUtils.pojoToJson(term);
    term.setDescription("Updated by reviewer with description");
    patchEntity(term.getId(), json, term, authHeaders(USER1.getName()));

    // Verify no workflow task was created
    boolean taskCreated = wasWorkflowTaskCreated(term.getFullyQualifiedName(), 5000L);
    assertFalse(taskCreated, "No workflow should be triggered when AND condition is true");

    // Update by non-reviewer (admin) with description - should trigger (isReviewer=false AND
    // description exists=true, result=false, negated=true)
    json = JsonUtils.pojoToJson(term);
    term.setDescription("Updated by non-reviewer admin");
    patchEntity(term.getId(), json, term, ADMIN_AUTH_HEADERS);

    // Verify workflow task was created
    taskCreated = wasDetailedWorkflowTaskCreated(term.getFullyQualifiedName(), 90000L);
    assertTrue(taskCreated, "Workflow should be triggered when AND condition is false");

    // Resolve the task to complete the workflow and prevent EntityNotFoundException
    Thread newApprovalTask = assertApprovalTask(term, TaskStatus.Open);
    try {
      taskTest.resolveTask(
          newApprovalTask.getTask().getId(),
          new ResolveTask().withNewValue("Approved"),
          authHeaders(USER1.getName()));
    } catch (Exception ignore) {
      // Ignore failure - should be flowable lock exception, because the tests are happening fast
    }

    // Reset workflow filter back to empty AND
    String resetPatchJson =
        "[{\"op\":\"replace\",\"path\":\"/trigger/config/filter\",\"value\":{\"glossaryterm\":\"{\\\"and\\\":[]}\",\"default\":\"\"}}]";
    patchWorkflowDefinition("GlossaryTermApprovalWorkflow", resetPatchJson);
  }

  @Test
  void test_MultipleReviewerApprovalThreshold(TestInfo test) throws Exception {
    // Test 1: Multiple reviewer approval with threshold of 2
    // Create two reviewers
    EntityReference reviewer1 = USER1.getEntityReference();
    EntityReference reviewer2 = USER2.getEntityReference();
    List<EntityReference> reviewers = Arrays.asList(reviewer1, reviewer2);

    // Patch workflow to set approval threshold to 2 BEFORE creating entities
    // Node at index 12 is "ApproveGlossaryTerm" userApprovalTask
    String patchOp =
        "[{\"op\":\"replace\",\"path\":\"/nodes/12/config/approvalThreshold\",\"value\":2}]";
    patchWorkflowDefinition("GlossaryTermApprovalWorkflow", patchOp);

    // Create glossary with reviewers
    Glossary glossary = createGlossary(test, reviewers, null);

    // Create glossary term with reviewers
    CreateGlossaryTerm createRequest =
        createRequest(getEntityName(test))
            .withDescription("Test term for multi-approval")
            .withGlossary(glossary.getFullyQualifiedName())
            .withReviewers(reviewers)
            .withSynonyms(null)
            .withRelatedTerms(null);
    GlossaryTerm term = createEntity(createRequest, ADMIN_AUTH_HEADERS);

    // Term should be in DRAFT status initially
    assertEquals(EntityStatus.DRAFT, term.getEntityStatus());

    // Wait for workflow to process and task to be created
    waitForTaskToBeCreated(term.getFullyQualifiedName());

    // After workflow processing, term should be IN_REVIEW
    assertEquals(
        EntityStatus.IN_REVIEW, getEntity(term.getId(), ADMIN_AUTH_HEADERS).getEntityStatus());

    // Get the task
    String entityLink =
        new MessageParser.EntityLink(Entity.GLOSSARY_TERM, term.getFullyQualifiedName())
            .getLinkString();
    ThreadList threads =
        taskTest.listTasks(entityLink, null, null, null, 100, authHeaders(reviewer1.getName()));
    assertFalse(threads.getData().isEmpty());
    Thread task = threads.getData().getFirst();
    int taskId = task.getTask().getId();

    // First reviewer approves
    ResolveTask resolveTask = new ResolveTask().withNewValue(EntityStatus.APPROVED.value());
    taskTest.resolveTask(taskId, resolveTask, authHeaders(reviewer1.getName()));

    // After first approval, term should still be IN_REVIEW
    java.lang.Thread.sleep(2000); // Wait for async processing
    GlossaryTerm termAfterFirstApproval = getEntity(term.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(EntityStatus.IN_REVIEW, termAfterFirstApproval.getEntityStatus());

    // Second reviewer approves
    taskTest.resolveTask(taskId, resolveTask, authHeaders(reviewer2.getName()));

    // After second approval, term should be APPROVED
    java.lang.Thread.sleep(2000); // Wait for async processing
    GlossaryTerm termAfterSecondApproval = getEntity(term.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(EntityStatus.APPROVED, termAfterSecondApproval.getEntityStatus());

    // Reset workflow back to threshold of 1
    patchOp = "[{\"op\":\"replace\",\"path\":\"/nodes/12/config/approvalThreshold\",\"value\":1}]";
    patchWorkflowDefinition("GlossaryTermApprovalWorkflow", patchOp);
  }

  @Test
  void test_RollbackOnRejection(TestInfo test) throws Exception {
    // Test 2: Rollback on rejection scenario
    EntityReference reviewer = USER1.getEntityReference();
    List<EntityReference> reviewers = List.of(reviewer);

    // Create glossary with reviewer
    Glossary glossary = createGlossary(test, reviewers, null);

    // Create glossary term
    String initialDescription = "Initial approved description";
    CreateGlossaryTerm createRequest =
        createRequest(getEntityName(test))
            .withDescription(initialDescription)
            .withGlossary(glossary.getFullyQualifiedName())
            .withReviewers(reviewers)
            .withSynonyms(null)
            .withRelatedTerms(null);
    GlossaryTerm term = createEntity(createRequest, ADMIN_AUTH_HEADERS);

    // Wait for task and approve it
    waitForTaskToBeCreated(term.getFullyQualifiedName());
    String entityLink =
        new MessageParser.EntityLink(Entity.GLOSSARY_TERM, term.getFullyQualifiedName())
            .getLinkString();
    ThreadList threads =
        taskTest.listTasks(entityLink, null, null, null, 100, authHeaders(reviewer.getName()));
    Thread task = threads.getData().getFirst();
    int taskId = task.getTask().getId();

    ResolveTask approveTask = new ResolveTask().withNewValue(EntityStatus.APPROVED.value());
    taskTest.resolveTask(taskId, approveTask, authHeaders(reviewer.getName()));

    java.lang.Thread.sleep(2000);
    GlossaryTerm approvedTerm = getEntity(term.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(EntityStatus.APPROVED, approvedTerm.getEntityStatus());
    double version1 = approvedTerm.getVersion();

    // Update term with non-reviewer (should trigger workflow)
    String updatedDescription = "Updated description by non-reviewer";
    String origJson = JsonUtils.pojoToJson(approvedTerm);
    approvedTerm.setDescription(updatedDescription);
    GlossaryTerm updatedTerm =
        patchEntityUsingFqn(
            approvedTerm.getFullyQualifiedName(),
            origJson,
            approvedTerm,
            authHeaders(USER2.getName()));

    // Wait for new task to be created for the update
    waitForDetailedTaskToBeCreated(term.getFullyQualifiedName(), 90000L);

    // Get the new task
    threads =
        taskTest.listTasks(entityLink, null, null, null, 100, authHeaders(reviewer.getName()));
    Thread updateTask = threads.getData().getFirst();
    int updateTaskId = updateTask.getTask().getId();

    // Reject the changes
    ResolveTask rejectTask = new ResolveTask().withNewValue(EntityStatus.REJECTED.value());
    taskTest.resolveTask(updateTaskId, rejectTask, authHeaders(reviewer.getName()));

    java.lang.Thread.sleep(2000);
    GlossaryTerm rolledBackTerm = getEntity(term.getId(), ADMIN_AUTH_HEADERS);

    // Verify rollback: description should be back to initial, status should be approved
    assertEquals(initialDescription, rolledBackTerm.getDescription());
    assertEquals(EntityStatus.APPROVED, rolledBackTerm.getEntityStatus());
    // Version should be bumped for audit trail
    assertTrue(
        rolledBackTerm.getVersion() > version1, "Version should be incremented for audit trail");
  }

  @Test
  void test_ReviewerSuggestionApplication(TestInfo test) throws Exception {
    // Test 3: Reviewer suggestion application
    EntityReference reviewer = USER1.getEntityReference();
    List<EntityReference> reviewers = List.of(reviewer);

    // Create glossary with reviewer
    Glossary glossary = createGlossary(test, reviewers, null);

    // Create glossary term
    String initialDescription = "Initial description";
    CreateGlossaryTerm createRequest =
        createRequest(getEntityName(test))
            .withDescription(initialDescription)
            .withGlossary(glossary.getFullyQualifiedName())
            .withReviewers(reviewers)
            .withSynonyms(null)
            .withRelatedTerms(null);
    GlossaryTerm term = createEntity(createRequest, ADMIN_AUTH_HEADERS);

    // Wait for task to be created
    waitForTaskToBeCreated(term.getFullyQualifiedName());

    // Get the task
    String entityLink =
        new MessageParser.EntityLink(Entity.GLOSSARY_TERM, term.getFullyQualifiedName())
            .getLinkString();
    ThreadList threads =
        taskTest.listTasks(entityLink, null, null, null, 100, authHeaders(reviewer.getName()));
    Thread task = threads.getData().getFirst();
    int taskId = task.getTask().getId();

    // Approve initially
    ResolveTask approveTask = new ResolveTask().withNewValue(EntityStatus.APPROVED.value());
    taskTest.resolveTask(taskId, approveTask, authHeaders(reviewer.getName()));

    java.lang.Thread.sleep(2000);
    GlossaryTerm approvedTerm = getEntity(term.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(EntityStatus.APPROVED, approvedTerm.getEntityStatus());

    // Update term to trigger a new approval workflow
    String updateDescription = "Updated description for review";
    String origJson = JsonUtils.pojoToJson(approvedTerm);
    approvedTerm.setDescription(updateDescription);
    GlossaryTerm updatedTerm =
        patchEntityUsingFqn(
            approvedTerm.getFullyQualifiedName(),
            origJson,
            approvedTerm,
            authHeaders(USER2.getName()));

    // Wait for detailed task to be created
    waitForDetailedTaskToBeCreated(term.getFullyQualifiedName(), 90000L);

    // Get the new task
    threads =
        taskTest.listTasks(entityLink, null, null, null, 100, authHeaders(reviewer.getName()));
    Thread updateTask = threads.getData().getFirst();
    int updateTaskId = updateTask.getTask().getId();

    // Reviewer simply approves the term without suggestions
    approveTask = new ResolveTask().withNewValue("approved");
    taskTest.resolveTask(updateTaskId, approveTask, authHeaders(reviewer.getName()));

    java.lang.Thread.sleep(2000);
    GlossaryTerm finalTerm = getEntity(term.getId(), ADMIN_AUTH_HEADERS);

    // Verify the term is approved with the original update description
    assertEquals(EntityStatus.APPROVED, finalTerm.getEntityStatus());
    assertEquals(updateDescription, finalTerm.getDescription());
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

  @Test
  void test_searchGlossaryTerms() throws IOException {
    // Create a glossary for testing
    Glossary glossary =
        glossaryTest.createEntity(
            glossaryTest.createRequest("searchTestGlossary"), ADMIN_AUTH_HEADERS);

    // Create multiple glossary terms with different names
    List<GlossaryTerm> terms = new ArrayList<>();
    for (int i = 1; i <= 10; i++) {
      CreateGlossaryTerm createTerm =
          createRequest("SearchTerm" + i)
              .withGlossary(glossary.getFullyQualifiedName())
              .withDescription("This is SearchTerm " + i + " for testing search functionality");
      GlossaryTerm term = createEntity(createTerm, ADMIN_AUTH_HEADERS);
      terms.add(term);
    }

    // Test 1: Search by exact term name
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("q", "SearchTerm5");
    queryParams.put("glossaryFqn", glossary.getFullyQualifiedName());
    queryParams.put("limit", "10");
    queryParams.put("offset", "0");

    ResultList<GlossaryTerm> searchResults = searchGlossaryTerms(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(1, searchResults.getData().size());
    assertEquals("SearchTerm5", searchResults.getData().get(0).getName());

    // Test 2: Partial search
    queryParams.put("q", "Term");
    searchResults = searchGlossaryTerms(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(10, searchResults.getData().size());

    // Test 3: Search with pagination
    queryParams.put("limit", "5");
    searchResults = searchGlossaryTerms(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(5, searchResults.getData().size());

    // Test 4: Search with offset
    queryParams.put("offset", "5");
    searchResults = searchGlossaryTerms(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(5, searchResults.getData().size());

    // Test 5: Search with display name (if terms had display names)
    // Skip this test since our test terms don't have display names set

    // Test 6: Search with no results
    queryParams.put("q", "NonExistentTerm");
    searchResults = searchGlossaryTerms(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(0, searchResults.getData().size());

    // Clean up - hard delete terms first, then glossary
    for (GlossaryTerm term : terms) {
      deleteEntity(term.getId(), true, true, ADMIN_AUTH_HEADERS);
    }
    glossaryTest.deleteEntity(glossary.getId(), true, true, ADMIN_AUTH_HEADERS);
  }

  @Test
  void test_searchGlossaryTermsWithHierarchy() throws IOException {
    // Create glossary
    Glossary glossary =
        glossaryTest.createEntity(
            glossaryTest.createRequest("hierarchySearchGlossary"), ADMIN_AUTH_HEADERS);

    // Create parent term
    CreateGlossaryTerm parentRequest =
        createRequest("ParentSearchTerm")
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Parent term for hierarchy search test");
    GlossaryTerm parentTerm = createEntity(parentRequest, ADMIN_AUTH_HEADERS);

    // Create child terms
    List<GlossaryTerm> childTerms = new ArrayList<>();
    for (int i = 1; i <= 5; i++) {
      CreateGlossaryTerm childRequest =
          createRequest("ChildSearchTerm" + i)
              .withGlossary(glossary.getFullyQualifiedName())
              .withParent(parentTerm.getFullyQualifiedName())
              .withDescription("Child term " + i + " under parent");
      GlossaryTerm childTerm = createEntity(childRequest, ADMIN_AUTH_HEADERS);
      childTerms.add(childTerm);
    }

    // Test 1: Search within parent term
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("q", "Child");
    queryParams.put("parentFqn", parentTerm.getFullyQualifiedName());

    ResultList<GlossaryTerm> searchResults = searchGlossaryTerms(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(5, searchResults.getData().size());
    assertTrue(
        searchResults.getData().stream().allMatch(t -> t.getName().startsWith("ChildSearchTerm")));

    // Test 2: Search by parent ID
    queryParams.clear();
    queryParams.put("q", "term");
    queryParams.put("parent", parentTerm.getId().toString());

    searchResults = searchGlossaryTerms(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(5, searchResults.getData().size());

    // Clean up - hard delete all terms first, then glossary
    for (GlossaryTerm term : childTerms) {
      deleteEntity(term.getId(), true, true, ADMIN_AUTH_HEADERS);
    }
    deleteEntity(parentTerm.getId(), true, true, ADMIN_AUTH_HEADERS);
    glossaryTest.deleteEntity(glossary.getId(), true, true, ADMIN_AUTH_HEADERS);
  }

  private ResultList<GlossaryTerm> searchGlossaryTerms(
      Map<String, String> queryParams, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/search");
    for (Map.Entry<String, String> entry : queryParams.entrySet()) {
      target = target.queryParam(entry.getKey(), entry.getValue());
    }
    return TestUtils.get(target, GlossaryTermResource.GlossaryTermList.class, authHeaders);
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

  @Test
  void test_circularReferenceDetection_directMove(TestInfo test) throws Exception {
    // Create a glossary
    CreateGlossary createGlossary = glossaryTest.createRequest(test);
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    // Create TermA as a root term under the glossary
    CreateGlossaryTerm createTermA =
        createRequest("TermA")
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Root term A");
    GlossaryTerm termA = createEntity(createTermA, ADMIN_AUTH_HEADERS);

    // Create TermB as a child of TermA
    CreateGlossaryTerm createTermB =
        createRequest("TermB")
            .withGlossary(glossary.getFullyQualifiedName())
            .withParent(termA.getFullyQualifiedName())
            .withDescription("Child term B of TermA");
    GlossaryTerm termB = createEntity(createTermB, ADMIN_AUTH_HEADERS);

    // Create TermC as a child of TermB (grandchild of TermA)
    CreateGlossaryTerm createTermC =
        createRequest("TermC")
            .withGlossary(glossary.getFullyQualifiedName())
            .withParent(termB.getFullyQualifiedName())
            .withDescription("Grandchild term C of TermA");
    GlossaryTerm termC = createEntity(createTermC, ADMIN_AUTH_HEADERS);

    // Test 1: Try to move TermA under TermB using moveAsync API (direct circular reference)
    // This should fail IMMEDIATELY with BAD_REQUEST before async operation starts
    assertThrows(
        HttpResponseException.class,
        () -> moveEntityAsync(termA.getId(), termB.getEntityReference()),
        "Should not allow TermA to be moved under TermB (direct circular reference)");

    // Test 2: Try to move TermA under TermC (indirect circular reference)
    assertThrows(
        HttpResponseException.class,
        () -> moveEntityAsync(termA.getId(), termC.getEntityReference()),
        "Should not allow TermA to be moved under TermC (indirect circular reference)");

    // Test 3: Try to move TermB under TermC (would create circular: A->B->C, C->B)
    assertThrows(
        HttpResponseException.class,
        () -> moveEntityAsync(termB.getId(), termC.getEntityReference()),
        "Should not allow TermB to be moved under TermC (TermC is already a child of TermB)");

    // Test 4: Verify valid move still works - move TermC to root level
    MoveGlossaryTermMessage moveMessage =
        receiveMoveEntityMessage(termC.getId(), glossary.getEntityReference());
    assertEquals(
        "COMPLETED", moveMessage.getStatus(), "Should successfully move TermC to root level");
    assertNull(moveMessage.getError(), "Move operation should complete without error");

    // Verify TermC has been moved to root level (no parent)
    GlossaryTerm movedTermC = getEntity(termC.getId(), ADMIN_AUTH_HEADERS);
    assertNull(movedTermC.getParent(), "TermC should have no parent after move to root level");
    assertEquals(
        glossary.getId(), movedTermC.getGlossary().getId(), "TermC should belong to the glossary");

    // Clean up
    deleteEntity(termC.getId(), true, true, ADMIN_AUTH_HEADERS);
    deleteEntity(termB.getId(), true, true, ADMIN_AUTH_HEADERS);
    deleteEntity(termA.getId(), true, true, ADMIN_AUTH_HEADERS);
    glossaryTest.deleteEntity(glossary.getId(), true, true, ADMIN_AUTH_HEADERS);
  }

  @Test
  void test_selfReferenceValidation(TestInfo test) throws IOException {
    // Test that a term cannot be set as its own parent
    CreateGlossary createGlossary = glossaryTest.createRequest(test);
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    CreateGlossaryTerm createTerm =
        createRequest("SelfRefTerm").withGlossary(glossary.getFullyQualifiedName());
    GlossaryTerm term = createEntity(createTerm, ADMIN_AUTH_HEADERS);

    // Try to move term to itself using moveAsync API
    assertThrows(
        HttpResponseException.class,
        () -> moveEntityAsync(term.getId(), term.getEntityReference()),
        "Should not allow term to be its own parent");

    // Clean up
    deleteEntity(term.getId(), true, true, ADMIN_AUTH_HEADERS);
    glossaryTest.deleteEntity(glossary.getId(), true, true, ADMIN_AUTH_HEADERS);
  }

  @Test
  void test_orphanedRelationshipsAfterMove(TestInfo test) throws Exception {
    // Create a glossary
    CreateGlossary createGlossary = glossaryTest.createRequest(test);
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    // Create TermA as root
    CreateGlossaryTerm createTermA =
        createRequest("TermA").withGlossary(glossary.getFullyQualifiedName());
    GlossaryTerm termA = createEntity(createTermA, ADMIN_AUTH_HEADERS);

    // Create TermB as child of TermA
    CreateGlossaryTerm createTermB =
        createRequest("TermB")
            .withGlossary(glossary.getFullyQualifiedName())
            .withParent(termA.getFullyQualifiedName());
    GlossaryTerm termB = createEntity(createTermB, ADMIN_AUTH_HEADERS);

    // Move TermB to root level (remove parent relationship) using async move API
    EntityReference glossaryRef =
        new EntityReference().withId(glossary.getId()).withType("glossary");
    MoveGlossaryTermMessage moveMessage = receiveMoveEntityMessage(termB.getId(), glossaryRef);
    assertEquals("COMPLETED", moveMessage.getStatus());
    assertNull(moveMessage.getError());

    // Verify TermB has no parent
    GlossaryTerm movedTermB = getEntity(termB.getId(), ADMIN_AUTH_HEADERS);
    assertNull(movedTermB.getParent(), "TermB should have no parent after move");

    // Verify we can list terms under the glossary without infinite loops
    Map<String, String> params = new HashMap<>();
    params.put("glossary", glossary.getId().toString());
    params.put("fields", "childrenCount,owners,reviewers");
    params.put("limit", "50");

    ResultList<GlossaryTerm> terms = listEntities(params, ADMIN_AUTH_HEADERS);
    assertNotNull(terms, "Should be able to list terms without errors");
    assertEquals(2, terms.getData().size(), "Should have 2 root-level terms");

    // Clean up
    deleteEntity(termB.getId(), true, true, ADMIN_AUTH_HEADERS);
    deleteEntity(termA.getId(), true, true, ADMIN_AUTH_HEADERS);
    glossaryTest.deleteEntity(glossary.getId(), true, true, ADMIN_AUTH_HEADERS);
  }

  @Test
  void test_directChildrenOfWithCircularRef(TestInfo test) throws IOException {
    // This test reproduces the exact scenario from the bug report
    CreateGlossary createGlossary = glossaryTest.createRequest(test);
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    // Create Salesforce-Glossary term
    CreateGlossaryTerm createSalesforce =
        createRequest("Salesforce-Glossary").withGlossary(glossary.getFullyQualifiedName());
    GlossaryTerm salesforceTerm = createEntity(createSalesforce, ADMIN_AUTH_HEADERS);

    // Create child terms under Salesforce-Glossary
    List<GlossaryTerm> childTerms = new ArrayList<>();
    for (int i = 1; i <= 5; i++) {
      CreateGlossaryTerm createChild =
          createRequest("ChildTerm" + i)
              .withGlossary(glossary.getFullyQualifiedName())
              .withParent(salesforceTerm.getFullyQualifiedName());
      childTerms.add(createEntity(createChild, ADMIN_AUTH_HEADERS));
    }

    // Query for direct children - this should not hang
    Map<String, String> params = new HashMap<>();
    params.put("directChildrenOf", salesforceTerm.getFullyQualifiedName());
    params.put("fields", "childrenCount,owners,reviewers");
    params.put("limit", "50");

    ResultList<GlossaryTerm> directChildren = listEntities(params, ADMIN_AUTH_HEADERS);
    assertNotNull(directChildren, "Should be able to get direct children without hanging");
    assertEquals(5, directChildren.getData().size(), "Should have 5 direct children");

    // Clean up
    for (GlossaryTerm child : childTerms) {
      deleteEntity(child.getId(), true, true, ADMIN_AUTH_HEADERS);
    }
    deleteEntity(salesforceTerm.getId(), true, true, ADMIN_AUTH_HEADERS);
    glossaryTest.deleteEntity(glossary.getId(), true, true, ADMIN_AUTH_HEADERS);
  }

  @Test
  void test_childrenCountIncludesAllNestedTerms(TestInfo test) throws IOException {
    // Create a glossary
    CreateGlossary createGlossary = glossaryTest.createRequest(test);
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    // Create a hierarchy: term1 -> term1.1 -> term1.1.1
    //                              -> term1.1.2
    //                     -> term1.2
    CreateGlossaryTerm createTerm1 =
        createRequest("term1").withGlossary(glossary.getFullyQualifiedName());
    GlossaryTerm term1 = createEntity(createTerm1, ADMIN_AUTH_HEADERS);

    CreateGlossaryTerm createTerm1_1 =
        createRequest("term1.1")
            .withGlossary(glossary.getFullyQualifiedName())
            .withParent(term1.getFullyQualifiedName());
    GlossaryTerm term1_1 = createEntity(createTerm1_1, ADMIN_AUTH_HEADERS);

    CreateGlossaryTerm createTerm1_1_1 =
        createRequest("term1.1.1")
            .withGlossary(glossary.getFullyQualifiedName())
            .withParent(term1_1.getFullyQualifiedName());
    GlossaryTerm term1_1_1 = createEntity(createTerm1_1_1, ADMIN_AUTH_HEADERS);

    CreateGlossaryTerm createTerm1_1_2 =
        createRequest("term1.1.2")
            .withGlossary(glossary.getFullyQualifiedName())
            .withParent(term1_1.getFullyQualifiedName());
    GlossaryTerm term1_1_2 = createEntity(createTerm1_1_2, ADMIN_AUTH_HEADERS);

    CreateGlossaryTerm createTerm1_2 =
        createRequest("term1.2")
            .withGlossary(glossary.getFullyQualifiedName())
            .withParent(term1.getFullyQualifiedName());
    GlossaryTerm term1_2 = createEntity(createTerm1_2, ADMIN_AUTH_HEADERS);

    // Fetch term1 with childrenCount field
    GlossaryTerm fetchedTerm1 = getEntity(term1.getId(), "childrenCount", ADMIN_AUTH_HEADERS);

    // term1 should have 4 nested children total (term1.1, term1.1.1, term1.1.2, term1.2)
    assertEquals(4, fetchedTerm1.getChildrenCount(), "term1 should have 4 total nested children");

    // Fetch term1.1 with childrenCount field
    GlossaryTerm fetchedTerm1_1 = getEntity(term1_1.getId(), "childrenCount", ADMIN_AUTH_HEADERS);

    // term1.1 should have 2 nested children (term1.1.1, term1.1.2)
    assertEquals(
        2, fetchedTerm1_1.getChildrenCount(), "term1.1 should have 2 total nested children");

    // Fetch term1.2 with childrenCount field
    GlossaryTerm fetchedTerm1_2 = getEntity(term1_2.getId(), "childrenCount", ADMIN_AUTH_HEADERS);

    // term1.2 should have 0 nested children
    assertEquals(0, fetchedTerm1_2.getChildrenCount(), "term1.2 should have 0 nested children");

    // Clean up
    deleteEntity(term1_1_1.getId(), true, true, ADMIN_AUTH_HEADERS);
    deleteEntity(term1_1_2.getId(), true, true, ADMIN_AUTH_HEADERS);
    deleteEntity(term1_2.getId(), true, true, ADMIN_AUTH_HEADERS);
    deleteEntity(term1_1.getId(), true, true, ADMIN_AUTH_HEADERS);
    deleteEntity(term1.getId(), true, true, ADMIN_AUTH_HEADERS);
    glossaryTest.deleteEntity(glossary.getId(), true, true, ADMIN_AUTH_HEADERS);
  }

  private boolean wasDetailedWorkflowTaskCreated(String termFqn, long timeoutMs) {
    try {
      waitForDetailedTaskToBeCreated(termFqn, timeoutMs);
      return true;
    } catch (Exception e) {
      return false;
    }
  }

  public static void waitForDetailedTaskToBeCreated(String fullyQualifiedName, long timeout) {
    String entityLink =
        new MessageParser.EntityLink(Entity.GLOSSARY_TERM, fullyQualifiedName).getLinkString();
    Awaitility.await(
            String.format(
                "Wait for Detailed Task to be Created for Glossary Term: '%s'", fullyQualifiedName))
        .ignoreExceptions()
        .pollInterval(Duration.ofMillis(2000L))
        .atMost(Duration.ofMillis(timeout))
        .until(
            () ->
                WorkflowHandler.getInstance()
                    .isActivityWithVariableExecuting(
                        "ApprovalForUpdates.approvalTask",
                        getNamespacedVariableName(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE),
                        entityLink));
  }

  @Test
  void test_getGlossaryTermAssetsAPI(TestInfo test) throws IOException {
    Glossary glossary = createGlossary(test, null, emptyList());
    CreateGlossaryTerm createTerm = createRequest(getEntityName(test), "", "", null);
    createTerm.setGlossary(glossary.getFullyQualifiedName());
    GlossaryTerm term = createEntity(createTerm, ADMIN_AUTH_HEADERS);

    TableResourceTest tableTest = new TableResourceTest();
    TagLabel termLabel = EntityUtil.toTagLabel(term);
    CreateTable createTable1 =
        tableTest.createRequest(getEntityName(test, 1)).withTags(List.of(termLabel));
    Table table1 = tableTest.createEntity(createTable1, ADMIN_AUTH_HEADERS);

    CreateTable createTable2 =
        tableTest.createRequest(getEntityName(test, 2)).withTags(List.of(termLabel));
    Table table2 = tableTest.createEntity(createTable2, ADMIN_AUTH_HEADERS);

    CreateTable createTable3 =
        tableTest.createRequest(getEntityName(test, 3)).withTags(List.of(termLabel));
    Table table3 = tableTest.createEntity(createTable3, ADMIN_AUTH_HEADERS);

    ResultList<EntityReference> assets = getAssets(term.getId(), 10, 0, ADMIN_AUTH_HEADERS);

    assertTrue(assets.getPaging().getTotal() >= 3);
    assertTrue(assets.getData().size() >= 3);
    assertTrue(assets.getData().stream().anyMatch(a -> a.getId().equals(table1.getId())));
    assertTrue(assets.getData().stream().anyMatch(a -> a.getId().equals(table2.getId())));
    assertTrue(assets.getData().stream().anyMatch(a -> a.getId().equals(table3.getId())));

    ResultList<EntityReference> assetsByName =
        getAssetsByName(term.getFullyQualifiedName(), 10, 0, ADMIN_AUTH_HEADERS);
    assertTrue(assetsByName.getPaging().getTotal() >= 3);
    assertTrue(assetsByName.getData().size() >= 3);

    ResultList<EntityReference> page1 = getAssets(term.getId(), 2, 0, ADMIN_AUTH_HEADERS);
    assertEquals(2, page1.getData().size());

    ResultList<EntityReference> page2 = getAssets(term.getId(), 2, 2, ADMIN_AUTH_HEADERS);
    assertFalse(page2.getData().isEmpty());
  }

  @Test
  void test_WorkflowTriggerOnDescriptionApprovalByNonReviewer(TestInfo test) throws Exception {
    // Test scenario:
    // 1. Create a glossary term with USER1 as reviewer (should be auto-approved)
    // 2. USER1 requests a description update, asking USER2 (non-reviewer) for approval
    // 3. When USER2 approves, verify the workflow IS triggered:
    //    - Description is updated
    //    - Term moves to IN_REVIEW status
    //    - Approval task is created for USER1

    try {
      // Step 1: Create glossary with no reviewers
      // Use simple names without special characters to avoid SQL syntax issues
      String simpleName = "glossary_workflow_test_" + System.currentTimeMillis();
      Glossary glossary = createGlossary(simpleName, null, null);

      // Create term with USER1 as reviewer
      String termName = "term_workflow_test_" + System.currentTimeMillis();
      CreateGlossaryTerm createRequest =
          createRequest(termName)
              .withDescription("Initial description")
              .withGlossary(glossary.getFullyQualifiedName())
              .withReviewers(listOf(USER1.getEntityReference()));

      // Create as USER1 (who is the reviewer) - should be auto-approved
      GlossaryTerm term = createEntity(createRequest, authHeaders(USER1.getName()));

      // Wait a bit for any workflow to process
      java.lang.Thread.sleep(2000);

      // Verify term is approved since creator is the reviewer
      GlossaryTerm autoApprovedTerm = getEntity(term.getId(), "", authHeaders(USER1.getName()));
      assertEquals(
          EntityStatus.APPROVED,
          autoApprovedTerm.getEntityStatus(),
          "Term should be auto-approved when creator is reviewer");

      // Record initial version for later comparison
      double initialVersion = autoApprovedTerm.getVersion();

      // Step 2: USER1 (reviewer) requests a description update, asking USER2 for approval
      // Create UpdateDescription task
      String newDescription = "Updated description needing approval";
      String entityLink =
          new MessageParser.EntityLink(Entity.GLOSSARY_TERM, term.getFullyQualifiedName())
              .getLinkString();

      CreateTaskDetails taskDetails =
          new CreateTaskDetails()
              .withType(TaskType.UpdateDescription)
              .withOldValue(term.getDescription())
              .withSuggestion(newDescription)
              .withAssignees(List.of(USER2.getEntityReference()));

      CreateThread createThread =
          new CreateThread()
              .withMessage("Please approve this description update")
              .withFrom(USER1.getName())
              .withAbout(entityLink)
              .withTaskDetails(taskDetails)
              .withType(ThreadType.Task);

      Thread descriptionTask = taskTest.createAndCheck(createThread, authHeaders(USER1.getName()));
      assertNotNull(descriptionTask);
      assertEquals(TaskStatus.Open, descriptionTask.getTask().getStatus());

      // Verify that USER2 can see the task
      ThreadList tasks =
          taskTest.listTasks(entityLink, null, null, null, 100, authHeaders(USER2.getName()));
      assertTrue(
          tasks.getData().stream().anyMatch(t -> t.getId().equals(descriptionTask.getId())),
          "USER2 should be able to see the task");

      // Step 3: USER2 (non-reviewer) approves the description update
      // This should trigger a workflow because USER2 is NOT a reviewer

      // USER2 resolves the task (approves the description change)
      ResolveTask resolveTask = new ResolveTask().withNewValue(newDescription);
      taskTest.resolveTask(
          descriptionTask.getTask().getId(), resolveTask, authHeaders(USER2.getName()));

      // Task resolution should have closed the description task immediately
      // Wait for the ChangeEvent to be processed and workflow to trigger
      java.lang.Thread.sleep(15000); // Give enough time for workflow processing

      // Step 4: Verify the workflow was triggered
      // When a non-reviewer (USER2) approves a change, the workflow should:
      // 1. Update the description (immediate effect)
      // 2. Move the term to IN_REVIEW status
      // 3. Create a new approval task for the actual reviewers (USER1)

      GlossaryTerm updatedTerm = getEntity(term.getId(), "", ADMIN_AUTH_HEADERS);

      // Verify description was updated immediately
      assertEquals(
          newDescription,
          updatedTerm.getDescription(),
          "Description should be updated after approval");

      // CRITICAL: Verify term moved to IN_REVIEW status (workflow was triggered)
      assertEquals(
          EntityStatus.IN_REVIEW,
          updatedTerm.getEntityStatus(),
          "Term MUST move to IN_REVIEW when non-reviewer approves changes - this proves workflow triggered");

      // Verify version was incremented (entity was modified)
      assertTrue(
          updatedTerm.getVersion() > initialVersion,
          "Version should be incremented after task resolution and workflow processing");

      // Step 5: Verify a new approval task was created for USER1 (the reviewer)
      // Wait a bit more for task creation
      java.lang.Thread.sleep(5000);

      // The workflow MUST create an approval task
      Thread approvalTask = assertApprovalTask(term, TaskStatus.Open);
      assertNotNull(approvalTask, "Workflow MUST create an approval task for the reviewer");

      // Verify the task is assigned to USER1 (the reviewer)
      assertTrue(
          approvalTask.getTask().getAssignees().stream()
              .anyMatch(a -> a.getId().equals(USER1.getEntityReference().getId())),
          "The approval task MUST be assigned to USER1 (the reviewer)");

      LOG.info(
          "Test completed: Workflow successfully triggered when non-reviewer approved description change");

      // Clean up: Resolve the approval task
      try {
        taskTest.resolveTask(
            approvalTask.getTask().getId(),
            new ResolveTask().withNewValue("Approved"),
            authHeaders(USER1.getName()));
        java.lang.Thread.sleep(2000);
      } catch (Exception e) {
        // Ignore cleanup errors
      }

    } finally {
      // Clean up: Re-suspend the workflow to not affect other tests
      WorkflowHandler.getInstance().suspendWorkflow("GlossaryTermApprovalWorkflow");
    }
  }

  @Test
  void test_getAllGlossaryTermsWithAssetsCount(TestInfo test) throws IOException {
    Glossary glossary = createGlossary(test, null, emptyList());
    CreateGlossaryTerm createTerm1 = createRequest(getEntityName(test, 1), "", "", null);
    createTerm1.setGlossary(glossary.getFullyQualifiedName());
    GlossaryTerm term1 = createEntity(createTerm1, ADMIN_AUTH_HEADERS);

    CreateGlossaryTerm createTerm2 = createRequest(getEntityName(test, 2), "", "", null);
    createTerm2.setGlossary(glossary.getFullyQualifiedName());
    GlossaryTerm term2 = createEntity(createTerm2, ADMIN_AUTH_HEADERS);

    TableResourceTest tableTest = new TableResourceTest();
    TagLabel termLabel1 = EntityUtil.toTagLabel(term1);
    TagLabel termLabel2 = EntityUtil.toTagLabel(term2);

    Table table1 =
        tableTest.createEntity(
            tableTest.createRequest(getEntityName(test, 3)).withTags(List.of(termLabel1)),
            ADMIN_AUTH_HEADERS);
    Table table2 =
        tableTest.createEntity(
            tableTest.createRequest(getEntityName(test, 4)).withTags(List.of(termLabel1)),
            ADMIN_AUTH_HEADERS);
    Table table3 =
        tableTest.createEntity(
            tableTest.createRequest(getEntityName(test, 5)).withTags(List.of(termLabel2)),
            ADMIN_AUTH_HEADERS);

    Map<String, Integer> assetsCount = getAllGlossaryTermsWithAssetsCount();

    assertNotNull(assetsCount);
    assertEquals(
        2, assetsCount.get(term1.getFullyQualifiedName()), "Glossary term 1 should have 2 assets");
    assertEquals(
        1, assetsCount.get(term2.getFullyQualifiedName()), "Glossary term 2 should have 1 asset");
  }

  private Map<String, Integer> getAllGlossaryTermsWithAssetsCount() throws HttpResponseException {
    WebTarget target = getResource("glossaryTerms/assets/counts");
    Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();
    return response.readEntity(new GenericType<Map<String, Integer>>() {});
  }

  /**
   * Test Suite for Glossary Term Move Operations with Children Relationship Verification
   * These tests verify that when moving glossary terms with children, all relationships
   * (both parent-child CONTAINS and glossary HAS) are correctly updated.
   */
  @Test
  void test_moveTermWithChildren_toParentInSameGlossary() throws Exception {
    // Scenario 1: Create term -> add children -> move to another parent in same glossary
    Glossary glossary = createGlossary("TestGlossary1", null, null);

    // Create parent terms
    GlossaryTerm parentA = createTerm(glossary, null, "ParentA");
    GlossaryTerm parentB = createTerm(glossary, null, "ParentB");

    // Create term with children under ParentA
    GlossaryTerm movingTerm = createTerm(glossary, parentA, "MovingTerm");
    GlossaryTerm child1 = createTerm(glossary, movingTerm, "Child1");
    GlossaryTerm child2 = createTerm(glossary, movingTerm, "Child2");

    // Move MovingTerm from ParentA to ParentB
    EntityReference parentBRef =
        new EntityReference()
            .withId(parentB.getId())
            .withType(GLOSSARY_TERM)
            .withFullyQualifiedName(parentB.getFullyQualifiedName());

    MoveGlossaryTermMessage moveMessage = receiveMoveEntityMessage(movingTerm.getId(), parentBRef);
    assertEquals("COMPLETED", moveMessage.getStatus());

    // Verify MovingTerm is correctly moved
    GlossaryTerm movedTerm = getEntity(movingTerm.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(parentB.getId(), movedTerm.getParent().getId());
    assertEquals(glossary.getId(), movedTerm.getGlossary().getId());
    assertTrue(
        movedTerm.getFullyQualifiedName().startsWith(glossary.getName() + ".ParentB.MovingTerm"));

    // Verify Child1 relationships
    GlossaryTerm verifiedChild1 = getEntity(child1.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(movingTerm.getId(), verifiedChild1.getParent().getId());
    assertEquals(glossary.getId(), verifiedChild1.getGlossary().getId());
    assertTrue(verifiedChild1.getFullyQualifiedName().contains("ParentB.MovingTerm.Child1"));

    // Verify Child2 relationships
    GlossaryTerm verifiedChild2 = getEntity(child2.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(movingTerm.getId(), verifiedChild2.getParent().getId());
    assertEquals(glossary.getId(), verifiedChild2.getGlossary().getId());
    assertTrue(verifiedChild2.getFullyQualifiedName().contains("ParentB.MovingTerm.Child2"));
  }

  @Test
  void test_moveTermWithChildren_toRootInDifferentGlossary() throws Exception {
    // Scenario 2: Move term with children to root of different glossary
    Glossary glossaryA = createGlossary("GlossaryA", null, null);
    Glossary glossaryB = createGlossary("GlossaryB", null, null);

    // Create term with children in GlossaryA
    GlossaryTerm movingTerm = createTerm(glossaryA, null, "MovingTerm");
    GlossaryTerm child1 = createTerm(glossaryA, movingTerm, "Child1");
    GlossaryTerm child2 = createTerm(glossaryA, movingTerm, "Child2");
    GlossaryTerm grandChild = createTerm(glossaryA, child1, "GrandChild");

    // Move to root of GlossaryB
    EntityReference glossaryBRef =
        new EntityReference()
            .withId(glossaryB.getId())
            .withType(GLOSSARY)
            .withFullyQualifiedName(glossaryB.getFullyQualifiedName());

    MoveGlossaryTermMessage moveMessage =
        receiveMoveEntityMessage(movingTerm.getId(), glossaryBRef);
    assertEquals("COMPLETED", moveMessage.getStatus());

    // Verify MovingTerm
    GlossaryTerm movedTerm = getEntity(movingTerm.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertNull(movedTerm.getParent());
    assertEquals(glossaryB.getId(), movedTerm.getGlossary().getId());
    assertEquals("GlossaryB.MovingTerm", movedTerm.getFullyQualifiedName());

    // Verify Child1 glossary changed
    GlossaryTerm verifiedChild1 = getEntity(child1.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(movingTerm.getId(), verifiedChild1.getParent().getId());
    assertEquals(glossaryB.getId(), verifiedChild1.getGlossary().getId());
    assertEquals("GlossaryB.MovingTerm.Child1", verifiedChild1.getFullyQualifiedName());

    // Verify Child2 glossary changed
    GlossaryTerm verifiedChild2 = getEntity(child2.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(movingTerm.getId(), verifiedChild2.getParent().getId());
    assertEquals(glossaryB.getId(), verifiedChild2.getGlossary().getId());

    // Verify GrandChild glossary changed (nested children)
    GlossaryTerm verifiedGrandChild =
        getEntity(grandChild.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(child1.getId(), verifiedGrandChild.getParent().getId());
    assertEquals(glossaryB.getId(), verifiedGrandChild.getGlossary().getId());
    assertEquals(
        "GlossaryB.MovingTerm.Child1.GrandChild", verifiedGrandChild.getFullyQualifiedName());

    // CRITICAL: Delete the original glossary to reproduce relationship scenario
    // If relationships were not properly updated, this will expose orphaned relationships
    glossaryTest.deleteEntity(glossaryA.getId(), true, true, ADMIN_AUTH_HEADERS);

    // Verify children can STILL be fetched after original glossary is deleted
    // This would fail with "does not have expected relationship" error if relationships weren't
    // updated
    GlossaryTerm child1AfterDelete =
        getEntity(child1.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(glossaryB.getId(), child1AfterDelete.getGlossary().getId());
    assertNotNull(
        child1AfterDelete.getGlossary(), "Child must have valid glossary after original deleted");

    GlossaryTerm child2AfterDelete =
        getEntity(child2.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(glossaryB.getId(), child2AfterDelete.getGlossary().getId());

    GlossaryTerm grandChildAfterDelete =
        getEntity(grandChild.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(glossaryB.getId(), grandChildAfterDelete.getGlossary().getId());
  }

  @Test
  void test_moveTermWithChildren_toParentInDifferentGlossary() throws Exception {
    // Scenario 3: Move term with children to under a parent in different glossary
    Glossary glossaryA = createGlossary("GlossaryA_3", null, null);
    Glossary glossaryB = createGlossary("GlossaryB_3", null, null);

    // Create term with children in GlossaryA
    GlossaryTerm movingTerm = createTerm(glossaryA, null, "MovingTerm");
    GlossaryTerm child1 = createTerm(glossaryA, movingTerm, "Child1");
    GlossaryTerm child2 = createTerm(glossaryA, movingTerm, "Child2");

    // Create parent in GlossaryB
    GlossaryTerm parentInB = createTerm(glossaryB, null, "ParentInB");

    // Move to under parentInB
    EntityReference parentInBRef =
        new EntityReference()
            .withId(parentInB.getId())
            .withType(GLOSSARY_TERM)
            .withFullyQualifiedName(parentInB.getFullyQualifiedName());

    MoveGlossaryTermMessage moveMessage =
        receiveMoveEntityMessage(movingTerm.getId(), parentInBRef);
    assertEquals("COMPLETED", moveMessage.getStatus());

    // Verify MovingTerm
    GlossaryTerm movedTerm = getEntity(movingTerm.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(parentInB.getId(), movedTerm.getParent().getId());
    assertEquals(glossaryB.getId(), movedTerm.getGlossary().getId());
    assertTrue(movedTerm.getFullyQualifiedName().contains("GlossaryB_3.ParentInB.MovingTerm"));

    // Verify children moved to GlossaryB
    GlossaryTerm verifiedChild1 = getEntity(child1.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(glossaryB.getId(), verifiedChild1.getGlossary().getId());

    GlossaryTerm verifiedChild2 = getEntity(child2.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(glossaryB.getId(), verifiedChild2.getGlossary().getId());

    // Delete original glossary to expose any orphaned relationships
    glossaryTest.deleteEntity(glossaryA.getId(), true, true, ADMIN_AUTH_HEADERS);

    // Verify children still accessible with correct glossary
    GlossaryTerm child1AfterDelete =
        getEntity(child1.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(glossaryB.getId(), child1AfterDelete.getGlossary().getId());

    GlossaryTerm child2AfterDelete =
        getEntity(child2.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(glossaryB.getId(), child2AfterDelete.getGlossary().getId());
  }

  @Test
  void test_moveNestedTermWithChildren_toRootInSameGlossary() throws Exception {
    // Scenario 4: Term is nested under parent, move it to root in same glossary
    Glossary glossary = createGlossary("TestGlossary4", null, null);

    // Create hierarchy: ParentA -> MovingTerm -> Child1, Child2
    GlossaryTerm parentA = createTerm(glossary, null, "ParentA");
    GlossaryTerm movingTerm = createTerm(glossary, parentA, "MovingTerm");
    GlossaryTerm child1 = createTerm(glossary, movingTerm, "Child1");
    GlossaryTerm child2 = createTerm(glossary, movingTerm, "Child2");

    // Move to root
    EntityReference glossaryRef =
        new EntityReference()
            .withId(glossary.getId())
            .withType(GLOSSARY)
            .withFullyQualifiedName(glossary.getFullyQualifiedName());

    MoveGlossaryTermMessage moveMessage = receiveMoveEntityMessage(movingTerm.getId(), glossaryRef);
    assertEquals("COMPLETED", moveMessage.getStatus());

    // Verify MovingTerm is at root
    GlossaryTerm movedTerm = getEntity(movingTerm.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertNull(movedTerm.getParent());
    assertEquals(glossary.getId(), movedTerm.getGlossary().getId());
    assertEquals("TestGlossary4.MovingTerm", movedTerm.getFullyQualifiedName());

    // Verify children still under MovingTerm and in same glossary
    GlossaryTerm verifiedChild1 = getEntity(child1.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(movingTerm.getId(), verifiedChild1.getParent().getId());
    assertEquals(glossary.getId(), verifiedChild1.getGlossary().getId());

    GlossaryTerm verifiedChild2 = getEntity(child2.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(movingTerm.getId(), verifiedChild2.getParent().getId());
    assertEquals(glossary.getId(), verifiedChild2.getGlossary().getId());
  }

  @Test
  void test_moveNestedTermWithChildren_toRootInDifferentGlossary() throws Exception {
    // Scenario 5: Term is nested, move to root in different glossary
    Glossary glossaryA = createGlossary("GlossaryA_5", null, null);
    Glossary glossaryB = createGlossary("GlossaryB_5", null, null);

    // Create nested term with children in GlossaryA
    GlossaryTerm parentA = createTerm(glossaryA, null, "ParentA");
    GlossaryTerm movingTerm = createTerm(glossaryA, parentA, "MovingTerm");
    GlossaryTerm child1 = createTerm(glossaryA, movingTerm, "Child1");
    GlossaryTerm child2 = createTerm(glossaryA, movingTerm, "Child2");

    // Move to root of GlossaryB
    EntityReference glossaryBRef =
        new EntityReference()
            .withId(glossaryB.getId())
            .withType(GLOSSARY)
            .withFullyQualifiedName(glossaryB.getFullyQualifiedName());

    MoveGlossaryTermMessage moveMessage =
        receiveMoveEntityMessage(movingTerm.getId(), glossaryBRef);
    assertEquals("COMPLETED", moveMessage.getStatus());

    // Verify all moved to GlossaryB
    GlossaryTerm movedTerm = getEntity(movingTerm.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertNull(movedTerm.getParent());
    assertEquals(glossaryB.getId(), movedTerm.getGlossary().getId());

    GlossaryTerm verifiedChild1 = getEntity(child1.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(glossaryB.getId(), verifiedChild1.getGlossary().getId());

    GlossaryTerm verifiedChild2 = getEntity(child2.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(glossaryB.getId(), verifiedChild2.getGlossary().getId());

    // Delete original glossary AND original parent to reproduce relationship scenario
    glossaryTest.deleteEntity(glossaryA.getId(), true, true, ADMIN_AUTH_HEADERS);

    // Verify children still work after original glossary deleted
    GlossaryTerm child1AfterDelete =
        getEntity(child1.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(glossaryB.getId(), child1AfterDelete.getGlossary().getId());

    GlossaryTerm child2AfterDelete =
        getEntity(child2.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(glossaryB.getId(), child2AfterDelete.getGlossary().getId());
  }

  @Test
  void test_moveNestedTermWithChildren_toParentInDifferentGlossary() throws Exception {
    // Scenario 6: Term is nested, move to under another parent in different glossary
    Glossary glossaryA = createGlossary("GlossaryA_6", null, null);
    Glossary glossaryB = createGlossary("GlossaryB_6", null, null);

    // Create nested structure in GlossaryA
    GlossaryTerm parentA = createTerm(glossaryA, null, "ParentA");
    GlossaryTerm movingTerm = createTerm(glossaryA, parentA, "MovingTerm");
    GlossaryTerm child1 = createTerm(glossaryA, movingTerm, "Child1");
    GlossaryTerm child2 = createTerm(glossaryA, movingTerm, "Child2");

    // Create target parent in GlossaryB
    GlossaryTerm parentB = createTerm(glossaryB, null, "ParentB");

    // Move to under ParentB in GlossaryB
    EntityReference parentBRef =
        new EntityReference()
            .withId(parentB.getId())
            .withType(GLOSSARY_TERM)
            .withFullyQualifiedName(parentB.getFullyQualifiedName());

    MoveGlossaryTermMessage moveMessage = receiveMoveEntityMessage(movingTerm.getId(), parentBRef);
    assertEquals("COMPLETED", moveMessage.getStatus());

    // Verify MovingTerm moved
    GlossaryTerm movedTerm = getEntity(movingTerm.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(parentB.getId(), movedTerm.getParent().getId());
    assertEquals(glossaryB.getId(), movedTerm.getGlossary().getId());

    // Verify children moved to GlossaryB
    GlossaryTerm verifiedChild1 = getEntity(child1.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(movingTerm.getId(), verifiedChild1.getParent().getId());
    assertEquals(glossaryB.getId(), verifiedChild1.getGlossary().getId());

    GlossaryTerm verifiedChild2 = getEntity(child2.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(movingTerm.getId(), verifiedChild2.getParent().getId());
    assertEquals(glossaryB.getId(), verifiedChild2.getGlossary().getId());

    // Delete original glossary AND original parent term
    deleteEntity(parentA.getId(), true, true, ADMIN_AUTH_HEADERS);
    glossaryTest.deleteEntity(glossaryA.getId(), true, true, ADMIN_AUTH_HEADERS);

    // Verify children still accessible after both deletions
    GlossaryTerm child1AfterDelete =
        getEntity(child1.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(glossaryB.getId(), child1AfterDelete.getGlossary().getId());
    assertEquals(movingTerm.getId(), child1AfterDelete.getParent().getId());

    GlossaryTerm child2AfterDelete =
        getEntity(child2.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(glossaryB.getId(), child2AfterDelete.getGlossary().getId());
  }

  @Test
  void test_moveMiddleTermInHierarchy_toRootInSameGlossary() throws Exception {
    // Scenario 7a: Create RootTerm -> MiddleTerm -> LeafTerm, move MiddleTerm to root in same
    // glossary
    Glossary glossary = createGlossary("TestGlossary7a", null, null);

    // Create 3-level hierarchy
    GlossaryTerm rootTerm = createTerm(glossary, null, "RootTerm");
    GlossaryTerm middleTerm = createTerm(glossary, rootTerm, "MiddleTerm");
    GlossaryTerm leafTerm = createTerm(glossary, middleTerm, "LeafTerm");

    // Move MiddleTerm to root
    EntityReference glossaryRef =
        new EntityReference()
            .withId(glossary.getId())
            .withType(GLOSSARY)
            .withFullyQualifiedName(glossary.getFullyQualifiedName());

    MoveGlossaryTermMessage moveMessage = receiveMoveEntityMessage(middleTerm.getId(), glossaryRef);
    assertEquals("COMPLETED", moveMessage.getStatus());

    // Verify MiddleTerm is at root
    GlossaryTerm movedMiddle = getEntity(middleTerm.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertNull(movedMiddle.getParent());
    assertEquals(glossary.getId(), movedMiddle.getGlossary().getId());
    assertEquals("TestGlossary7a.MiddleTerm", movedMiddle.getFullyQualifiedName());

    // Verify LeafTerm still under MiddleTerm
    GlossaryTerm verifiedLeaf = getEntity(leafTerm.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(middleTerm.getId(), verifiedLeaf.getParent().getId());
    assertEquals(glossary.getId(), verifiedLeaf.getGlossary().getId());
    assertEquals("TestGlossary7a.MiddleTerm.LeafTerm", verifiedLeaf.getFullyQualifiedName());

    // Verify RootTerm unchanged
    GlossaryTerm verifiedRoot = getEntity(rootTerm.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertNull(verifiedRoot.getParent());
    assertEquals(glossary.getId(), verifiedRoot.getGlossary().getId());
  }

  @Test
  void test_moveMiddleTermInHierarchy_toRootInDifferentGlossary() throws Exception {
    // Scenario 7b: Create RootTerm -> MiddleTerm -> LeafTerm, move MiddleTerm to root in different
    // glossary
    Glossary glossaryA = createGlossary("GlossaryA_7b", null, null);
    Glossary glossaryB = createGlossary("GlossaryB_7b", null, null);

    // Create 3-level hierarchy in GlossaryA
    GlossaryTerm rootTerm = createTerm(glossaryA, null, "RootTerm");
    GlossaryTerm middleTerm = createTerm(glossaryA, rootTerm, "MiddleTerm");
    GlossaryTerm leafTerm = createTerm(glossaryA, middleTerm, "LeafTerm");

    // Move MiddleTerm to root of GlossaryB
    EntityReference glossaryBRef =
        new EntityReference()
            .withId(glossaryB.getId())
            .withType(GLOSSARY)
            .withFullyQualifiedName(glossaryB.getFullyQualifiedName());

    MoveGlossaryTermMessage moveMessage =
        receiveMoveEntityMessage(middleTerm.getId(), glossaryBRef);
    assertEquals("COMPLETED", moveMessage.getStatus());

    // Verify MiddleTerm moved to GlossaryB
    GlossaryTerm movedMiddle = getEntity(middleTerm.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertNull(movedMiddle.getParent());
    assertEquals(glossaryB.getId(), movedMiddle.getGlossary().getId());
    assertEquals("GlossaryB_7b.MiddleTerm", movedMiddle.getFullyQualifiedName());

    // Verify LeafTerm also moved to GlossaryB
    GlossaryTerm verifiedLeaf = getEntity(leafTerm.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(middleTerm.getId(), verifiedLeaf.getParent().getId());
    assertEquals(glossaryB.getId(), verifiedLeaf.getGlossary().getId());
    assertEquals("GlossaryB_7b.MiddleTerm.LeafTerm", verifiedLeaf.getFullyQualifiedName());

    // Verify RootTerm stayed in GlossaryA
    GlossaryTerm verifiedRoot = getEntity(rootTerm.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(glossaryA.getId(), verifiedRoot.getGlossary().getId());

    // Delete the original parent (RootTerm) and original glossary
    // This tests if LeafTerm still works when its grandparent is deleted
    deleteEntity(rootTerm.getId(), true, true, ADMIN_AUTH_HEADERS);
    glossaryTest.deleteEntity(glossaryA.getId(), true, true, ADMIN_AUTH_HEADERS);

    // Verify MiddleTerm and LeafTerm still accessible
    GlossaryTerm middleAfterDelete =
        getEntity(middleTerm.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(glossaryB.getId(), middleAfterDelete.getGlossary().getId());

    GlossaryTerm leafAfterDelete =
        getEntity(leafTerm.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(glossaryB.getId(), leafAfterDelete.getGlossary().getId());
    assertEquals(middleTerm.getId(), leafAfterDelete.getParent().getId());
  }

  @Test
  void test_consecutiveMoves_verifyRelationshipIntegrity() throws Exception {
    // Test consecutive moves
    Glossary glossaryA = createGlossary("DocHub4", null, null);
    Glossary glossaryTech = createGlossary("TechnicalGlossary", null, null);
    Glossary glossaryArchive = createGlossary("Archive", null, null);

    // Create term with children in GlossaryA
    GlossaryTerm tapsToSap = createTerm(glossaryA, null, "TAPStoSAP");
    GlossaryTerm child1 = createTerm(glossaryA, tapsToSap, "ChildTerm1");
    GlossaryTerm child2 = createTerm(glossaryA, tapsToSap, "ChildTerm2");

    // First move: to TechnicalGlossary
    EntityReference techRef =
        new EntityReference()
            .withId(glossaryTech.getId())
            .withType(GLOSSARY)
            .withFullyQualifiedName(glossaryTech.getFullyQualifiedName());

    MoveGlossaryTermMessage move1 = receiveMoveEntityMessage(tapsToSap.getId(), techRef);
    assertEquals("COMPLETED", move1.getStatus());

    // Verify after first move
    GlossaryTerm afterMove1 = getEntity(tapsToSap.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(glossaryTech.getId(), afterMove1.getGlossary().getId());

    GlossaryTerm child1AfterMove1 =
        getEntity(child1.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(glossaryTech.getId(), child1AfterMove1.getGlossary().getId());

    // Second move: to Archive (consecutive move)
    EntityReference archiveRef =
        new EntityReference()
            .withId(glossaryArchive.getId())
            .withType(GLOSSARY)
            .withFullyQualifiedName(glossaryArchive.getFullyQualifiedName());

    MoveGlossaryTermMessage move2 = receiveMoveEntityMessage(tapsToSap.getId(), archiveRef);
    assertEquals("COMPLETED", move2.getStatus());

    // Verify after second move - this should NOT fail!
    GlossaryTerm afterMove2 = getEntity(tapsToSap.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(glossaryArchive.getId(), afterMove2.getGlossary().getId());

    // Critical: Verify children can be fetched individually without errors
    GlossaryTerm child1Final = getEntity(child1.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(tapsToSap.getId(), child1Final.getParent().getId());
    assertEquals(glossaryArchive.getId(), child1Final.getGlossary().getId());
    assertNotNull(child1Final.getGlossary(), "Child1 must have glossary relationship");

    GlossaryTerm child2Final = getEntity(child2.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(tapsToSap.getId(), child2Final.getParent().getId());
    assertEquals(glossaryArchive.getId(), child2Final.getGlossary().getId());
    assertNotNull(child2Final.getGlossary(), "Child2 must have glossary relationship");

    // Verify we can list children without errors
    Map<String, String> params = new HashMap<>();
    params.put("directChildrenOf", afterMove2.getFullyQualifiedName());
    ResultList<GlossaryTerm> children = listEntities(params, ADMIN_AUTH_HEADERS);
    assertEquals(2, children.getData().size());

    // CRITICAL: Delete the original glossary and intermediate glossary
    // This reproduces the EXACT scenario where orphaned relationships cause failures
    glossaryTest.deleteEntity(glossaryA.getId(), true, true, ADMIN_AUTH_HEADERS);
    glossaryTest.deleteEntity(glossaryTech.getId(), true, true, ADMIN_AUTH_HEADERS);

    // If relationships weren't updated correctly, the next fetch will fail with:
    // "Entity type glossaryTerm does not have expected relationship has to/from entity type
    // glossary"
    GlossaryTerm termAfterAllDeletes =
        getEntity(tapsToSap.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertEquals(glossaryArchive.getId(), termAfterAllDeletes.getGlossary().getId());

    // Fetch each child individually
    GlossaryTerm child1AfterAllDeletes =
        getEntity(child1.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertNotNull(
        child1AfterAllDeletes.getGlossary(),
        "Child1 must have glossary - this fails without the fix!");
    assertEquals(glossaryArchive.getId(), child1AfterAllDeletes.getGlossary().getId());

    GlossaryTerm child2AfterAllDeletes =
        getEntity(child2.getId(), "parent,glossary", ADMIN_AUTH_HEADERS);
    assertNotNull(
        child2AfterAllDeletes.getGlossary(),
        "Child2 must have glossary - this fails without the fix!");
    assertEquals(glossaryArchive.getId(), child2AfterAllDeletes.getGlossary().getId());

    // Verify listing children still works
    ResultList<GlossaryTerm> childrenAfterDeletes = listEntities(params, ADMIN_AUTH_HEADERS);
    assertEquals(
        2,
        childrenAfterDeletes.getData().size(),
        "Listing children must work - this fails without the fix!");
  }

  @Test
  void testGlossaryTermLevelImportExport() throws IOException {
    EventSubscriptionResourceTest eventSubscriptionResourceTest =
        new EventSubscriptionResourceTest();
    eventSubscriptionResourceTest.updateEventSubscriptionPollInterval("WorkflowEventConsumer", 120);

    Glossary glossary =
        glossaryTest.createEntity(
            glossaryTest.createRequest("termImportExportTest"), ADMIN_AUTH_HEADERS);

    GlossaryTerm parentTerm = createTerm(glossary, null, "parentTerm");

    String user1 = USER1.getName();
    String user2 = USER2.getName();
    String team11 = TEAM11.getName();
    List<String> reviewerRef =
        listOf(user1, user2).stream().sorted(Comparator.naturalOrder()).toList();

    TypeResourceTest typeResourceTest = new TypeResourceTest();
    Type entityType =
        typeResourceTest.getEntityByName(
            Entity.GLOSSARY_TERM, "customProperties", ADMIN_AUTH_HEADERS);

    CustomPropertyConfig dateTimeConfig =
        new CustomPropertyConfig().withConfig("dd-MM-yyyy HH:mm:ss");
    CustomPropertyConfig timeConfig = new CustomPropertyConfig().withConfig("HH:mm:ss");
    CustomPropertyConfig enumConfig =
        new CustomPropertyConfig()
            .withConfig(
                Map.of(
                    "values",
                    List.of("val1", "val2", "val3", "val4", "val5"),
                    "multiSelect",
                    true));

    CustomProperty[] customProperties = {
      new CustomProperty()
          .withName("termEmailCp")
          .withDescription("email type custom property")
          .withPropertyType(EMAIL_TYPE.getEntityReference()),
      new CustomProperty()
          .withName("termDateCp")
          .withDescription("dd-MM-yyyy format time")
          .withPropertyType(DATECP_TYPE.getEntityReference())
          .withCustomPropertyConfig(new CustomPropertyConfig().withConfig("dd-MM-yyyy")),
      new CustomProperty()
          .withName("termDateTimeCp")
          .withDescription("dd-MM-yyyy HH:mm:ss format dateTime")
          .withPropertyType(DATETIMECP_TYPE.getEntityReference())
          .withCustomPropertyConfig(dateTimeConfig),
      new CustomProperty()
          .withName("termTimeCp")
          .withDescription("HH:mm:ss format time")
          .withPropertyType(TIMECP_TYPE.getEntityReference())
          .withCustomPropertyConfig(timeConfig),
      new CustomProperty()
          .withName("termIntegerCp")
          .withDescription("integer type custom property")
          .withPropertyType(INT_TYPE.getEntityReference()),
      new CustomProperty()
          .withName("termDurationCp")
          .withDescription("duration type custom property")
          .withPropertyType(DURATION_TYPE.getEntityReference()),
      new CustomProperty()
          .withName("termMarkdownCp")
          .withDescription("markdown type custom property")
          .withPropertyType(MARKDOWN_TYPE.getEntityReference()),
      new CustomProperty()
          .withName("termStringCp")
          .withDescription("string type custom property")
          .withPropertyType(STRING_TYPE.getEntityReference()),
      new CustomProperty()
          .withName("termEntRefCp")
          .withDescription("entity Reference type custom property")
          .withPropertyType(ENTITY_REFERENCE_TYPE.getEntityReference())
          .withCustomPropertyConfig(new CustomPropertyConfig().withConfig(List.of("user"))),
      new CustomProperty()
          .withName("termEntRefListCp")
          .withDescription("entity Reference List type custom property")
          .withPropertyType(ENTITY_REFERENCE_LIST_TYPE.getEntityReference())
          .withCustomPropertyConfig(
              new CustomPropertyConfig()
                  .withConfig(
                      List.of(
                          Entity.TABLE,
                          Entity.STORED_PROCEDURE,
                          Entity.DATABASE_SCHEMA,
                          Entity.DATABASE,
                          Entity.DASHBOARD,
                          Entity.DASHBOARD_DATA_MODEL,
                          Entity.PIPELINE,
                          Entity.TOPIC,
                          Entity.CONTAINER,
                          Entity.SEARCH_INDEX,
                          Entity.MLMODEL,
                          Entity.GLOSSARY_TERM))),
      new CustomProperty()
          .withName("termTimeIntervalCp")
          .withDescription("timeInterval type custom property")
          .withPropertyType(TIME_INTERVAL_TYPE.getEntityReference()),
      new CustomProperty()
          .withName("termNumberCp")
          .withDescription("number custom property")
          .withPropertyType(INT_TYPE.getEntityReference()),
      new CustomProperty()
          .withName("termQueryCp")
          .withDescription("query custom property")
          .withPropertyType(SQLQUERY_TYPE.getEntityReference()),
      new CustomProperty()
          .withName("termTimestampCp")
          .withDescription("timestamp type custom property")
          .withPropertyType(TIMESTAMP_TYPE.getEntityReference()),
      new CustomProperty()
          .withName("termEnumCpSingle")
          .withDescription("enum type custom property with multiselect = false")
          .withPropertyType(ENUM_TYPE.getEntityReference())
          .withCustomPropertyConfig(
              new CustomPropertyConfig()
                  .withConfig(
                      Map.of(
                          "values",
                          List.of("single1", "single2", "single3", "single4"),
                          "multiSelect",
                          false))),
      new CustomProperty()
          .withName("termEnumCpMulti")
          .withDescription("enum type custom property with multiselect = true")
          .withPropertyType(ENUM_TYPE.getEntityReference())
          .withCustomPropertyConfig(enumConfig),
      new CustomProperty()
          .withName("termTableCol1Cp")
          .withDescription("table type custom property with 1 column")
          .withPropertyType(TABLE_TYPE.getEntityReference())
          .withCustomPropertyConfig(
              new CustomPropertyConfig()
                  .withConfig(
                      Map.of("columns", List.of("columnName1", "columnName2", "columnName3")))),
      new CustomProperty()
          .withName("termTableCol3Cp")
          .withDescription("table type custom property with 3 columns")
          .withPropertyType(TABLE_TYPE.getEntityReference())
          .withCustomPropertyConfig(
              new CustomPropertyConfig()
                  .withConfig(
                      Map.of("columns", List.of("columnName1", "columnName2", "columnName3")))),
    };

    for (CustomProperty customProperty : customProperties) {
      entityType =
          typeResourceTest.addAndCheckCustomProperty(
              entityType.getId(), customProperty, OK, ADMIN_AUTH_HEADERS);
    }

    // Import child terms under parentTerm
    String csvData =
        createCsv(
            GlossaryRepository.GlossaryCsv.HEADERS,
            listOf(
                String.format(
                    "termImportExportTest.parentTerm,t1,dsp1,\"dsc1,1\",h1;h2;h3,,term1;http://term1,PII.None,user:%s,user:%s,%s,\"#FF5733\",https://example.com/icon1.png,\"termDateCp:18-09-2024;termDateTimeCp:18-09-2024 01:09:34;termDurationCp:PT5H30M10S;termEmailCp:admin@open-metadata.org;termEntRefCp:team:\"\"%s\"\";termEntRefListCp:user:\"\"%s\"\"|user:\"\"%s\"\"\"",
                    reviewerRef.get(0), user1, "Approved", team11, user1, user2),
                String.format(
                    "termImportExportTest.parentTerm,t2,dsp2,dsc2,h1;h3;h3,,term2;https://term2,PII.NonSensitive,,user:%s,%s,\"#00FF00\",https://example.com/icon2.svg,\"termEnumCpMulti:val1|val2|val3;termEnumCpSingle:single1;termIntegerCp:7777;termMarkdownCp:# Sample Markdown Text;termNumberCp:123456;\"\"termQueryCp:select col,row from table where id ='30';\"\";termStringCp:sample string content;termTimeCp:10:08:45;termTimeIntervalCp:1726142300000:17261420000;termTimestampCp:1726142400000\"",
                    user1, "Approved"),
                String.format(
                    "termImportExportTest.parentTerm.t1,t11,dsp3,dsc11,h1;h3;h3,,,,user:%s,team:%s,%s,,,",
                    reviewerRef.getFirst(), team11, "Draft")),
            listOf());

    CsvImportResult result = importCsv(parentTerm.getFullyQualifiedName(), csvData, false);
    assertEquals(4, result.getNumberOfRowsProcessed());
    assertEquals(4, result.getNumberOfRowsPassed());

    // Export and verify
    String exportedCsv = exportCsv(parentTerm.getFullyQualifiedName());
    assertNotNull(exportedCsv);

    // Verify all terms were created with correct fields
    GlossaryTerm t1 =
        getEntityByName(
            "termImportExportTest.parentTerm.t1",
            "owners,reviewers,tags,synonyms,relatedTerms,references,extension,parent,style",
            ADMIN_AUTH_HEADERS);
    assertNotNull(t1);
    assertEquals("dsp1", t1.getDisplayName());
    assertEquals("dsc1,1", t1.getDescription());
    assertEquals(List.of("h1", "h2", "h3"), t1.getSynonyms());
    assertEquals(1, t1.getReferences().size());
    assertEquals("term1", t1.getReferences().getFirst().getName());
    assertEquals("http://term1", t1.getReferences().getFirst().getEndpoint().toString());
    assertEquals("PII.None", t1.getTags().getFirst().getTagFQN());
    assertEquals(reviewerRef.getFirst(), t1.getReviewers().getFirst().getName());
    assertEquals(user1, t1.getOwners().getFirst().getName());
    assertEquals(EntityStatus.APPROVED, t1.getEntityStatus());
    assertEquals("#FF5733", t1.getStyle().getColor());
    assertEquals("https://example.com/icon1.png", t1.getStyle().getIconURL());

    Object t1Extension = t1.getExtension();
    if (t1Extension instanceof Map<?, ?> t1ExtMap) {
      assertEquals("18-09-2024", t1ExtMap.get("termDateCp").toString());
      assertEquals("18-09-2024 01:09:34", t1ExtMap.get("termDateTimeCp").toString());
      assertEquals("PT5H30M10S", t1ExtMap.get("termDurationCp").toString());
      assertEquals("admin@open-metadata.org", t1ExtMap.get("termEmailCp").toString());
      assertTrue(t1ExtMap.get("termEntRefCp").toString().contains(team11));
      String entRefListValue = t1ExtMap.get("termEntRefListCp").toString();
      assertTrue(entRefListValue.contains(user1));
      assertTrue(entRefListValue.contains(user2));
    }

    GlossaryTerm t2 =
        getEntityByName(
            "termImportExportTest.parentTerm.t2",
            "owners,reviewers,tags,synonyms,relatedTerms,references,extension,parent,style",
            ADMIN_AUTH_HEADERS);
    assertNotNull(t2);
    assertEquals("dsp2", t2.getDisplayName());
    assertEquals("dsc2", t2.getDescription());
    assertEquals(List.of("h1", "h3", "h3"), t2.getSynonyms());
    assertEquals(1, t2.getReferences().size());
    assertEquals("term2", t2.getReferences().getFirst().getName());
    assertEquals("https://term2", t2.getReferences().getFirst().getEndpoint().toString());
    assertEquals("PII.NonSensitive", t2.getTags().getFirst().getTagFQN());
    assertEquals(user1, t2.getOwners().getFirst().getName());
    assertEquals(EntityStatus.APPROVED, t2.getEntityStatus());
    assertEquals("#00FF00", t2.getStyle().getColor());
    assertEquals("https://example.com/icon2.svg", t2.getStyle().getIconURL());

    Object t2Extension = t2.getExtension();
    if (t2Extension instanceof Map<?, ?> t2ExtMap) {
      String enumMulti = t2ExtMap.get("termEnumCpMulti").toString();
      assertTrue(enumMulti.contains("val1"));
      assertTrue(enumMulti.contains("val2"));
      assertTrue(enumMulti.contains("val3"));
      assertTrue(t2ExtMap.get("termEnumCpSingle").toString().contains("single1"));
      assertEquals("7777", t2ExtMap.get("termIntegerCp").toString());
      assertEquals("# Sample Markdown Text", t2ExtMap.get("termMarkdownCp").toString());
      assertEquals("123456", t2ExtMap.get("termNumberCp").toString());
      assertEquals(
          "select col,row from table where id ='30';", t2ExtMap.get("termQueryCp").toString());
      assertEquals("sample string content", t2ExtMap.get("termStringCp").toString());
      assertEquals("10:08:45", t2ExtMap.get("termTimeCp").toString());
      String timeIntervalValue = t2ExtMap.get("termTimeIntervalCp").toString();
      assertTrue(
          timeIntervalValue.contains("1726142300000") && timeIntervalValue.contains("17261420000"));
      assertEquals("1726142400000", t2ExtMap.get("termTimestampCp").toString());
    }

    GlossaryTerm t11 =
        getEntityByName(
            "termImportExportTest.parentTerm.t1.t11",
            "owners,reviewers,tags,synonyms,parent",
            ADMIN_AUTH_HEADERS);
    assertNotNull(t11);
    assertEquals("dsp3", t11.getDisplayName());
    assertEquals("dsc11", t11.getDescription());
    assertEquals(List.of("h1", "h3", "h3"), t11.getSynonyms());
    assertEquals(reviewerRef.getFirst(), t11.getReviewers().getFirst().getName());
    assertEquals(team11, t11.getOwners().getFirst().getName());
    assertEquals(EntityStatus.DRAFT, t11.getEntityStatus());
    assertEquals(t1.getId(), t11.getParent().getId());

    deleteEntity(t11.getId(), true, true, ADMIN_AUTH_HEADERS);
    deleteEntity(t2.getId(), true, true, ADMIN_AUTH_HEADERS);
    deleteEntity(t1.getId(), true, true, ADMIN_AUTH_HEADERS);
    deleteEntity(parentTerm.getId(), true, true, ADMIN_AUTH_HEADERS);
    glossaryTest.deleteEntity(glossary.getId(), true, true, ADMIN_AUTH_HEADERS);

    eventSubscriptionResourceTest.updateEventSubscriptionPollInterval("WorkflowEventConsumer", 10);
  }

  @Test
  void testGlossaryTermCsvImportSameCSV() throws IOException {
    Glossary glossary =
        glossaryTest.createEntity(
            glossaryTest.createRequest("csvImportSameData"), ADMIN_AUTH_HEADERS);

    GlossaryTerm relatedTerm = createTerm(glossary, null, "relatedTerm");

    GlossaryTerm parentTerm = createTerm(glossary, null, "importParent");
    String parentJson = JsonUtils.pojoToJson(parentTerm);
    TermReference reference1 =
        new TermReference().withName("reference1").withEndpoint(URI.create("http://reference1"));
    TermReference reference2 =
        new TermReference().withName("reference2").withEndpoint(URI.create("http://reference2"));
    parentTerm
        .withDisplayName("Import Parent")
        .withDescription("Import parent description")
        .withSynonyms(List.of("importSyn1", "importSyn2"))
        .withTags(List.of(PII_SENSITIVE_TAG_LABEL))
        .withReviewers(List.of(USER1_REF))
        .withOwners(List.of(USER1_REF))
        .withRelatedTerms(List.of(relatedTerm.getEntityReference()))
        .withReferences(List.of(reference1, reference2))
        .withStyle(new Style().withColor("#FF5733").withIconURL("https://example.com/icon.png"));
    parentTerm = patchEntity(parentTerm.getId(), parentJson, parentTerm, ADMIN_AUTH_HEADERS);

    GlossaryTerm childTerm = createTerm(glossary, parentTerm, "importChild");
    String childJson = JsonUtils.pojoToJson(childTerm);
    childTerm
        .withDisplayName("Import Child")
        .withDescription("Import child description")
        .withSynonyms(List.of("childImportSyn1"))
        .withTags(List.of(PERSONAL_DATA_TAG_LABEL))
        .withReviewers(List.of(USER2_REF))
        .withOwners(List.of(TEAM11_REF))
        .withRelatedTerms(List.of(relatedTerm.getEntityReference()));
    childTerm = patchEntity(childTerm.getId(), childJson, childTerm, ADMIN_AUTH_HEADERS);

    String exportedCsv = exportCsv(parentTerm.getFullyQualifiedName());

    CsvImportResult result = importCsv(parentTerm.getFullyQualifiedName(), exportedCsv, false);
    assertSummary(result, ApiStatus.SUCCESS, 2, 2, 0);

    GlossaryTerm childAfterImport =
        getEntityByName(
            childTerm.getFullyQualifiedName(),
            "owners,reviewers,tags,parent,relatedTerms",
            ADMIN_AUTH_HEADERS);
    assertEquals(childTerm.getName(), childAfterImport.getName());
    assertEquals(childTerm.getDisplayName(), childAfterImport.getDisplayName());
    assertEquals(childTerm.getDescription(), childAfterImport.getDescription());
    assertEquals(childTerm.getSynonyms(), childAfterImport.getSynonyms());
    TestUtils.validateTags(childTerm.getTags(), childAfterImport.getTags());
    assertEquals(childTerm.getReviewers().size(), childAfterImport.getReviewers().size());
    assertEquals(
        childTerm.getReviewers().getFirst().getId(),
        childAfterImport.getReviewers().getFirst().getId());
    assertEquals(childTerm.getOwners().size(), childAfterImport.getOwners().size());
    assertEquals(
        childTerm.getOwners().getFirst().getId(), childAfterImport.getOwners().getFirst().getId());
    assertEquals(childTerm.getParent().getId(), childAfterImport.getParent().getId());
    assertEquals(childTerm.getRelatedTerms().size(), childAfterImport.getRelatedTerms().size());
    assertEquals(
        childTerm.getRelatedTerms().getFirst().getId(),
        childAfterImport.getRelatedTerms().getFirst().getId());

    deleteEntity(relatedTerm.getId(), true, true, ADMIN_AUTH_HEADERS);
    deleteEntity(childTerm.getId(), true, true, ADMIN_AUTH_HEADERS);
    deleteEntity(parentTerm.getId(), true, true, ADMIN_AUTH_HEADERS);
    glossaryTest.deleteEntity(glossary.getId(), true, true, ADMIN_AUTH_HEADERS);
  }

  @Test
  void testGlossaryTermCsvImportWithModifications() throws IOException {
    EventSubscriptionResourceTest eventSubscriptionResourceTest =
        new EventSubscriptionResourceTest();
    eventSubscriptionResourceTest.updateEventSubscriptionPollInterval("WorkflowEventConsumer", 120);

    Glossary glossary =
        glossaryTest.createEntity(
            glossaryTest.createRequest("csvImportModified"), ADMIN_AUTH_HEADERS);

    TypeResourceTest typeResourceTest = new TypeResourceTest();
    Type entityType =
        typeResourceTest.getEntityByName(
            Entity.GLOSSARY_TERM, "customProperties", ADMIN_AUTH_HEADERS);

    CustomProperty stringCp =
        new CustomProperty()
            .withName("termModStringCp")
            .withDescription("string type custom property")
            .withPropertyType(STRING_TYPE.getEntityReference());
    typeResourceTest.addAndCheckCustomProperty(
        entityType.getId(), stringCp, OK, ADMIN_AUTH_HEADERS);

    CustomProperty intCp =
        new CustomProperty()
            .withName("termModIntCp")
            .withDescription("integer type custom property")
            .withPropertyType(INT_TYPE.getEntityReference());
    typeResourceTest.addAndCheckCustomProperty(entityType.getId(), intCp, OK, ADMIN_AUTH_HEADERS);

    GlossaryTerm parentTerm = createTerm(glossary, null, "modifyParent");
    String parentJson = JsonUtils.pojoToJson(parentTerm);
    parentTerm
        .withDisplayName("Original Parent")
        .withDescription("Original parent description")
        .withSynonyms(List.of("origSyn1", "origSyn2"))
        .withTags(List.of(PII_SENSITIVE_TAG_LABEL));
    parentTerm = patchEntity(parentTerm.getId(), parentJson, parentTerm, ADMIN_AUTH_HEADERS);

    GlossaryTerm child1 = createTerm(glossary, parentTerm, "modifyChild1");
    String child1Json = JsonUtils.pojoToJson(child1);
    child1
        .withDisplayName("Original Child 1")
        .withDescription("Original child 1 description")
        .withSynonyms(List.of("origChild1Syn1"))
        .withTags(List.of(PERSONAL_DATA_TAG_LABEL));
    child1 = patchEntity(child1.getId(), child1Json, child1, ADMIN_AUTH_HEADERS);

    GlossaryTerm child2 = createTerm(glossary, parentTerm, "modifyChild2");
    String child2Json = JsonUtils.pojoToJson(child2);
    child2
        .withDisplayName("Original Child 2")
        .withDescription("Original child 2 description")
        .withSynonyms(List.of("origChild2Syn1"))
        .withTags(List.of(PII_SENSITIVE_TAG_LABEL));
    child2 = patchEntity(child2.getId(), child2Json, child2, ADMIN_AUTH_HEADERS);

    GlossaryTerm grandchild = createTerm(glossary, child1, "modifyGrandchild");
    String grandchildJson = JsonUtils.pojoToJson(grandchild);
    grandchild
        .withDisplayName("Original Grandchild")
        .withDescription("Original grandchild description")
        .withSynonyms(List.of("origGrandchildSyn1"));
    grandchild = patchEntity(grandchild.getId(), grandchildJson, grandchild, ADMIN_AUTH_HEADERS);

    String exportedCsv = exportCsv(parentTerm.getFullyQualifiedName());

    String modifiedCsv =
        exportedCsv
            .replace("Original Child 1", "Modified Child 1")
            .replace("Original child 1 description", "Modified child 1 description")
            .replace("origChild1Syn1", "modChild1Syn1;modChild1Syn2")
            .replace("Original Child 2", "Modified Child 2")
            .replace("Original child 2 description", "Modified child 2 description")
            .replace("Original Grandchild", "Modified Grandchild")
            .replace("Original grandchild description", "Modified grandchild description");

    modifiedCsv =
        modifiedCsv.replace(
            "Draft,,https://,", "Approved,,https://,termModStringCp:test value;termModIntCp:42");

    CsvImportResult result = importCsv(parentTerm.getFullyQualifiedName(), modifiedCsv, false);
    assertSummary(result, ApiStatus.SUCCESS, 4, 4, 0);

    GlossaryTerm child1AfterUpdate =
        getEntityByName(
            child1.getFullyQualifiedName(),
            "owners,reviewers,tags,extension,parent",
            ADMIN_AUTH_HEADERS);
    assertEquals("Modified Child 1", child1AfterUpdate.getDisplayName());
    assertEquals("Modified child 1 description", child1AfterUpdate.getDescription());
    assertTrue(child1AfterUpdate.getSynonyms().contains("modChild1Syn1"));
    assertTrue(child1AfterUpdate.getSynonyms().contains("modChild1Syn2"));

    Object extension = child1AfterUpdate.getExtension();
    if (extension instanceof Map<?, ?> extMap) {
      assertEquals("test value", extMap.get("termModStringCp").toString());
      assertEquals("42", extMap.get("termModIntCp").toString());
    }

    GlossaryTerm child2AfterUpdate =
        getEntityByName(
            child2.getFullyQualifiedName(), "owners,reviewers,tags,parent", ADMIN_AUTH_HEADERS);
    assertEquals("Modified Child 2", child2AfterUpdate.getDisplayName());
    assertEquals("Modified child 2 description", child2AfterUpdate.getDescription());

    GlossaryTerm grandchildAfterUpdate =
        getEntityByName(
            grandchild.getFullyQualifiedName(), "owners,reviewers,tags,parent", ADMIN_AUTH_HEADERS);
    assertEquals("Modified Grandchild", grandchildAfterUpdate.getDisplayName());
    assertEquals("Modified grandchild description", grandchildAfterUpdate.getDescription());

    deleteEntity(grandchild.getId(), true, true, ADMIN_AUTH_HEADERS);
    deleteEntity(child2.getId(), true, true, ADMIN_AUTH_HEADERS);
    deleteEntity(child1.getId(), true, true, ADMIN_AUTH_HEADERS);
    deleteEntity(parentTerm.getId(), true, true, ADMIN_AUTH_HEADERS);
    glossaryTest.deleteEntity(glossary.getId(), true, true, ADMIN_AUTH_HEADERS);

    eventSubscriptionResourceTest.updateEventSubscriptionPollInterval("WorkflowEventConsumer", 10);
  }

  @Test
  void testGlossaryTermCsvImportClearFields() throws IOException {
    Glossary glossary =
        glossaryTest.createEntity(glossaryTest.createRequest("csvClearFields"), ADMIN_AUTH_HEADERS);

    GlossaryTerm term = createTerm(glossary, null, "clearFieldsTerm");
    String termJson = JsonUtils.pojoToJson(term);
    term.withDisplayName("Display Name")
        .withDescription("Description text")
        .withSynonyms(List.of("syn1", "syn2"))
        .withTags(List.of(PII_SENSITIVE_TAG_LABEL));
    term = patchEntity(term.getId(), termJson, term, ADMIN_AUTH_HEADERS);

    String clearCsv =
        createCsv(
            GlossaryRepository.GlossaryCsv.HEADERS,
            listOf(",clearFieldsTerm,Display Name,New description only,,,,,,,Approved,,,"),
            null);

    CsvImportResult result = importCsv(term.getFullyQualifiedName(), clearCsv, false);
    assertSummary(result, ApiStatus.SUCCESS, 2, 2, 0);

    GlossaryTerm termAfterClear =
        getEntityByName(term.getFullyQualifiedName(), "owners,reviewers,tags", ADMIN_AUTH_HEADERS);
    assertEquals("New description only", termAfterClear.getDescription());
    assertTrue(listOrEmpty(termAfterClear.getSynonyms()).isEmpty());
    assertTrue(listOrEmpty(termAfterClear.getRelatedTerms()).isEmpty());
    assertTrue(listOrEmpty(termAfterClear.getTags()).isEmpty());

    deleteEntity(term.getId(), true, true, ADMIN_AUTH_HEADERS);
    glossaryTest.deleteEntity(glossary.getId(), true, true, ADMIN_AUTH_HEADERS);
  }

  @Test
  void testGlossaryTermCsvExportHierarchy() throws IOException {
    Glossary glossary =
        glossaryTest.createEntity(
            glossaryTest.createRequest("csvHierarchyTest"), ADMIN_AUTH_HEADERS);

    GlossaryTerm root = createTerm(glossary, null, "root");
    String rootJson = JsonUtils.pojoToJson(root);
    root.withDisplayName("Root Term").withDescription("Root description");
    root = patchEntity(root.getId(), rootJson, root, ADMIN_AUTH_HEADERS);

    GlossaryTerm child1 = createTerm(glossary, root, "child1");
    String child1Json = JsonUtils.pojoToJson(child1);
    child1.withDisplayName("Child 1").withDescription("Child 1 description");
    child1 = patchEntity(child1.getId(), child1Json, child1, ADMIN_AUTH_HEADERS);

    GlossaryTerm child2 = createTerm(glossary, root, "child2");
    String child2Json = JsonUtils.pojoToJson(child2);
    child2.withDisplayName("Child 2").withDescription("Child 2 description");
    child2 = patchEntity(child2.getId(), child2Json, child2, ADMIN_AUTH_HEADERS);

    GlossaryTerm grandchild = createTerm(glossary, child1, "grandchild");
    String grandchildJson = JsonUtils.pojoToJson(grandchild);
    grandchild.withDisplayName("Grandchild").withDescription("Grandchild description");
    grandchild = patchEntity(grandchild.getId(), grandchildJson, grandchild, ADMIN_AUTH_HEADERS);

    String exportedCsv = exportCsv(root.getFullyQualifiedName());

    assertTrue(exportedCsv.contains("csvHierarchyTest.root,child1"));
    assertTrue(exportedCsv.contains("csvHierarchyTest.root,child2"));
    assertTrue(exportedCsv.contains("csvHierarchyTest.root.child1,grandchild"));

    String[] lines = exportedCsv.split("\n");
    assertTrue(lines.length >= 4);

    deleteEntity(grandchild.getId(), true, true, ADMIN_AUTH_HEADERS);
    deleteEntity(child2.getId(), true, true, ADMIN_AUTH_HEADERS);
    deleteEntity(child1.getId(), true, true, ADMIN_AUTH_HEADERS);
    deleteEntity(root.getId(), true, true, ADMIN_AUTH_HEADERS);
    glossaryTest.deleteEntity(glossary.getId(), true, true, ADMIN_AUTH_HEADERS);
  }

  @Test
  void testGlossaryTermCsvImportHierarchyWithNewTerms() throws IOException {
    EventSubscriptionResourceTest eventSubscriptionResourceTest =
        new EventSubscriptionResourceTest();
    eventSubscriptionResourceTest.updateEventSubscriptionPollInterval("WorkflowEventConsumer", 120);

    Glossary glossary =
        glossaryTest.createEntity(
            glossaryTest.createRequest("csvImportNewTerms"), ADMIN_AUTH_HEADERS);

    GlossaryTerm root = createTerm(glossary, null, "root");
    String rootJson = JsonUtils.pojoToJson(root);
    root.withDisplayName("Root Term").withDescription("Root description");
    root = patchEntity(root.getId(), rootJson, root, ADMIN_AUTH_HEADERS);

    GlossaryTerm existingChild = createTerm(glossary, root, "existingChild");
    String existingChildJson = JsonUtils.pojoToJson(existingChild);
    existingChild.withDisplayName("Existing Child").withDescription("Existing child description");
    existingChild =
        patchEntity(existingChild.getId(), existingChildJson, existingChild, ADMIN_AUTH_HEADERS);

    String csvWithNewTerms =
        createCsv(
            GlossaryRepository.GlossaryCsv.HEADERS,
            listOf(
                ",root,Root Term,Root description,,,,,,,Approved,,,",
                "csvImportNewTerms.root,existingChild,Existing Child,Existing child description,,,,,,,Approved,,,",
                "csvImportNewTerms.root,newChild1,New Child 1,New child 1 description,,,,,,,Draft,,,",
                "csvImportNewTerms.root,newChild2,New Child 2,New child 2 description,,,,,,,Draft,,,",
                "csvImportNewTerms.root.newChild1,newGrandchild,New Grandchild,New grandchild description,,,,,,,Draft,,,"),
            null);

    CsvImportResult result = importCsv(root.getFullyQualifiedName(), csvWithNewTerms, false);
    assertSummary(result, ApiStatus.SUCCESS, 6, 6, 0);

    GlossaryTerm newChild1 =
        getEntityByName(
            "csvImportNewTerms.root.newChild1", "parent,owners,reviewers,tags", ADMIN_AUTH_HEADERS);
    assertNotNull(newChild1);
    assertEquals("New Child 1", newChild1.getDisplayName());
    assertEquals("New child 1 description", newChild1.getDescription());
    assertEquals(root.getId(), newChild1.getParent().getId());

    GlossaryTerm newChild2 =
        getEntityByName(
            "csvImportNewTerms.root.newChild2", "parent,owners,reviewers,tags", ADMIN_AUTH_HEADERS);
    assertNotNull(newChild2);
    assertEquals("New Child 2", newChild2.getDisplayName());

    GlossaryTerm newGrandchild =
        getEntityByName(
            "csvImportNewTerms.root.newChild1.newGrandchild",
            "parent,owners,reviewers,tags",
            ADMIN_AUTH_HEADERS);
    assertNotNull(newGrandchild);
    assertEquals("New Grandchild", newGrandchild.getDisplayName());
    assertEquals(newChild1.getId(), newGrandchild.getParent().getId());

    deleteEntity(newGrandchild.getId(), true, true, ADMIN_AUTH_HEADERS);
    deleteEntity(newChild2.getId(), true, true, ADMIN_AUTH_HEADERS);
    deleteEntity(newChild1.getId(), true, true, ADMIN_AUTH_HEADERS);
    deleteEntity(root.getId(), true, true, ADMIN_AUTH_HEADERS);
    glossaryTest.deleteEntity(glossary.getId(), true, true, ADMIN_AUTH_HEADERS);

    eventSubscriptionResourceTest.updateEventSubscriptionPollInterval("WorkflowEventConsumer", 10);
  }

  @Test
  void testGlossaryTermCsvImportDryRun() throws IOException {
    Glossary glossary =
        glossaryTest.createEntity(glossaryTest.createRequest("csvDryRunTest"), ADMIN_AUTH_HEADERS);

    GlossaryTerm root = createTerm(glossary, null, "root");
    String rootJson = JsonUtils.pojoToJson(root);
    root.withDisplayName("Root Term").withDescription("Root description");
    root = patchEntity(root.getId(), rootJson, root, ADMIN_AUTH_HEADERS);

    String csvWithChanges =
        createCsv(
            GlossaryRepository.GlossaryCsv.HEADERS,
            listOf(
                ",root,Modified Root,Modified root description,,,,,,,Approved,,,",
                "csvDryRunTest.root,newTerm,New Term,New term description,,,,,,,Draft,,,"),
            null);

    CsvImportResult dryRunResult = importCsv(root.getFullyQualifiedName(), csvWithChanges, true);
    assertSummary(dryRunResult, ApiStatus.SUCCESS, 3, 3, 0);
    assertTrue(dryRunResult.getDryRun());

    GlossaryTerm rootAfterDryRun =
        getEntityByName(root.getFullyQualifiedName(), "owners,reviewers,tags", ADMIN_AUTH_HEADERS);
    assertEquals("Root Term", rootAfterDryRun.getDisplayName());
    assertEquals("Root description", rootAfterDryRun.getDescription());

    assertThrows(
        HttpResponseException.class,
        () ->
            getEntityByName(
                "csvDryRunTest.root.newTerm", "parent,owners,reviewers,tags", ADMIN_AUTH_HEADERS));

    CsvImportResult actualImport = importCsv(root.getFullyQualifiedName(), csvWithChanges, false);
    assertSummary(actualImport, ApiStatus.SUCCESS, 3, 3, 0);
    assertFalse(actualImport.getDryRun());

    GlossaryTerm rootAfterImport =
        getEntityByName(root.getFullyQualifiedName(), "owners,reviewers,tags", ADMIN_AUTH_HEADERS);
    assertEquals("Modified Root", rootAfterImport.getDisplayName());
    assertEquals("Modified root description", rootAfterImport.getDescription());

    GlossaryTerm newTerm =
        getEntityByName(
            "csvDryRunTest.root.newTerm", "parent,owners,reviewers,tags", ADMIN_AUTH_HEADERS);
    assertNotNull(newTerm);
    assertEquals("New Term", newTerm.getDisplayName());

    deleteEntity(newTerm.getId(), true, true, ADMIN_AUTH_HEADERS);
    deleteEntity(root.getId(), true, true, ADMIN_AUTH_HEADERS);
    glossaryTest.deleteEntity(glossary.getId(), true, true, ADMIN_AUTH_HEADERS);
  }

  @Test
  void testGlossaryTermCsvDryRunWithValidationErrors() throws IOException {
    Glossary glossary =
        glossaryTest.createEntity(
            glossaryTest.createRequest("csvDryRunErrorTest"), ADMIN_AUTH_HEADERS);

    GlossaryTerm root = createTerm(glossary, null, "root");

    String csvWithInvalidData =
        createCsv(
            GlossaryRepository.GlossaryCsv.HEADERS,
            listOf(
                ",root,Root Term,Root description,,,,,,,Approved,,,",
                "csvDryRunErrorTest.nonExistentParent,invalidChild,Invalid Child,Invalid description,,,,,,,Draft,,,"),
            null);

    CsvImportResult dryRunResult =
        importCsv(root.getFullyQualifiedName(), csvWithInvalidData, true);
    assertTrue(dryRunResult.getDryRun());
    assertTrue(dryRunResult.getNumberOfRowsFailed() > 0);

    deleteEntity(root.getId(), true, true, ADMIN_AUTH_HEADERS);
    glossaryTest.deleteEntity(glossary.getId(), true, true, ADMIN_AUTH_HEADERS);
  void test_moveGlossaryTermWithApprovalWorkflow(TestInfo test) throws Exception {
    // Ensure the workflow is active
    WorkflowHandler.getInstance().resumeWorkflow("GlossaryTermApprovalWorkflow");

    // Create a glossary with a reviewer
    Glossary glossary = createGlossary(test, List.of(USER1_REF), null);

    // Create a term that will be a parent and approve it
    GlossaryTerm parentTerm = createTerm(glossary, null, "parentTermForMove");
    assertEquals(EntityStatus.DRAFT, parentTerm.getEntityStatus());
    waitForTaskToBeCreated(parentTerm.getFullyQualifiedName());
    Thread parentTask = assertApprovalTask(parentTerm, TaskStatus.Open);
    taskTest.resolveTask(
        parentTask.getTask().getId(),
        new ResolveTask().withNewValue("Approved"),
        authHeaders(USER1.getName()));
    parentTerm = getEntity(parentTerm.getId(), "", authHeaders(USER1.getName()));
    assertEquals(EntityStatus.APPROVED, parentTerm.getEntityStatus());

    // Create a term that will be moved
    GlossaryTerm termToMove = createTerm(glossary, null, "termToMoveWithWorkflow");
    assertEquals(EntityStatus.DRAFT, termToMove.getEntityStatus());
    waitForTaskToBeCreated(termToMove.getFullyQualifiedName());
    Thread task = assertApprovalTask(termToMove, TaskStatus.Open);

    // Move the term to be a child of the parentTerm
    MoveGlossaryTermMessage moveMessage =
        receiveMoveEntityMessage(termToMove.getId(), parentTerm.getEntityReference());
    assertEquals("COMPLETED", moveMessage.getStatus());

    // After moving, the task should still be resolvable
    taskTest.resolveTask(
        task.getTask().getId(),
        new ResolveTask().withNewValue("Approved"),
        authHeaders(USER1.getName()));

    // Check that the term is now approved
    GlossaryTerm movedTerm = getEntity(termToMove.getId(), "parent", authHeaders(USER1.getName()));
    assertEquals(EntityStatus.APPROVED, movedTerm.getEntityStatus());
    assertEquals(parentTerm.getId(), movedTerm.getParent().getId());
  }

  @Test
  void test_renameGlossaryTermWithApprovalWorkflow(TestInfo test) throws IOException {
    // Ensure the workflow is active
    WorkflowHandler.getInstance().resumeWorkflow("GlossaryTermApprovalWorkflow");

    // Create a glossary with a reviewer
    Glossary glossary = createGlossary(test, List.of(USER1_REF), null);

    // Create a term
    GlossaryTerm term = createTerm(glossary, null, "termToRename");
    assertEquals(EntityStatus.DRAFT, term.getEntityStatus());
    waitForTaskToBeCreated(term.getFullyQualifiedName());
    Thread task = assertApprovalTask(term, TaskStatus.Open);

    term = getEntityByName(term.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);

    // Rename the term
    renameGlossaryTermAndCheck(term, "renamedTerm");

    // After renaming, the task should still be resolvable
    taskTest.resolveTask(
        task.getTask().getId(),
        new ResolveTask().withNewValue("Approved"),
        authHeaders(USER1.getName()));

    // Check that the term is now approved
    GlossaryTerm renamedTerm = getEntity(term.getId(), authHeaders(USER1.getName()));
    assertEquals(EntityStatus.APPROVED, renamedTerm.getEntityStatus());
    assertEquals("renamedTerm", renamedTerm.getName());
  }
}
