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

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
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
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.EntityUtil.getFqn;
import static org.openmetadata.service.util.EntityUtil.getFqns;
import static org.openmetadata.service.util.EntityUtil.getId;
import static org.openmetadata.service.util.EntityUtil.toTagLabels;
import static org.openmetadata.service.util.TestUtils.*;
import static org.openmetadata.service.util.TestUtils.UpdateType.CHANGE_CONSOLIDATED;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.UpdateType.NO_CHANGE;
import static org.openmetadata.service.util.TestUtils.UpdateType.REVERT;

import java.io.IOException;
import java.net.URI;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import javax.ws.rs.core.Response;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.TermReference;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.GlossaryTerm.Status;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskDetails;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.feeds.FeedResource.ThreadList;
import org.openmetadata.service.resources.feeds.FeedResourceTest;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
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
    Glossary glossary1 = createGlossary("glossãry1", null, null);

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
    Glossary glossary = createGlossary(test, listOf(USER1_REF), USER2_REF);

    // Create term t1 in the glossary without reviewers and owner
    CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withName("t1")
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("desc");
    GlossaryTerm t1 = assertOwnerInheritance(create, USER2_REF);
    t1 = getEntity(t1.getId(), "reviewers,owner", ADMIN_AUTH_HEADERS);
    assertEntityReferences(glossary.getReviewers(), t1.getReviewers()); // Reviewers are inherited

    // Create term t12 under t1 without reviewers and owner
    create =
        create
            .withName("t12")
            .withGlossary(glossary.getFullyQualifiedName())
            .withParent(t1.getFullyQualifiedName());
    GlossaryTerm t12 = assertOwnerInheritance(create, USER2_REF);
    t12 = getEntity(t12.getId(), "reviewers,owner", ADMIN_AUTH_HEADERS);
    assertEntityReferences(glossary.getReviewers(), t12.getReviewers()); // Reviewers are inherited
  }

  @Test
  void test_inheritDomain(TestInfo test) throws IOException {
    // When domain is not set for a glossary term, carry it forward from the glossary
    CreateGlossary createGlossary =
        glossaryTest.createRequest(test).withDomain(DOMAIN.getFullyQualifiedName());
    Glossary glossary = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    // Create term t1 in the glossary without domain
    CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withName("t1")
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("desc");
    GlossaryTerm t1 = assertDomainInheritance(create, DOMAIN.getEntityReference());

    // Create terms t12 under t1 without reviewers and owner
    create =
        create
            .withName("t12")
            .withGlossary(glossary.getFullyQualifiedName())
            .withParent(t1.getFullyQualifiedName());
    assertDomainInheritance(create, DOMAIN.getEntityReference());
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
  void patch_addDeleteReviewers(TestInfo test) throws IOException {
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
    term = patchEntityAndCheck(term, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Add reviewer USER2, synonym2, reference2 in PATCH request
    // Changes from this PATCH is consolidated with the previous changes
    origJson = JsonUtils.pojoToJson(term);
    TermReference reference2 =
        new TermReference().withName("reference2").withEndpoint(URI.create("http://reference2"));
    term.withReviewers(List.of(USER1_REF, USER2_REF))
        .withSynonyms(List.of("synonym1", "synonym2"))
        .withReferences(List.of(reference1, reference2));
    change = getChangeDescription(term, CHANGE_CONSOLIDATED);
    fieldAdded(change, "reviewers", List.of(USER1_REF, USER2_REF));
    fieldAdded(change, "synonyms", List.of("synonym1", "synonym2"));
    fieldAdded(change, "references", List.of(reference1, reference2));
    term = patchEntityAndCheck(term, origJson, ADMIN_AUTH_HEADERS, CHANGE_CONSOLIDATED, change);

    // Remove a reviewer USER1, synonym1, reference1 in PATCH request
    // Changes from this PATCH is consolidated with the previous changes resulting in no change
    origJson = JsonUtils.pojoToJson(term);
    term.withReviewers(List.of(USER2_REF))
        .withSynonyms(List.of("synonym2"))
        .withReferences(List.of(reference2));
    change = getChangeDescription(term, CHANGE_CONSOLIDATED);
    fieldAdded(change, "reviewers", List.of(USER2_REF));
    fieldAdded(change, "synonyms", List.of("synonym2"));
    fieldAdded(change, "references", List.of(reference2));
    patchEntityAndCheck(term, origJson, ADMIN_AUTH_HEADERS, CHANGE_CONSOLIDATED, change);
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
    change = getChangeDescription(term, REVERT);
    patchEntityAndCheck(term, origJson, ADMIN_AUTH_HEADERS, REVERT, change);
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
            .withReviewers(listOf(USER1.getFullyQualifiedName(), USER2.getFullyQualifiedName()));
    Glossary glossary2 = glossaryTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    // Creating a glossary term g2t1 should be in `Draft` mode (because glossary has reviewers)
    GlossaryTerm g2t1 = createTerm(glossary2, null, "g2t1");
    assertEquals(Status.DRAFT, g2t1.getStatus());
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
    approvalTask = assertApprovalTask(g2t3, TaskStatus.Open); // A Request Approval task is opened
    int taskId2 = approvalTask.getTask().getId();

    // Even admin can't close the task
    assertResponse(
        () -> taskTest.closeTask(taskId2, "comment", ADMIN_AUTH_HEADERS),
        FORBIDDEN,
        notReviewer("admin"));

    // Reviewer closes the task. Glossary term is rejected. And task is resolved.
    taskTest.closeTask(taskId2, "Rejected", authHeaders(USER1.getName()));
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
  }

  @Test
  void testInheritedPermissionFromParent(TestInfo test) throws IOException {
    // Glossary g has owner dataConsumer
    Glossary g = createGlossary(getEntityName(test), null, DATA_CONSUMER.getEntityReference());
    // dataConsumer as owner of g can create glossary term t1 under it
    GlossaryTerm t1 =
        createTerm(
            g,
            null,
            "t1",
            null,
            DATA_STEWARD.getEntityReference(),
            authHeaders(DATA_CONSUMER.getName()));
    // dataSteward who is owner of term t1 can create term t11 under it
    createTerm(
        g, t1, "t11", null, DATA_STEWARD.getEntityReference(), authHeaders(DATA_STEWARD.getName()));
  }

  private Thread assertApprovalTask(GlossaryTerm term, TaskStatus expectedTaskStatus)
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
    // Create glossary term1 in glossary g1
    CreateGlossaryTerm create =
        createRequest(getEntityName(test), "", "", null)
            .withReviewers(null)
            .withSynonyms(null)
            .withStyle(null);
    GlossaryTerm term1 = createEntity(create, ADMIN_AUTH_HEADERS);

    // Create glossary term11 under term1 in glossary g1
    create =
        createRequest("t1", "", "", null)
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
    change = getChangeDescription(term1, REVERT);
    patchEntityAndCheck(term1, json, ADMIN_AUTH_HEADERS, REVERT, change);
    term1 = getEntity(term1.getId(), ADMIN_AUTH_HEADERS);
    assertNull(term1.getStyle());
  }

  @Test
  void delete_recursive(TestInfo test) throws IOException {
    Glossary g1 = createGlossary(test, null, null);

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

  public GlossaryTerm createTerm(Glossary glossary, GlossaryTerm parent, String termName)
      throws IOException {
    return createTerm(glossary, parent, termName, glossary.getReviewers());
  }

  public GlossaryTerm createTerm(
      Glossary glossary, GlossaryTerm parent, String termName, List<EntityReference> reviewers)
      throws IOException {
    return createTerm(glossary, parent, termName, reviewers, null, ADMIN_AUTH_HEADERS);
  }

  public GlossaryTerm createTerm(
      Glossary glossary,
      GlossaryTerm parent,
      String termName,
      List<EntityReference> reviewers,
      EntityReference owner,
      Map<String, String> createdBy)
      throws IOException {
    CreateGlossaryTerm createGlossaryTerm =
        createRequest(termName, "", "", null)
            .withGlossary(getFqn(glossary))
            .withStyle(new Style().withColor("#FF5733").withIconURL("https://img"))
            .withParent(getFqn(parent))
            .withOwner(owner)
            .withReviewers(getFqns(reviewers));
    return createAndCheckEntity(createGlossaryTerm, createdBy);
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
        .withRelatedTerms(Arrays.asList(getFqn(GLOSSARY1_TERM1), getFqn(GLOSSARY2_TERM1)))
        .withReviewers(List.of(USER1_REF.getFullyQualifiedName()));
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
    assertEntityReferenceNames(request.getReviewers(), entity.getReviewers());

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
        term.getChildren(),
        term.getRelatedTerms(),
        term.getReviewers(),
        term.getOwner(),
        term.getTags());

    fields = "children,relatedTerms,reviewers,owner,tags";
    term =
        byName
            ? getEntityByName(term.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(term.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(term.getRelatedTerms(), term.getReviewers(), term.getOwner(), term.getTags());
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
      update = update != null ? update : NO_CHANGE;
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

  public Glossary createGlossary(
      TestInfo test, List<EntityReference> reviewers, EntityReference owner) throws IOException {
    return createGlossary(glossaryTest.getEntityName(test), reviewers, owner);
  }

  public Glossary createGlossary(
      String name, List<EntityReference> reviewers, EntityReference owner) throws IOException {
    CreateGlossary create =
        glossaryTest.createRequest(name).withReviewers(getFqns(reviewers)).withOwner(owner);
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
    translations.add("नमस्कार");

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
    translations.add("नमस्कार");

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
}
