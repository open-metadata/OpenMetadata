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

import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.csv.CsvUtil.recordToString;
import static org.openmetadata.csv.EntityCsv.entityNotFound;
import static org.openmetadata.csv.EntityCsv.invalidCustomPropertyFieldFormat;
import static org.openmetadata.csv.EntityCsv.invalidCustomPropertyKey;
import static org.openmetadata.csv.EntityCsv.invalidCustomPropertyValue;
import static org.openmetadata.csv.EntityCsv.invalidExtension;
import static org.openmetadata.csv.EntityCsv.invalidField;
import static org.openmetadata.csv.EntityCsvTest.assertRows;
import static org.openmetadata.csv.EntityCsvTest.assertSummary;
import static org.openmetadata.csv.EntityCsvTest.createCsv;
import static org.openmetadata.csv.EntityCsvTest.getFailedRecord;
import static org.openmetadata.schema.type.ProviderType.SYSTEM;
import static org.openmetadata.schema.type.TaskType.RequestDescription;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.EntityUtil.getFqn;
import static org.openmetadata.service.util.EntityUtil.toTagLabels;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.validateTagLabel;

import jakarta.ws.rs.core.Response.Status;
import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.CustomPropertyConfig;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.type.customProperties.TableConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.EntityRepository.EntityUpdater;
import org.openmetadata.service.jdbi3.GlossaryRepository.GlossaryCsv;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.events.EventSubscriptionResourceTest;
import org.openmetadata.service.resources.feeds.FeedResource;
import org.openmetadata.service.resources.feeds.FeedResourceTest;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.resources.metadata.TypeResourceTest;
import org.openmetadata.service.resources.tags.ClassificationResourceTest;
import org.openmetadata.service.resources.tags.TagResourceTest;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class GlossaryResourceTest extends EntityResourceTest<Glossary, CreateGlossary> {
  private final FeedResourceTest feedTest = new FeedResourceTest();

  public GlossaryResourceTest() {
    super(
        Entity.GLOSSARY,
        Glossary.class,
        GlossaryResource.GlossaryList.class,
        "glossaries",
        GlossaryResource.FIELDS);
    supportsSearchIndex = true;
  }

  public void setupGlossaries() throws IOException {
    CreateGlossary createGlossary = createRequest("g1", "", "", null);
    GLOSSARY1 = createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    createGlossary = createRequest("g2", "", "", null);
    GLOSSARY2 = createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    GlossaryTermResourceTest glossaryTermResourceTest = new GlossaryTermResourceTest();
    CreateGlossaryTerm createGlossaryTerm =
        glossaryTermResourceTest
            .createRequest("g1t1", "", "", null)
            .withRelatedTerms(null)
            .withGlossary(GLOSSARY1.getName())
            .withTags(List.of(PII_SENSITIVE_TAG_LABEL, PERSONAL_DATA_TAG_LABEL))
            .withReviewers(GLOSSARY1.getReviewers());
    GLOSSARY1_TERM1 = glossaryTermResourceTest.createEntity(createGlossaryTerm, ADMIN_AUTH_HEADERS);
    GLOSSARY1_TERM1_LABEL = EntityUtil.toTagLabel(GLOSSARY1_TERM1);
    validateTagLabel(GLOSSARY1_TERM1_LABEL);

    createGlossaryTerm =
        glossaryTermResourceTest
            .createRequest("g2t1", "", "", null)
            .withRelatedTerms(List.of(GLOSSARY1_TERM1.getFullyQualifiedName()))
            .withGlossary(GLOSSARY2.getName())
            .withReviewers(GLOSSARY1.getReviewers());
    GLOSSARY2_TERM1 = glossaryTermResourceTest.createEntity(createGlossaryTerm, ADMIN_AUTH_HEADERS);
    GLOSSARY2_TERM1_LABEL = EntityUtil.toTagLabel(GLOSSARY2_TERM1);
    validateTagLabel(GLOSSARY2_TERM1_LABEL);
  }

  @Test
  void patch_addDeleteReviewers(TestInfo test) throws IOException {
    CreateGlossary create = createRequest(getEntityName(test), "", "", null);
    Glossary glossary = createEntity(create, ADMIN_AUTH_HEADERS);

    // Add reviewer USER1 in PATCH request
    String origJson = JsonUtils.pojoToJson(glossary);
    glossary.withReviewers(List.of(USER1_REF));
    ChangeDescription change = getChangeDescription(glossary, MINOR_UPDATE);
    fieldAdded(change, "reviewers", List.of(USER1_REF));
    glossary = patchEntityAndCheck(glossary, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Add another reviewer USER2 in PATCH request
    // Changes from this PATCH is consolidated with the previous changes
    origJson = JsonUtils.pojoToJson(glossary);
    glossary.withReviewers(List.of(USER1_REF, USER2_REF));
    change =
        getChangeDescription(
            glossary, MINOR_UPDATE); // PATCH operation update is consolidated in a user session
    fieldAdded(change, "reviewers", List.of(USER2_REF));
    glossary = patchEntityAndCheck(glossary, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Create a glossary term and assign USER2 as a reviewer
    GlossaryTermResourceTest glossaryTermResourceTest = new GlossaryTermResourceTest();
    CreateGlossaryTerm createGlossaryTerm =
        glossaryTermResourceTest
            .createRequest("GLOSSARY_TERM1", "description", "", null)
            .withRelatedTerms(List.of(GLOSSARY1_TERM1.getFullyQualifiedName()))
            .withGlossary(glossary.getName())
            .withReviewers(listOf(USER2_REF));
    GlossaryTerm GLOSSARY_TERM1 =
        glossaryTermResourceTest.createEntity(createGlossaryTerm, ADMIN_AUTH_HEADERS);

    // Verify that the term has both the glossary's reviewer and its own reviewer
    List<EntityReference> reviewers = listOf(USER1_REF, USER2_REF);
    reviewers.sort(Comparator.comparing(EntityReference::getName));
    assertEquals(GLOSSARY_TERM1.getReviewers().size(), reviewers.size());

    // Compare the reviewer IDs of both lists to ensure they match
    List<UUID> glossaryTermReviewerIds =
        GLOSSARY_TERM1.getReviewers().stream()
            .map(EntityReference::getId)
            .sorted()
            .collect(Collectors.toList());
    assertEquals(
        glossaryTermReviewerIds,
        listOf(USER1_REF.getId(), USER2_REF.getId()).stream().sorted().toList());

    // Verify that the task assignees are the same as the term reviewers
    waitForTaskToBeCreated(GLOSSARY_TERM1.getFullyQualifiedName());
    Thread approvalTask =
        glossaryTermResourceTest.assertApprovalTask(GLOSSARY_TERM1, TaskStatus.Open);
    assertEquals(
        GLOSSARY_TERM1.getReviewers().size(), approvalTask.getTask().getAssignees().size());

    // Compare the reviewer IDs of both lists to ensure they match
    List<UUID> taskAssigneeIds =
        approvalTask.getTask().getAssignees().stream()
            .map(EntityReference::getId)
            .sorted()
            .collect(Collectors.toList());
    assertEquals(glossaryTermReviewerIds, taskAssigneeIds);

    // Remove a reviewer USER1 in PATCH request
    // Changes from this PATCH is consolidated with the previous changes
    origJson = JsonUtils.pojoToJson(glossary);
    glossary.withReviewers(List.of(USER2_REF));
    change =
        getChangeDescription(
            glossary, MINOR_UPDATE); // PATCH operation update is consolidated in a user session
    fieldDeleted(change, "reviewers", List.of(USER1_REF));
    patchEntityAndCheck(glossary, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Verify that USER1_REF is removed from the reviewers for the terms inside the glossary
    GLOSSARY_TERM1 =
        glossaryTermResourceTest.getEntity(GLOSSARY_TERM1.getId(), "reviewers", ADMIN_AUTH_HEADERS);
    reviewers = listOf(USER2_REF);
    reviewers.sort(Comparator.comparing(EntityReference::getName));
    assertEquals(GLOSSARY_TERM1.getReviewers(), reviewers);

    // Create a child term under GLOSSARY_TERM1 and ensure the reviewers are inherited from parent
    // term
    createGlossaryTerm =
        glossaryTermResourceTest
            .createRequest("CHILD_TERM1", "description", "", null)
            .withRelatedTerms(List.of(GLOSSARY1_TERM1.getFullyQualifiedName()))
            .withGlossary(glossary.getName())
            .withParent(GLOSSARY_TERM1.getFullyQualifiedName())
            .withReviewers(listOf(DATA_CONSUMER_REF));
    GlossaryTerm CHILD_TERM1 =
        glossaryTermResourceTest.createEntity(createGlossaryTerm, ADMIN_AUTH_HEADERS);

    reviewers = listOf(USER2_REF, DATA_CONSUMER_REF);
    reviewers.sort(Comparator.comparing(EntityReference::getName));
    assertEquals(CHILD_TERM1.getReviewers().size(), reviewers.size());

    // Compare the reviewer IDs of both lists to ensure they match
    List<UUID> childTermReviewerIds =
        CHILD_TERM1.getReviewers().stream()
            .map(EntityReference::getId)
            .sorted()
            .collect(Collectors.toList());
    assertEquals(
        childTermReviewerIds,
        listOf(DATA_CONSUMER_REF.getId(), USER2_REF.getId()).stream().sorted().toList());

    // Verify that the task assignees are the same as the child term reviewers
    waitForTaskToBeCreated(CHILD_TERM1.getFullyQualifiedName());
    approvalTask = glossaryTermResourceTest.assertApprovalTask(CHILD_TERM1, TaskStatus.Open);
    assertEquals(CHILD_TERM1.getReviewers().size(), approvalTask.getTask().getAssignees().size());

    // Compare the reviewer IDs of both lists to ensure they match
    taskAssigneeIds =
        approvalTask.getTask().getAssignees().stream()
            .map(EntityReference::getId)
            .sorted()
            .collect(Collectors.toList());
    assertEquals(childTermReviewerIds, taskAssigneeIds);
  }

  @Test
  void patch_renameSystemGlossary_400() throws IOException {
    // Renaming of system glossary and terms are not allowed
    CreateGlossary create =
        createRequest("renameGlossaryNotAllowed").withProvider(ProviderType.SYSTEM);
    Glossary glossary = createEntity(create, ADMIN_AUTH_HEADERS);

    GlossaryTermResourceTest glossaryTermResourceTest = new GlossaryTermResourceTest();
    GlossaryTerm t1 = createGlossaryTerm(glossaryTermResourceTest, glossary, null, "t1", SYSTEM);

    assertResponse(
        () -> glossaryTermResourceTest.renameGlossaryTermAndCheck(t1, "newT1"),
        Status.BAD_REQUEST,
        CatalogExceptionMessage.systemEntityRenameNotAllowed("t1", Entity.GLOSSARY_TERM));

    assertResponse(
        () -> renameGlossaryAndCheck(glossary, "new.renameGlossaryNotAllowed"),
        Status.BAD_REQUEST,
        CatalogExceptionMessage.systemEntityRenameNotAllowed(
            "renameGlossaryNotAllowed", Entity.GLOSSARY));
  }

  @Test
  void patch_renameGlossary(TestInfo test) throws IOException {
    // Create glossary with terms t1, t2
    // Create children terms t11, t12 under t1
    // Create children terms t21, t22 under t2
    CreateGlossary create = createRequest("renameGlossary");
    Glossary glossary = createEntity(create, ADMIN_AUTH_HEADERS);

    GlossaryTermResourceTest glossaryTermResourceTest = new GlossaryTermResourceTest();
    GlossaryTerm t1 = createGlossaryTerm(glossaryTermResourceTest, glossary, null, "t1");
    GlossaryTerm t11 = createGlossaryTerm(glossaryTermResourceTest, glossary, t1, "t11");
    GlossaryTerm t12 = createGlossaryTerm(glossaryTermResourceTest, glossary, t1, "t12");
    GlossaryTerm t2 = createGlossaryTerm(glossaryTermResourceTest, glossary, null, "t2");
    GlossaryTerm t21 = createGlossaryTerm(glossaryTermResourceTest, glossary, t2, "t21");
    GlossaryTerm t22 = createGlossaryTerm(glossaryTermResourceTest, glossary, t2, "t22");

    // Create a Classification with the same name as glossary and assign it to a table
    ClassificationResourceTest classificationResourceTest = new ClassificationResourceTest();
    TagResourceTest tagResourceTest = new TagResourceTest();
    CreateClassification createClassification =
        classificationResourceTest.createRequest("renameGlossary");
    classificationResourceTest.createEntity(createClassification, ADMIN_AUTH_HEADERS);
    Tag tag = tagResourceTest.createTag("t1", "renameGlossary", null);

    // Create a table with all the terms as tag labels
    TableResourceTest tableResourceTest = new TableResourceTest();
    List<TagLabel> tagLabels = toTagLabels(t1, t11, t12, t2, t21, t22);
    tagLabels.add(EntityUtil.toTagLabel(tag)); // Add classification tag with the same name
    Column column = new Column().withName(C1).withDataType(ColumnDataType.INT).withTags(tagLabels);
    CreateTable createTable =
        tableResourceTest
            .createRequest(tableResourceTest.getEntityName(test))
            .withTags(tagLabels)
            .withColumns(listOf(column));
    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    //
    // Change the glossary term t2 to newt2 and ensure the children t21 and t22 FQNs are changed
    // Also ensure the table tag label names are also changed
    //
    glossaryTermResourceTest.renameGlossaryTermAndCheck(t2, "newt2");
    table = tableResourceTest.getEntity(table.getId(), "columns,tags", ADMIN_AUTH_HEADERS);
    assertTagPrefixAbsent(table.getTags(), "renameGlossary.t2");
    assertTagPrefixAbsent(table.getColumns().get(0).getTags(), "renameGlossary.t2");

    // Ensure classification tag with the same name is not changed after renaming glossary
    assertTrue(
        table.getTags().stream()
            .anyMatch(t -> EntityUtil.tagLabelMatch.test(t, EntityUtil.toTagLabel(tag))));

    //
    // Change the glossary renameGlossary to newRenameGlossary and ensure the children FQNs are
    // changed. Also ensure the table tag label names are also changed
    //
    renameGlossaryAndCheck(glossary, "newRenameGlossary");
    table = tableResourceTest.getEntity(table.getId(), "columns,tags", ADMIN_AUTH_HEADERS);
    assertTagPrefixAbsent(table.getTags(), "renameGlossary");
    assertTagPrefixAbsent(table.getColumns().get(0).getTags(), "renameGlossary");
  }

  @Test
  void patch_moveGlossaryTerm(TestInfo test) throws IOException {
    //
    // These test move a glossary term to different parts of the glossary hierarchy and to different
    // glossaries
    //

    // Create glossary with the following hierarchy
    //    -> t1 -> t11 -> t111
    // g  -> t12 -> t121
    //    -> t2 -> t21 -> t211
    //
    // h  -> h1 -> h11 -> h111
    Glossary g = createEntity(createRequest("changeParent'_g"), ADMIN_AUTH_HEADERS);
    Glossary h = createEntity(createRequest("changeParent'_h"), ADMIN_AUTH_HEADERS);
    GlossaryTermResourceTest glossaryTermResourceTest = new GlossaryTermResourceTest();
    GlossaryTerm t1 = createGlossaryTerm(glossaryTermResourceTest, g, null, "t'_1");
    GlossaryTerm t11 = createGlossaryTerm(glossaryTermResourceTest, g, t1, "t'_11");
    GlossaryTerm t111 = createGlossaryTerm(glossaryTermResourceTest, g, t11, "t'_111");
    GlossaryTerm t12 = createGlossaryTerm(glossaryTermResourceTest, g, t1, "t'_12");
    GlossaryTerm t121 = createGlossaryTerm(glossaryTermResourceTest, g, t12, "t'_121");
    GlossaryTerm t13 = createGlossaryTerm(glossaryTermResourceTest, g, t1, "t'_13");
    GlossaryTerm t131 = createGlossaryTerm(glossaryTermResourceTest, g, t13, "t'_131");
    GlossaryTerm t2 = createGlossaryTerm(glossaryTermResourceTest, g, null, "t'_2");
    GlossaryTerm t21 = createGlossaryTerm(glossaryTermResourceTest, g, t2, "t'_21");
    GlossaryTerm t211 = createGlossaryTerm(glossaryTermResourceTest, g, t21, "t'_211");
    GlossaryTerm h1 = createGlossaryTerm(glossaryTermResourceTest, h, null, "h'_1");
    GlossaryTerm h11 = createGlossaryTerm(glossaryTermResourceTest, h, h1, "h'_11");
    GlossaryTerm h111 = createGlossaryTerm(glossaryTermResourceTest, h, h11, "h'_111");

    // Create a table with all the terms as tag labels
    TableResourceTest tableResourceTest = new TableResourceTest();
    List<TagLabel> tagLabels =
        toTagLabels(t1, t11, t111, t12, t121, t13, t131, t2, t21, t211, h1, h11, h111);
    Column column = new Column().withName(C1).withDataType(ColumnDataType.INT).withTags(tagLabels);
    CreateTable createTable =
        tableResourceTest
            .createRequest(tableResourceTest.getEntityName(test))
            .withTags(tagLabels)
            .withColumns(listOf(column));
    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    Object[][] scenarios = {
      // { glossaryTerm being moved, parent/glossary to move to, [... parent/glossary to move to] }
      // Leaf node t111 is moved in these tests
      {t111, g, t1, t11},
      {t111, t2, t21, t211}, // Diff hierarchy and glossary
      {t111, h, h1, h11, h111}, // Diff hierarchy and diff glossary

      // Middle node t11 is moved in these tests
      {t11, g, t1}, // Same hierarchy and glossary
      {t11, t2, t21, t211}, // Diff hierarchy and same glossary
      {t11, h, h1, h11, h111}, // Diff hierarchy and diff glossary

      // Top node t1 is moved in these tests
      {t1, g}, // Same hierarchy and glossary
      {t1, t2, t21, t211}, // Diff hierarchy and same glossary
      {t1, h, h1, h11, h111} // Diff hierarchy and diff glossary
    };

    // Moving to another glossary term as parent
    EntityUpdater.setSessionTimeout(0); // Turn off consolidation of changes in a session
    for (int i = 0; i < scenarios.length; i++) {
      GlossaryTerm termToMove = (GlossaryTerm) scenarios[i][0];

      for (int j = 1; j < scenarios[i].length; j++) {
        GlossaryTerm updatedTerm;

        EntityReference newGlossary;
        EntityReference newParent;
        if (scenarios[i][j] instanceof Glossary) { // Moving to root of another glossary
          newGlossary = ((Glossary) scenarios[i][j]).getEntityReference();
          newParent = null;
        } else { // Moving to another glossary term as parent
          GlossaryTerm newParentTerm = (GlossaryTerm) scenarios[i][j];
          newGlossary = newParentTerm.getGlossary();
          newParent = newParentTerm.getEntityReference();
        }
        LOG.info(
            "Scenario iteration [{}, {}] move the term {} from glossary:parent {}:{} to {}:{}",
            i,
            j,
            getFqn(termToMove),
            getFqn(termToMove.getGlossary()),
            getFqn(termToMove.getParent()),
            getFqn(newGlossary),
            getFqn(newParent));
        updatedTerm = moveGlossaryTermAndBack(newGlossary, newParent, termToMove, table);
        copyGlossaryTerm(updatedTerm, termToMove);
      }
    }

    // Move a parent term g1.t1 to its child g1.t1.t11 should be disallowed
    assertResponse(
        () ->
            glossaryTermResourceTest.moveGlossaryTerm(
                g.getEntityReference(), t11.getEntityReference(), t1),
        Status.BAD_REQUEST,
        CatalogExceptionMessage.invalidGlossaryTermMove(
            t1.getFullyQualifiedName(), t11.getFullyQualifiedName()));

    EntityUpdater.setSessionTimeout(10 * 60 * 1000); // Turn consolidation of changes back on
  }

  @Test
  void test_patch_changeParent_UpdateHierarchy(TestInfo test) throws IOException {
    CreateGlossary create = createRequest(getEntityName(test), "", "", null);
    Glossary glossary = createEntity(create, ADMIN_AUTH_HEADERS);
    //
    // These test move a glossary term to different parts of the glossary hierarchy and to different
    // glossaries
    //

    // Create glossary with the following hierarchy
    //    -> t1 -> t11
    //    -> t2
    // Create a Classification with the same name as glossary and assign it to a table
    ClassificationResourceTest classificationResourceTest = new ClassificationResourceTest();
    TagResourceTest tagResourceTest = new TagResourceTest();
    CreateClassification createClassification =
        classificationResourceTest.createRequest("SampleTags");
    classificationResourceTest.createEntity(createClassification, ADMIN_AUTH_HEADERS);
    Tag tag1 = tagResourceTest.createTag("tag1", "SampleTags", null);
    Tag tag2 = tagResourceTest.createTag("tag2", "SampleTags", null);
    GlossaryTermResourceTest glossaryTermResourceTest = new GlossaryTermResourceTest();
    GlossaryTerm t1 = createGlossaryTerm(glossaryTermResourceTest, glossary, null, "parentTerm1");

    // GlossaryTerm t11 = createGlossaryTerm(glossaryTermResourceTest, glossary, t1,
    // "parentTerm11").withTags(toTagLabels(tag1,tag2));
    GlossaryTerm t11 =
        createGlossaryTermWithTags(
            glossaryTermResourceTest, glossary, t1, "parentTerm11", toTagLabels(tag1, tag2));

    GlossaryTerm originalT1 = new GlossaryTerm();
    copyGlossaryTerm(t11, originalT1);

    GlossaryTerm t2 = createGlossaryTerm(glossaryTermResourceTest, glossary, null, "parentTerm2");
    glossaryTermResourceTest.moveGlossaryTerm(
        glossary.getEntityReference(), t2.getEntityReference(), t11);

    TestUtils.validateTags(originalT1.getTags(), t11.getTags());
  }

  @Test
  void patch_moveGlossaryTermParentToChild() {}

  @Test
  void testCsvDocumentation() throws HttpResponseException {
    assertEquals(GlossaryCsv.DOCUMENTATION, getCsvDocumentation());
  }

  @Test
  @SneakyThrows
  void testImportInvalidCsv() {
    String glossaryName = "invalidCsv";
    createEntity(createRequest(glossaryName), ADMIN_AUTH_HEADERS);

    // Create glossaryTerm with invalid name (due to ::)
    String resultsHeader = recordToString(EntityCsv.getResultHeaders(GlossaryCsv.HEADERS));
    String record = ",g::1,dsp1,dsc1,,,,,,,,";
    String csv = createCsv(GlossaryCsv.HEADERS, listOf(record), null);
    CsvImportResult result = importCsv(glossaryName, csv, false);
    Awaitility.await().atMost(4, TimeUnit.SECONDS).until(() -> true);
    assertSummary(result, ApiStatus.PARTIAL_SUCCESS, 2, 1, 1);
    String[] expectedRows = {
      resultsHeader, getFailedRecord(record, "[name must match \"^((?!::).)*$\"]")
    };
    assertRows(result, expectedRows);

    // Create glossaryTerm with invalid parent
    record = "invalidParent,g1,dsp1,dsc1,h1;h2;h3,,term1;http://term1,Tier.Tier1,,,,";
    csv = createCsv(GlossaryCsv.HEADERS, listOf(record), null);
    result = importCsv(glossaryName, csv, false);
    Awaitility.await().atMost(4, TimeUnit.SECONDS).until(() -> true);
    assertSummary(result, ApiStatus.PARTIAL_SUCCESS, 2, 1, 1);
    expectedRows =
        new String[] {
          resultsHeader,
          getFailedRecord(record, entityNotFound(0, Entity.GLOSSARY_TERM, "invalidParent"))
        };
    assertRows(result, expectedRows);

    // Create glossaryTerm with  Invalid references
    record = ",g1,dsp1,dsc1,h1;h2;h3,,term1:http://term1,,,,,";
    csv = createCsv(GlossaryCsv.HEADERS, listOf(record), null);
    result = importCsv(glossaryName, csv, false);
    assertSummary(result, ApiStatus.PARTIAL_SUCCESS, 2, 1, 1);
    expectedRows =
        new String[] {
          resultsHeader,
          getFailedRecord(
              record,
              invalidField(
                  6, "Term References should be given in the format referenceName;endpoint url."))
        };
    assertRows(result, expectedRows);

    // Create glossaryTerm with invalid tags field
    record = ",g1,dsp1,dsc1,h1;h2;h3,,term1;http://term1,Tag.invalidTag,,,,";
    csv = createCsv(GlossaryCsv.HEADERS, listOf(record), null);
    result = importCsv(glossaryName, csv, false);
    assertSummary(result, ApiStatus.PARTIAL_SUCCESS, 2, 1, 1);
    expectedRows =
        new String[] {
          resultsHeader, getFailedRecord(record, entityNotFound(7, Entity.TAG, "Tag.invalidTag"))
        };
    assertRows(result, expectedRows);

    // Create glossaryTerm with  Invalid extension column format
    record = ",g1,dsp1,dsc1,h1;h2;h3,,term1;http://term1,PII.None,,,,glossaryTermDateCp";
    csv = createCsv(GlossaryCsv.HEADERS, listOf(record), null);
    result = importCsv(glossaryName, csv, false);
    assertSummary(result, ApiStatus.PARTIAL_SUCCESS, 2, 1, 1);
    expectedRows =
        new String[] {
          resultsHeader, getFailedRecord(record, invalidExtension(11, "glossaryTermDateCp", null))
        };
    assertRows(result, expectedRows);

    // Create glossaryTerm with  Invalid custom property key
    String invalidCustomPropertyKeyRecord =
        ",g1,dsp1,dsc1,h1;h2;h3,,term1;http://term1,PII.None,,,,invalidCustomProperty:someValue";
    csv = createCsv(GlossaryCsv.HEADERS, listOf(invalidCustomPropertyKeyRecord), null);
    result = importCsv(glossaryName, csv, false);
    Awaitility.await().atMost(4, TimeUnit.SECONDS).until(() -> true);
    assertSummary(result, ApiStatus.PARTIAL_SUCCESS, 2, 1, 1);
    expectedRows =
        new String[] {
          resultsHeader,
          getFailedRecord(
              invalidCustomPropertyKeyRecord, invalidCustomPropertyKey(11, "invalidCustomProperty"))
        };
    assertRows(result, expectedRows);

    // Create glossaryTerm with  Invalid custom property value
    CustomProperty glossaryTermIntegerCp =
        new CustomProperty()
            .withName("glossaryTermIntegerCp")
            .withDescription("integer type custom property")
            .withPropertyType(INT_TYPE.getEntityReference());
    TypeResourceTest typeResourceTest = new TypeResourceTest();
    Type entityType =
        typeResourceTest.getEntityByName(
            Entity.GLOSSARY_TERM, "customProperties", ADMIN_AUTH_HEADERS);
    entityType =
        typeResourceTest.addAndCheckCustomProperty(
            entityType.getId(), glossaryTermIntegerCp, OK, ADMIN_AUTH_HEADERS);
    String invalidIntValueRecord =
        ",g1,dsp1,dsc1,h1;h2;h3,,term1;http://term1,PII.None,,,,glossaryTermIntegerCp:11s22";
    csv = createCsv(GlossaryCsv.HEADERS, listOf(invalidIntValueRecord), null);
    result = importCsv(glossaryName, csv, false);
    Awaitility.await().atMost(4, TimeUnit.SECONDS).until(() -> true);
    assertSummary(result, ApiStatus.PARTIAL_SUCCESS, 2, 1, 1);
    expectedRows =
        new String[] {
          resultsHeader,
          getFailedRecord(
              invalidIntValueRecord,
              invalidCustomPropertyValue(
                  11, "glossaryTermIntegerCp", INT_TYPE.getDisplayName(), "11s22"))
        };
    assertRows(result, expectedRows);

    // Create glossaryTerm with  Invalid custom property value's format
    CustomProperty glossaryTermDateCp =
        new CustomProperty()
            .withName("glossaryTermDateCp")
            .withDescription("dd-MM-yyyy format time")
            .withPropertyType(DATECP_TYPE.getEntityReference())
            .withCustomPropertyConfig(new CustomPropertyConfig().withConfig("dd-MM-yyyy"));
    entityType =
        typeResourceTest.getEntityByName(
            Entity.GLOSSARY_TERM, "customProperties", ADMIN_AUTH_HEADERS);
    entityType =
        typeResourceTest.addAndCheckCustomProperty(
            entityType.getId(), glossaryTermDateCp, OK, ADMIN_AUTH_HEADERS);
    String invalidDateFormatRecord =
        ",g1,dsp1,dsc1,h1;h2;h3,,term1;http://term1,PII.None,,,,glossaryTermDateCp:invalid-date-format";
    csv = createCsv(GlossaryCsv.HEADERS, listOf(invalidDateFormatRecord), null);
    result = importCsv(glossaryName, csv, false);
    Awaitility.await().atMost(4, TimeUnit.SECONDS).until(() -> true);
    assertSummary(result, ApiStatus.PARTIAL_SUCCESS, 2, 1, 1);
    expectedRows =
        new String[] {
          resultsHeader,
          getFailedRecord(
              invalidDateFormatRecord,
              invalidCustomPropertyFieldFormat(
                  11, "glossaryTermDateCp", DATECP_TYPE.getDisplayName(), "dd-MM-yyyy"))
        };
    assertRows(result, expectedRows);

    // Create glossaryTerm with  Invalid custom property of type table
    TableConfig tableConfig =
        new TableConfig().withColumns(Set.of("columnName1", "columnName2", "columnName3"));
    CustomProperty glossaryTermTableCp =
        new CustomProperty()
            .withName("glossaryTermTableCp")
            .withDescription("table  type custom property ")
            .withPropertyType(TABLE_TYPE.getEntityReference())
            .withCustomPropertyConfig(
                new CustomPropertyConfig()
                    .withConfig(Map.of("columns", new ArrayList<>(tableConfig.getColumns()))));
    entityType =
        typeResourceTest.getEntityByName(
            Entity.GLOSSARY_TERM, "customProperties", ADMIN_AUTH_HEADERS);
    entityType =
        typeResourceTest.addAndCheckCustomProperty(
            entityType.getId(), glossaryTermTableCp, OK, ADMIN_AUTH_HEADERS);
    String invalidTableTypeRecord =
        ",g1,dsp1,dsc1,h1;h2;h3,,term1;http://term1,PII.None,,,,\"glossaryTermTableCp:row_1_col1_Value,row_1_col2_Value,row_1_col3_Value,row_1_col4_Value|row_2_col1_Value,row_2_col2_Value,row_2_col3_Value,row_2_col4_Value\"";
    String invalidTableTypeValue =
        ",g1,dsp1,dsc1,h1;h2;h3,,term1;http://term1,PII.None,,,,\"glossaryTermTableCp:row_1_col1_Value,row_1_col2_Value,row_1_col3_Value,row_1_col4_Value|row_2_col1_Value,row_2_col2_Value,row_2_col3_Value,row_2_col4_Value\"";
    csv = createCsv(GlossaryCsv.HEADERS, listOf(invalidTableTypeValue), null);
    result = importCsv(glossaryName, csv, false);
    Awaitility.await().atMost(4, TimeUnit.SECONDS).until(() -> true);
    assertSummary(result, ApiStatus.PARTIAL_SUCCESS, 2, 1, 1);
    expectedRows =
        new String[] {
          resultsHeader,
          getFailedRecord(
              invalidTableTypeRecord,
              invalidCustomPropertyValue(
                  11,
                  "glossaryTermTableCp",
                  "table",
                  "Column count should be less than or equal to " + tableConfig.getMaxColumns()))
        };
    assertRows(result, expectedRows);

    // Create glossaryTerm with invalid multiple values for non multi-select property
    CustomProperty glossaryTermSingleSelectEnumCp =
        new CustomProperty()
            .withName("glossaryTermSingleSelectEnumCp")
            .withDescription("non-multi select enum type custom property ")
            .withPropertyType(ENUM_TYPE.getEntityReference())
            .withCustomPropertyConfig(
                new CustomPropertyConfig()
                    .withConfig(
                        Map.of(
                            "values",
                            List.of("singleSelect-1", "singleSelect-2", "singleSelect-3"),
                            "multiSelect",
                            false)));

    entityType =
        typeResourceTest.getEntityByName(
            Entity.GLOSSARY_TERM, "customProperties", ADMIN_AUTH_HEADERS);
    entityType =
        typeResourceTest.addAndCheckCustomProperty(
            entityType.getId(), glossaryTermSingleSelectEnumCp, OK, ADMIN_AUTH_HEADERS);
    String invalidEnumTypeRecord =
        ",g1,dsp1,dsc1,h1;h2;h3,,term1;http://term1,PII.None,,,,glossaryTermSingleSelectEnumCp:any random string";
    String invalidEnumTypeValue =
        ",g1,dsp1,dsc1,h1;h2;h3,,term1;http://term1,PII.None,,,,glossaryTermSingleSelectEnumCp:any random string";
    csv = createCsv(GlossaryCsv.HEADERS, listOf(invalidEnumTypeValue), null);
    result = importCsv(glossaryName, csv, false);
    Awaitility.await().atMost(4, TimeUnit.SECONDS).until(() -> true);
    assertSummary(result, ApiStatus.PARTIAL_SUCCESS, 2, 1, 1);
    expectedRows =
        new String[] {
          resultsHeader,
          getFailedRecord(
              invalidEnumTypeRecord,
              invalidCustomPropertyValue(
                  11,
                  "glossaryTermSingleSelectEnumCp",
                  ENUM_TYPE.getDisplayName(),
                  String.format(
                      "Values '[any random string]' not supported for property "
                          + glossaryTermSingleSelectEnumCp.getName())))
        };
    assertRows(result, expectedRows);

    String invalidEnumTypeRecord2 =
        ",g1,dsp1,dsc1,h1;h2;h3,,term1;http://term1,PII.None,,,,glossaryTermSingleSelectEnumCp:singleSelect-1|singleSelect-2";
    String invalidEnumTypeValue2 =
        ",g1,dsp1,dsc1,h1;h2;h3,,term1;http://term1,PII.None,,,,glossaryTermSingleSelectEnumCp:singleSelect-1|singleSelect-2";
    csv = createCsv(GlossaryCsv.HEADERS, listOf(invalidEnumTypeValue2), null);
    result = importCsv(glossaryName, csv, false);
    Awaitility.await().atMost(4, TimeUnit.SECONDS).until(() -> true);
    assertSummary(result, ApiStatus.PARTIAL_SUCCESS, 2, 1, 1);
    expectedRows =
        new String[] {
          resultsHeader,
          getFailedRecord(
              invalidEnumTypeRecord2,
              invalidCustomPropertyValue(
                  11,
                  "glossaryTermSingleSelectEnumCp",
                  ENUM_TYPE.getDisplayName(),
                  String.format(
                      "Only one value allowed for non-multiSelect %s property",
                      glossaryTermSingleSelectEnumCp.getName())))
        };
    assertRows(result, expectedRows);
  }

  @Test
  void test_importCsvWithFullTermUpdate() throws IOException {
    // Create a glossary
    String glossaryName = "fullUpdateTest";
    createEntity(createRequest(glossaryName), ADMIN_AUTH_HEADERS);

    // Create custom property for testing
    TypeResourceTest typeResourceTest = new TypeResourceTest();
    Type entityType =
        typeResourceTest.getEntityByName(
            Entity.GLOSSARY_TERM, "customProperties", ADMIN_AUTH_HEADERS);
    CustomProperty stringCp =
        new CustomProperty()
            .withName("glossaryTermStringCp")
            .withDescription("string type custom property")
            .withPropertyType(STRING_TYPE.getEntityReference());
    typeResourceTest.addAndCheckCustomProperty(
        entityType.getId(), stringCp, OK, ADMIN_AUTH_HEADERS);

    // First create terms with initial hierarchy and values
    String initialCsv =
        createCsv(
            GlossaryCsv.HEADERS,
            listOf(
                ",term1,Term 1,Description 1,syn1;syn2,,,PII.None,,,Draft,",
                ",term2,Term 2,Description 2,,,,,,,Approved,",
                "fullUpdateTest.term1,term3,Term 3,Description 3,,,,,,,Approved,"),
            null);

    // Import initial terms
    CsvImportResult result = importCsv(glossaryName, initialCsv, false);
    assertSummary(result, ApiStatus.SUCCESS, 4, 4, 0);

    // Now update with changes - move term3 to term2 and update other fields
    String updateCsv =
        createCsv(
            GlossaryCsv.HEADERS,
            listOf(
                "fullUpdateTest.term2,term3,Term 3 Updated,Description 3 Updated,newSyn1;newSyn2,,ref1;http://ref1.com,PII.Sensitive,,,Approved,glossaryTermStringCp:test value"),
            null);

    // Import updates
    result = importCsv(glossaryName, updateCsv, false);
    assertSummary(result, ApiStatus.SUCCESS, 2, 2, 0);

    // Verify all fields were updated
    GlossaryTerm term3 =
        new GlossaryTermResourceTest()
            .getEntityByName(
                "fullUpdateTest.term2.term3",
                "owners,reviewers,parent,glossary,tags,extension",
                ADMIN_AUTH_HEADERS);
    assertEquals("Term 3 Updated", term3.getDisplayName());
    assertEquals("Description 3 Updated", term3.getDescription());
    assertEquals(List.of("newSyn1", "newSyn2"), term3.getSynonyms());
    assertEquals("term2", term3.getParent().getName());
    assertEquals(1, term3.getReferences().size());
    assertEquals("ref1", term3.getReferences().getFirst().getName());
    assertEquals("http://ref1.com", term3.getReferences().getFirst().getEndpoint().toString());
    assertEquals(1, term3.getTags().size());
    assertEquals("PII.Sensitive", term3.getTags().getFirst().getTagFQN());
    assertEquals(GlossaryTerm.Status.APPROVED, term3.getStatus());
    // Fix: Safely extract the custom property from the extension map
    Object extension = term3.getExtension();
    String customPropValue = null;
    if (extension instanceof Map) {
      Object val = ((Map<?, ?>) extension).get("glossaryTermStringCp");
      if (val != null) customPropValue = val.toString();
    }
    assertEquals("test value", customPropValue);
  }

  @Test
  void testGlossaryImportExport() throws IOException {
    EventSubscriptionResourceTest eventSubscriptionResourceTest =
        new EventSubscriptionResourceTest();
    // Update poll Interval to allow Status change from workflow to take some time
    eventSubscriptionResourceTest.updateEventSubscriptionPollInterval("WorkflowEventConsumer", 120);
    Glossary glossary = createEntity(createRequest("importExportTest"), ADMIN_AUTH_HEADERS);
    String user1 = USER1.getName();
    String user2 = USER2.getName();
    String team11 = TEAM11.getName();
    List<String> reviewerRef =
        listOf(user1, user2).stream().sorted(Comparator.naturalOrder()).toList();
    // PUT valid custom fields to the entity type
    // Create instances of CustomPropertyConfig
    CustomPropertyConfig dateTimeConfig =
        new CustomPropertyConfig().withConfig("dd-MM-yyyy HH:mm:ss");
    CustomPropertyConfig timeConfig = new CustomPropertyConfig().withConfig("HH:mm:ss");
    CustomPropertyConfig enumConfig =
        new CustomPropertyConfig()
            .withConfig(
                Map.of(
                    "values",
                    List.of("val1", "val2", "val3", "val4", "val5", "valwith\"quote\""),
                    "multiSelect",
                    true));

    // PUT valid custom fields to the entity type
    TypeResourceTest typeResourceTest = new TypeResourceTest();
    Type entityType =
        typeResourceTest.getEntityByName(
            Entity.GLOSSARY_TERM, "customProperties", ADMIN_AUTH_HEADERS);

    CustomProperty[] customProperties = {
      new CustomProperty()
          .withName("glossaryTermEmailCp")
          .withDescription("email type custom property")
          .withPropertyType(EMAIL_TYPE.getEntityReference()),
      new CustomProperty()
          .withName("glossaryTermDateCp")
          .withDescription("dd-MM-yyyy format time")
          .withPropertyType(DATECP_TYPE.getEntityReference())
          .withCustomPropertyConfig(new CustomPropertyConfig().withConfig("dd-MM-yyyy")),
      new CustomProperty()
          .withName("glossaryTermDateTimeCp")
          .withDescription("dd-MM-yyyy HH:mm:ss format dateTime")
          .withPropertyType(DATETIMECP_TYPE.getEntityReference())
          .withCustomPropertyConfig(dateTimeConfig),
      new CustomProperty()
          .withName("glossaryTermTimeCp")
          .withDescription("HH:mm:ss format time")
          .withPropertyType(TIMECP_TYPE.getEntityReference())
          .withCustomPropertyConfig(timeConfig),
      new CustomProperty()
          .withName("glossaryTermIntegerCp")
          .withDescription("integer type custom property")
          .withPropertyType(INT_TYPE.getEntityReference()),
      new CustomProperty()
          .withName("glossaryTermDurationCp")
          .withDescription("duration type custom property")
          .withPropertyType(DURATION_TYPE.getEntityReference()),
      new CustomProperty()
          .withName("glossaryTermMarkdownCp")
          .withDescription("markdown type custom property")
          .withPropertyType(MARKDOWN_TYPE.getEntityReference()),
      new CustomProperty()
          .withName("glossaryTermStringCp")
          .withDescription("string type custom property")
          .withPropertyType(STRING_TYPE.getEntityReference()),
      new CustomProperty()
          .withName("glossaryTermEntRefCp")
          .withDescription("entity Reference type custom property") // value includes fqn of entity
          .withPropertyType(ENTITY_REFERENCE_TYPE.getEntityReference())
          .withCustomPropertyConfig(new CustomPropertyConfig().withConfig(List.of("user"))),
      new CustomProperty()
          .withName("glossaryTermEntRefListCp")
          .withDescription(
              "entity Reference List type custom property") // value includes list of fqn of
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
          .withName("glossaryTermTimeIntervalCp")
          .withDescription("timeInterval type custom property in format starttime:endtime")
          .withPropertyType(TIME_INTERVAL_TYPE.getEntityReference()),
      new CustomProperty()
          .withName("glossaryTermNumberCp")
          .withDescription("numberCp")
          .withPropertyType(INT_TYPE.getEntityReference()),
      new CustomProperty()
          .withName("glossaryTermQueryCp")
          .withDescription("queryCp desc")
          .withPropertyType(SQLQUERY_TYPE.getEntityReference()),
      new CustomProperty()
          .withName("glossaryTermTimestampCp")
          .withDescription("timestamp type custom property")
          .withPropertyType(TIMESTAMP_TYPE.getEntityReference()),
      new CustomProperty()
          .withName("glossaryTermEnumCpSingle")
          .withDescription("enum type custom property with multiselect = false")
          .withPropertyType(ENUM_TYPE.getEntityReference())
          .withCustomPropertyConfig(
              new CustomPropertyConfig()
                  .withConfig(
                      Map.of(
                          "values",
                          List.of(
                              "\"single val with quotes\"",
                              "single1",
                              "single2",
                              "single3",
                              "single4"),
                          "multiSelect",
                          false))),
      new CustomProperty()
          .withName("glossaryTermEnumCpMulti")
          .withDescription("enum type custom property with multiselect = true")
          .withPropertyType(ENUM_TYPE.getEntityReference())
          .withCustomPropertyConfig(enumConfig),
      new CustomProperty()
          .withName("glossaryTermTableCol1Cp")
          .withDescription("table type custom property with 1 column")
          .withPropertyType(TABLE_TYPE.getEntityReference())
          .withCustomPropertyConfig(
              new CustomPropertyConfig()
                  .withConfig(
                      Map.of("columns", List.of("columnName1", "columnName2", "columnName3")))),
      new CustomProperty()
          .withName("glossaryTermTableCol3Cp")
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
    // CSV Header "parent", "name", "displayName", "description", "synonyms", "relatedTerms",
    // "references",
    // "tags", "reviewers", "owner", "glossaryStatus", "extension"
    // Create two records
    List<String> createRecords =
        listOf(
            String.format(
                ",g1,dsp1,\"dsc1,1\",h1;h2;h3,g1.g1t1;g2.g2t1,term1;http://term1,PII.None,user:%s,user:%s,%s,\"glossaryTermDateCp:18-09-2024;glossaryTermDateTimeCp:18-09-2024 01:09:34;glossaryTermDurationCp:PT5H30M10S;glossaryTermEmailCp:admin@open-metadata.org;glossaryTermEntRefCp:team:\"\"%s\"\";glossaryTermEntRefListCp:user:\"\"%s\"\"|user:\"\"%s\"\"\"",
                reviewerRef.get(0), user1, "Approved", team11, user1, user2),
            String.format(
                ",g2,dsp2,dsc3,h1;h3;h3,g1.g1t1;g2.g2t1,term2;https://term2,PII.NonSensitive,,user:%s,%s,\"glossaryTermEnumCpMulti:val1|val2|val3|val4|val5;glossaryTermEnumCpSingle:single1;glossaryTermIntegerCp:7777;glossaryTermMarkdownCp:# Sample Markdown Text;glossaryTermNumberCp:123456;\"\"glossaryTermQueryCp:select col,row from table where id ='30';\"\";glossaryTermStringCp:sample string content;glossaryTermTimeCp:10:08:45;glossaryTermTimeIntervalCp:1726142300000:17261420000;glossaryTermTimestampCp:1726142400000\"",
                user1, "Approved"),
            String.format(
                "importExportTest.g1,g11,dsp2,dsc11,h1;h3;h3,g1.g1t1;g2.g2t1,,,user:%s,team:%s,%s,",
                reviewerRef.getFirst(), team11, "Draft"));

    // Update terms with change in description
    List<String> updateRecords =
        listOf(
            String.format(
                ",g1,dsp1,new-dsc1,h1;h2;h3,g1.g1t1;g2.g2t1;importExportTest.g2,term1;http://term1,PII.None,user:%s,user:%s,%s,\"glossaryTermDateCp:18-09-2024;glossaryTermDateTimeCp:18-09-2024 01:09:34;glossaryTermDurationCp:PT5H30M10S;glossaryTermEmailCp:admin@open-metadata.org;glossaryTermEntRefCp:team:\"\"%s\"\";glossaryTermEntRefListCp:user:\"\"%s\"\"|user:\"\"%s\"\"\"",
                reviewerRef.getFirst(), user1, "Approved", team11, user1, user2),
            String.format(
                ",g2,dsp2,new-dsc3,h1;h3;h3,g1.g1t1;g2.g2t1;importExportTest.g1,term2;https://term2,PII.NonSensitive,user:%s,user:%s,%s,\"glossaryTermEnumCpMulti:val1|val2|val3|val4|val5;glossaryTermEnumCpSingle:single1;glossaryTermIntegerCp:7777;glossaryTermMarkdownCp:# Sample Markdown Text;glossaryTermNumberCp:123456;\"\"glossaryTermQueryCp:select col,row from table where id ='30';\"\";glossaryTermStringCp:sample string content;glossaryTermTimeCp:10:08:45;glossaryTermTimeIntervalCp:1726142300000:17261420000;glossaryTermTimestampCp:1726142400000\"",
                user1, user2, "Approved"),
            String.format(
                "importExportTest.g1,g11,dsp2,new-dsc11,h1;h3;h3,,,,user:%s,team:%s,%s,\"\"\"glossaryTermTableCol1Cp:row_1_col1_Value,,\"\";\"\"glossaryTermTableCol3Cp:row_1_col1_Value,row_1_col2_Value,row_1_col3_Value|row_2_col1_Value,row_2_col2_Value,row_2_col3_Value\"\"\"",
                reviewerRef.getFirst(), team11, "Draft"));

    // Add new row to existing rows
    List<String> newRecords =
        listOf(
            ",g3,dsp0,dsc0,h1;h2;h3,g1.g1t1;g2.g2t1,term0;http://term0,PII.Sensitive,,,Approved,\"\"\"glossaryTermTableCol1Cp:row_1_col1_Value,,\"\";\"\"glossaryTermTableCol3Cp:row_1_col1_Value,row_1_col2_Value,row_1_col3_Value|row_2_col1_Value,row_2_col2_Value,row_2_col3_Value\"\"\"");
    testImportExport(
        glossary.getName(), GlossaryCsv.HEADERS, createRecords, updateRecords, newRecords);

    // Reset poll Interval to allow Status change from workflow
    eventSubscriptionResourceTest.updateEventSubscriptionPollInterval("WorkflowEventConsumer", 10);
  }

  @Test
  void testGlossaryFeedTasks() throws IOException {
    // Create a new glossary
    CreateGlossary createGlossary =
        createRequest("testGlossary").withReviewers(listOf(USER1_REF, USER2_REF));
    Glossary glossary = createEntity(createGlossary, ADMIN_AUTH_HEADERS);
    String about = String.format("<#E::%s::%s>", Entity.GLOSSARY, glossary.getFullyQualifiedName());

    // Check that there are no tasks initially
    int totalTaskCount =
        feedTest
            .listTasks(about, null, null, null, null, ADMIN_AUTH_HEADERS)
            .getPaging()
            .getTotal();
    assertEquals(0, totalTaskCount);

    // Generate tasks related to the glossary - Add update description task thread for the glossary
    // from user1 to user2
    feedTest.createTaskThread(
        USER1.getName(),
        about,
        USER2.getEntityReference(),
        "old",
        "new",
        RequestDescription,
        authHeaders(USER1.getName()));

    // Check that a task has been added
    totalTaskCount =
        feedTest
            .listTasks(about, null, null, null, null, ADMIN_AUTH_HEADERS)
            .getPaging()
            .getTotal();
    assertEquals(1, totalTaskCount); // task at glossary level

    // Glossary term `glossaryTerm` created under glossary are in `Draft` status. Automatically a
    // Request Approval task is created.
    GlossaryTermResourceTest glossaryTermResourceTest = new GlossaryTermResourceTest();
    GlossaryTerm glossaryTerm =
        createGlossaryTerm(glossaryTermResourceTest, glossary, null, "glossaryTerm");

    waitForTaskToBeCreated(glossaryTerm.getFullyQualifiedName());

    // Check that a task has been added for the glossary term
    String termAbout =
        String.format("<#E::%s::%s>", Entity.GLOSSARY_TERM, glossaryTerm.getFullyQualifiedName());
    totalTaskCount =
        feedTest
            .listTasks(termAbout, null, null, null, null, ADMIN_AUTH_HEADERS)
            .getPaging()
            .getTotal();
    assertEquals(1, totalTaskCount); // approval task at glossary term level

    // Fetch the activity task feed for the glossary
    FeedResource.ThreadList threads =
        feedTest.listTasks(about, null, null, TaskStatus.Open, 100, ADMIN_AUTH_HEADERS);

    // Add update description task thread for the glossary term - same task should be reflected at
    // glossary feed
    feedTest.createTaskThread(
        USER1.getName(),
        termAbout,
        USER2.getEntityReference(),
        "old",
        "new",
        RequestDescription,
        authHeaders(USER1.getName()));

    // Check that the task count has increased
    totalTaskCount =
        feedTest
            .listTasks(about, null, null, null, null, ADMIN_AUTH_HEADERS)
            .getPaging()
            .getTotal();
    assertEquals(3, totalTaskCount);

    // Delete the glossary term and check that the task count at glossary level decreases
    glossaryTermResourceTest.deleteAndCheckEntity(glossaryTerm, true, true, ADMIN_AUTH_HEADERS);
    totalTaskCount =
        feedTest
            .listTasks(about, null, null, null, null, ADMIN_AUTH_HEADERS)
            .getPaging()
            .getTotal();
    assertEquals(1, totalTaskCount);
  }

  private void copyGlossaryTerm(GlossaryTerm from, GlossaryTerm to) {
    to.withGlossary(from.getGlossary())
        .withParent(from.getParent())
        .withFullyQualifiedName(from.getFullyQualifiedName())
        .withChangeDescription(from.getChangeDescription())
        .withVersion(from.getVersion())
        .withTags(from.getTags());
  }

  @Override
  public CreateGlossary createRequest(String name) {
    return new CreateGlossary().withName(name).withDescription("d");
  }

  @Override
  public void validateCreatedEntity(
      Glossary createdEntity, CreateGlossary createRequest, Map<String, String> authHeaders)
      throws HttpResponseException {
    TestUtils.validateTags(createRequest.getTags(), createdEntity.getTags());
  }

  @Override
  public void compareEntities(Glossary expected, Glossary patched, Map<String, String> authHeaders)
      throws HttpResponseException {
    // Entity specific validation
    TestUtils.validateTags(expected.getTags(), patched.getTags());
    TestUtils.assertEntityReferences(expected.getReviewers(), patched.getReviewers());
  }

  @Override
  public Glossary validateGetWithDifferentFields(Glossary entity, boolean byName)
      throws HttpResponseException {
    String fields = "";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNull(entity.getOwners());
    assertTrue(entity.getTags().isEmpty());

    fields = "owners,tags";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    // Checks for other owner, tags, and followers is done in the base class
    return entity;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    assertCommonFieldChange(fieldName, expected, actual);
  }

  private GlossaryTerm createGlossaryTerm(
      GlossaryTermResourceTest resource, Glossary glossary, GlossaryTerm parent, String name)
      throws HttpResponseException {
    return createGlossaryTerm(resource, glossary, parent, name, ProviderType.USER);
  }

  private GlossaryTerm createGlossaryTerm(
      GlossaryTermResourceTest resource,
      Glossary glossary,
      GlossaryTerm parent,
      String name,
      ProviderType provider)
      throws HttpResponseException {
    CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withName(name)
            .withDescription("d")
            .withGlossary(glossary.getFullyQualifiedName())
            .withParent(getFqn(parent))
            .withProvider(provider);
    return resource.createEntity(create, ADMIN_AUTH_HEADERS);
  }

  private GlossaryTerm createGlossaryTermWithTags(
      GlossaryTermResourceTest resource,
      Glossary glossary,
      GlossaryTerm parent,
      String name,
      List<TagLabel> tags)
      throws HttpResponseException {
    CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withName(name)
            .withDescription("d")
            .withGlossary(glossary.getFullyQualifiedName())
            .withParent(getFqn(parent))
            .withProvider(ProviderType.USER)
            .withTags(tags);
    return resource.createEntity(create, ADMIN_AUTH_HEADERS);
  }

  public void renameGlossaryAndCheck(Glossary glossary, String newName) throws IOException {
    String oldName = glossary.getName();
    String json = JsonUtils.pojoToJson(glossary);
    ChangeDescription change = getChangeDescription(glossary, MINOR_UPDATE);
    fieldUpdated(change, "name", oldName, newName);
    glossary.setName(newName);
    patchEntityAndCheck(glossary, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    Glossary ret = getEntity(glossary.getId(), ADMIN_AUTH_HEADERS);

    // Now check all the children are renamed
    // List children glossary terms with this term as the parent and ensure rename
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("glossary", ret.getId().toString());
    List<GlossaryTerm> children =
        new GlossaryTermResourceTest().listEntities(queryParams, ADMIN_AUTH_HEADERS).getData();
    for (GlossaryTerm child : listOrEmpty(children)) {
      assertTrue(child.getFullyQualifiedName().startsWith(ret.getFullyQualifiedName()));
    }
  }

  /** Change the parent of a glossary term to another glossary term then move it back to the previous hierarchy */
  private GlossaryTerm moveGlossaryTermAndBack(
      EntityReference newGlossary, EntityReference newParent, GlossaryTerm term, Table table)
      throws IOException {
    EntityReference previousParent = term.getParent();
    EntityReference previousGlossary = term.getGlossary();

    // Change the parent to new parent
    GlossaryTerm updatedTerm = moveGlossaryTerm(newGlossary, newParent, term, table);
    // Change the parent back to old parent
    return moveGlossaryTerm(previousGlossary, previousParent, updatedTerm, table);
  }

  private GlossaryTerm moveGlossaryTerm(
      EntityReference newGlossary, EntityReference newParent, GlossaryTerm term, Table table)
      throws IOException {
    GlossaryTermResourceTest glossaryTermResourceTest = new GlossaryTermResourceTest();
    String previousTermFqn = term.getFullyQualifiedName();

    // Update the parent
    GlossaryTerm updatedTerm =
        glossaryTermResourceTest.moveGlossaryTerm(newGlossary, newParent, term);
    assertTagLabelsChanged(table, previousTermFqn, updatedTerm.getFullyQualifiedName());
    return updatedTerm;
  }

  private void assertTagPrefixAbsent(List<TagLabel> labels, String prefix) {
    for (TagLabel tag : labels) {
      if (tag.getSource() == TagSource.GLOSSARY) {
        assertFalse(tag.getTagFQN().startsWith(prefix), tag.getTagFQN());
      }
    }
  }

  private void assertTagLabelsChanged(Table table, String previousTermFqn, String newTermFqn)
      throws HttpResponseException {
    TableResourceTest tableResourceTest = new TableResourceTest();
    table = tableResourceTest.getEntity(table.getId(), "columns,tags", ADMIN_AUTH_HEADERS);

    // Ensure the previous term is no longer used as tags due tag label renaming
    if (!previousTermFqn.equals(newTermFqn)) { // Old and new parent are different
      assertTagPrefixAbsent(table.getTags(), previousTermFqn);
      assertTagPrefixAbsent(table.getColumns().get(0).getTags(), previousTermFqn);
    }
  }

  public static void waitForTaskToBeCreated(String fullyQualifiedName) {
    waitForTaskToBeCreated(fullyQualifiedName, 60000L * 2);
  }

  public static void waitForTaskToBeCreated(String fullyQualifiedName, long timeout) {
    String entityLink =
        new MessageParser.EntityLink(Entity.GLOSSARY_TERM, fullyQualifiedName).getLinkString();
    Awaitility.await(
            String.format(
                "Wait for Task to be Created for Glossary Term: '%s'", fullyQualifiedName))
        .ignoreExceptions()
        .pollInterval(Duration.ofMillis(2000L))
        .atMost(Duration.ofMillis(timeout))
        .until(
            () ->
                WorkflowHandler.getInstance()
                    .isActivityWithVariableExecuting(
                        "ApproveGlossaryTerm.approvalTask",
                        getNamespacedVariableName(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE),
                        entityLink));
  }

  @Test
  void testBulkTermCountLoading() throws IOException {
    // Create multiple glossaries
    List<Glossary> glossaries = new ArrayList<>();
    Map<String, Integer> expectedTermCounts = new HashMap<>();

    // Create 5 glossaries with different numbers of terms
    for (int i = 0; i < 5; i++) {
      CreateGlossary createGlossary = createRequest("test-glossary-" + i, "", "", null);
      Glossary glossary = createEntity(createGlossary, ADMIN_AUTH_HEADERS);
      glossaries.add(glossary);

      // Create different number of terms for each glossary
      int termCount = (i + 1) * 2; // 2, 4, 6, 8, 10 terms
      for (int j = 0; j < termCount; j++) {
        CreateGlossaryTerm createTerm =
            new CreateGlossaryTerm()
                .withName("term-" + i + "-" + j)
                .withDescription("Test term")
                .withGlossary(glossary.getFullyQualifiedName());
        new GlossaryTermResourceTest().createEntity(createTerm, ADMIN_AUTH_HEADERS);
      }
      expectedTermCounts.put(glossary.getName(), termCount);
    }

    // Test: List glossaries with termCount field and verify counts are correct
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("fields", "termCount");
    queryParams.put("limit", "10");

    ResultList<Glossary> resultList = listEntities(queryParams, ADMIN_AUTH_HEADERS);

    // Verify all glossaries have correct term counts
    for (Glossary glossary : resultList.getData()) {
      if (expectedTermCounts.containsKey(glossary.getName())) {
        assertEquals(
            expectedTermCounts.get(glossary.getName()),
            glossary.getTermCount(),
            "Term count for glossary " + glossary.getName() + " should match expected value");
      }
    }

    // Cleanup
    for (Glossary glossary : glossaries) {
      deleteEntity(glossary.getId(), true, true, ADMIN_AUTH_HEADERS);
    }
  }

  @Test
  void testGlossaryPaginationWithTermCount() throws IOException {
    // Create glossaries with names that ensure deterministic ordering
    List<Glossary> createdGlossaries = new ArrayList<>();
    Map<String, Integer> glossaryTermCounts = new HashMap<>();

    // Create 10 glossaries with predictable names for ordering
    for (int i = 0; i < 10; i++) {
      String glossaryName = String.format("pagination-test-%02d", i);
      CreateGlossary createGlossary = createRequest(glossaryName, "", "", null);
      Glossary glossary = createEntity(createGlossary, ADMIN_AUTH_HEADERS);
      createdGlossaries.add(glossary);

      // Create one term per glossary for simplicity
      CreateGlossaryTerm createTerm =
          new CreateGlossaryTerm()
              .withName("term-" + i)
              .withDescription("Test term")
              .withGlossary(glossary.getFullyQualifiedName());
      new GlossaryTermResourceTest().createEntity(createTerm, ADMIN_AUTH_HEADERS);
      glossaryTermCounts.put(glossary.getName(), 1);
    }

    // Test pagination with termCount field
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("fields", "termCount");
    queryParams.put("limit", "3");

    // Get first page
    ResultList<Glossary> firstPage = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(3, firstPage.getData().size(), "First page should have 3 items");

    // Verify term counts are included
    for (Glossary glossary : firstPage.getData()) {
      if (glossaryTermCounts.containsKey(glossary.getName())) {
        assertEquals(
            1, glossary.getTermCount(), "Term count should be 1 for " + glossary.getName());
      }
    }

    // Get second page using after cursor
    assertNotNull(firstPage.getPaging().getAfter(), "After cursor should be present");
    queryParams.put("after", firstPage.getPaging().getAfter());

    ResultList<Glossary> secondPage = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(3, secondPage.getData().size(), "Second page should have 3 items");

    // Verify no duplicate glossaries between pages
    Set<String> firstPageNames =
        firstPage.getData().stream().map(Glossary::getName).collect(Collectors.toSet());
    Set<String> secondPageNames =
        secondPage.getData().stream().map(Glossary::getName).collect(Collectors.toSet());

    assertTrue(
        firstPageNames.stream().noneMatch(secondPageNames::contains),
        "No glossary should appear in both pages");

    // Verify term counts are still included in paginated results
    for (Glossary glossary : secondPage.getData()) {
      if (glossaryTermCounts.containsKey(glossary.getName())) {
        assertEquals(
            1, glossary.getTermCount(), "Term count should be 1 for " + glossary.getName());
      }
    }

    // Cleanup
    for (Glossary glossary : createdGlossaries) {
      deleteEntity(glossary.getId(), true, true, ADMIN_AUTH_HEADERS);
    }
  }
}
