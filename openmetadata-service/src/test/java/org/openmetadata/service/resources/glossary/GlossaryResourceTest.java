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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.csv.CsvUtil.recordToString;
import static org.openmetadata.csv.EntityCsv.entityNotFound;
import static org.openmetadata.csv.EntityCsvTest.assertRows;
import static org.openmetadata.csv.EntityCsvTest.assertSummary;
import static org.openmetadata.csv.EntityCsvTest.createCsv;
import static org.openmetadata.csv.EntityCsvTest.getFailedRecord;
import static org.openmetadata.schema.type.ProviderType.SYSTEM;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.EntityUtil.getEntityReference;
import static org.openmetadata.service.util.EntityUtil.getFqn;
import static org.openmetadata.service.util.EntityUtil.toTagLabels;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.validateTagLabel;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.ws.rs.core.Response.Status;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.GlossaryRepository.GlossaryCsv;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.TestUtils;
import org.openmetadata.service.util.TestUtils.UpdateType;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class GlossaryResourceTest extends EntityResourceTest<Glossary, CreateGlossary> {
  public GlossaryResourceTest() {
    // TODO add system glossary
    super(Entity.GLOSSARY, Glossary.class, GlossaryResource.GlossaryList.class, "glossaries", GlossaryResource.FIELDS);
    supportsEmptyDescription = false;
  }

  public void setupGlossaries() throws IOException {
    GlossaryResourceTest glossaryResourceTest = new GlossaryResourceTest();
    CreateGlossary createGlossary = glossaryResourceTest.createRequest("g1", "", "", null);
    GLOSSARY1 = glossaryResourceTest.createAndCheckEntity(createGlossary, ADMIN_AUTH_HEADERS);
    GLOSSARY1_REF = GLOSSARY1.getEntityReference();

    createGlossary = glossaryResourceTest.createRequest("g2", "", "", null);
    GLOSSARY2 = glossaryResourceTest.createAndCheckEntity(createGlossary, ADMIN_AUTH_HEADERS);
    GLOSSARY2_REF = GLOSSARY2.getEntityReference();

    GlossaryTermResourceTest glossaryTermResourceTest = new GlossaryTermResourceTest();
    CreateGlossaryTerm createGlossaryTerm =
        glossaryTermResourceTest
            .createRequest("g1t1", "", "", null)
            .withRelatedTerms(null)
            .withGlossary(GLOSSARY1_REF)
            .withTags(List.of(PII_SENSITIVE_TAG_LABEL, PERSONAL_DATA_TAG_LABEL))
            .withReviewers(GLOSSARY1.getReviewers());
    GLOSSARY1_TERM1 = glossaryTermResourceTest.createAndCheckEntity(createGlossaryTerm, ADMIN_AUTH_HEADERS);
    GLOSSARY1_TERM1_REF = GLOSSARY1_TERM1.getEntityReference();
    GLOSSARY1_TERM1_LABEL = EntityUtil.toTagLabel(GLOSSARY1_TERM1);
    validateTagLabel(GLOSSARY1_TERM1_LABEL);

    createGlossaryTerm =
        glossaryTermResourceTest
            .createRequest("g2t1", "", "", null)
            .withRelatedTerms(List.of(GLOSSARY1_TERM1_REF))
            .withGlossary(GLOSSARY2_REF)
            .withReviewers(GLOSSARY1.getReviewers());
    GLOSSARY2_TERM1 = glossaryTermResourceTest.createAndCheckEntity(createGlossaryTerm, ADMIN_AUTH_HEADERS);
    GLOSSARY2_TERM1_REF = GLOSSARY2_TERM1.getEntityReference();
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
    ChangeDescription change = getChangeDescription(glossary.getVersion());
    fieldAdded(change, "reviewers", List.of(USER1_REF));
    glossary = patchEntityAndCheck(glossary, origJson, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);

    // Add another reviewer USER2 in PATCH request
    origJson = JsonUtils.pojoToJson(glossary);
    glossary.withReviewers(List.of(USER1_REF, USER2_REF));
    change = getChangeDescription(glossary.getVersion());
    fieldAdded(change, "reviewers", List.of(USER2_REF));
    glossary = patchEntityAndCheck(glossary, origJson, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);

    // Remove a reviewer USER1 in PATCH request
    origJson = JsonUtils.pojoToJson(glossary);
    glossary.withReviewers(List.of(USER2_REF));
    change = getChangeDescription(glossary.getVersion());
    fieldDeleted(change, "reviewers", List.of(USER1_REF));
    patchEntityAndCheck(glossary, origJson, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);
  }

  @Test
  void patch_renameSystemGlossary_400() throws IOException {
    // Renaming of system glossary and terms are not allowed
    CreateGlossary create = createRequest("renameGlossaryNotAllowed").withProvider(ProviderType.SYSTEM);
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
        CatalogExceptionMessage.systemEntityRenameNotAllowed("renameGlossaryNotAllowed", Entity.GLOSSARY));
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

    // Create a table with all the terms as tag labels
    TableResourceTest tableResourceTest = new TableResourceTest();
    List<TagLabel> tagLabels = toTagLabels(t1, t11, t12, t2, t21, t22);
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

    //
    // Change the glossary renameGlossary to newRenameGlossary and ensure the children FQNs are changed
    // Also ensure the table tag label names are also changed
    //
    renameGlossaryAndCheck(glossary, "newRenameGlossary");
    table = tableResourceTest.getEntity(table.getId(), "columns,tags", ADMIN_AUTH_HEADERS);
    assertTagPrefixAbsent(table.getTags(), "renameGlossary");
    assertTagPrefixAbsent(table.getColumns().get(0).getTags(), "renameGlossary");
  }

  @Test
  void patch_moveGlossaryTerm(TestInfo test) throws IOException {
    //
    // These test move a glossary term to different parts of the glossary hierarchy and to different glossaries
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
    List<TagLabel> tagLabels = toTagLabels(t1, t11, t111, t12, t121, t13, t131, t2, t21, t211, h1, h11, h111);
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

    for (int i = 0; i < scenarios.length; i++) {
      GlossaryTerm termToMove = (GlossaryTerm) scenarios[i][0];

      // Moving to another glossary term as parent
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
            "Scenario iteration [{}, {}] move {} from glossary{} parent {} to glossary {} and parent {}",
            i,
            j,
            getFqn(termToMove),
            getFqn(termToMove.getGlossary()),
            getFqn(termToMove.getParent()),
            getFqn(newParent),
            getFqn(newGlossary));
        updatedTerm = moveGlossaryTermAndBack(newGlossary, newParent, termToMove, table);
        copyGlossaryTerm(updatedTerm, termToMove);
      }
    }
  }

  @Test
  void testCsvDocumentation() throws HttpResponseException {
    assertEquals(GlossaryCsv.DOCUMENTATION, getCsvDocumentation());
  }

  @Test
  void testImportInvalidCsv() throws IOException {
    String glossaryName = "invalidCsv";
    createEntity(createRequest(glossaryName), ADMIN_AUTH_HEADERS);

    // Create glossaryTerm with invalid parent
    String resultsHeader = recordToString(EntityCsv.getResultHeaders(GlossaryCsv.HEADERS));
    String record = "invalidParent,g1,dsp1,dsc1,h1;h2;h3,,term1;http://term1,Tier.Tier1";
    String csv = createCsv(GlossaryCsv.HEADERS, listOf(record), null);
    CsvImportResult result = importCsv(glossaryName, csv, false);
    assertSummary(result, CsvImportResult.Status.FAILURE, 2, 1, 1);
    String[] expectedRows = {resultsHeader, getFailedRecord(record, entityNotFound(0, "invalidParent"))};
    assertRows(result, expectedRows);

    // Create glossaryTerm with invalid tags field
    record = ",g1,dsp1,dsc1,h1;h2;h3,,term1;http://term1,Tag.invalidTag";
    csv = createCsv(GlossaryCsv.HEADERS, listOf(record), null);
    result = importCsv(glossaryName, csv, false);
    assertSummary(result, CsvImportResult.Status.FAILURE, 2, 1, 1);
    expectedRows = new String[] {resultsHeader, getFailedRecord(record, entityNotFound(7, "Tag.invalidTag"))};
    assertRows(result, expectedRows);
  }

  @Test
  void testGlossaryImportExport() throws IOException {
    Glossary glossary = createEntity(createRequest("importExportTest"), ADMIN_AUTH_HEADERS);

    // CSV Header "parent" "name" "displayName" "description" "synonyms" "relatedTerms" "references" "tags"
    // Create two records
    List<String> createRecords =
        listOf(
            ",g1,dsp1,\"dsc1,1\",h1;h2;h3,,term1;http://term1,Tier.Tier1",
            ",g2,dsp2,dsc3,h1;h3;h3,,term2;https://term2,Tier.Tier2",
            "importExportTest.g1,g11,dsp2,dsc11,h1;h3;h3,,,");

    // Update terms with change in description
    List<String> updateRecords =
        listOf(
            ",g1,dsp1,new-dsc1,h1;h2;h3,,term1;http://term1,Tier.Tier1",
            ",g2,dsp2,new-dsc3,h1;h3;h3,,term2;https://term2,Tier.Tier2",
            "importExportTest.g1,g11,dsp2,new-dsc11,h1;h3;h3,,,");

    // Add new row to existing rows
    List<String> newRecords = listOf(",g3,dsp0,dsc0,h1;h2;h3,,term0;http://term0,Tier.Tier3");
    testImportExport(glossary.getName(), GlossaryCsv.HEADERS, createRecords, updateRecords, newRecords);
  }

  private void copyGlossaryTerm(GlossaryTerm from, GlossaryTerm to) {
    to.withGlossary(from.getGlossary())
        .withParent(from.getParent())
        .withFullyQualifiedName(from.getFullyQualifiedName())
        .withChangeDescription(from.getChangeDescription())
        .withVersion(from.getVersion());
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
  public Glossary validateGetWithDifferentFields(Glossary entity, boolean byName) throws HttpResponseException {
    String fields = "";
    entity =
        byName
            ? getEntityByName(entity.getName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNull(entity.getOwner(), entity.getTags());

    fields = "owner,tags";
    entity =
        byName
            ? getEntityByName(entity.getName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    // Checks for other owner, tags, and followers is done in the base class
    return entity;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == actual) {
      return;
    }
    if (fieldName.equals("reviewers")) {
      @SuppressWarnings("unchecked")
      List<EntityReference> expectedRefs = (List<EntityReference>) expected;
      List<EntityReference> actualRefs = JsonUtils.readObjects(actual.toString(), EntityReference.class);
      assertEntityReferences(expectedRefs, actualRefs);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  private GlossaryTerm createGlossaryTerm(
      GlossaryTermResourceTest resource, Glossary glossary, GlossaryTerm parent, String name)
      throws HttpResponseException {
    return createGlossaryTerm(resource, glossary, parent, name, ProviderType.USER);
  }

  private GlossaryTerm createGlossaryTerm(
      GlossaryTermResourceTest resource, Glossary glossary, GlossaryTerm parent, String name, ProviderType provider)
      throws HttpResponseException {
    CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withName(name)
            .withDescription("d")
            .withGlossary(glossary.getEntityReference())
            .withParent(getEntityReference(parent))
            .withProvider(provider);
    return resource.createEntity(create, ADMIN_AUTH_HEADERS);
  }

  public void renameGlossaryAndCheck(Glossary glossary, String newName) throws IOException {
    String oldName = glossary.getName();
    String json = JsonUtils.pojoToJson(glossary);
    ChangeDescription change = getChangeDescription(glossary.getVersion());
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
      EntityReference newGlossary, EntityReference newParent, GlossaryTerm term, Table table) throws IOException {
    EntityReference previousParent = term.getParent();
    EntityReference previousGlossary = term.getGlossary();

    // Change the parent to new parent
    GlossaryTerm updatedTerm = moveGlossaryTerm(newGlossary, newParent, term, table);
    // Change the parent back to old parent
    return moveGlossaryTerm(previousGlossary, previousParent, updatedTerm, table);
  }

  private GlossaryTerm moveGlossaryTerm(
      EntityReference newGlossary, EntityReference newParent, GlossaryTerm term, Table table) throws IOException {
    GlossaryTermResourceTest glossaryTermResourceTest = new GlossaryTermResourceTest();
    String previousTermFqn = term.getFullyQualifiedName();

    // Update the parent
    GlossaryTerm updatedTerm = glossaryTermResourceTest.moveGlossaryTerm(newGlossary, newParent, term);
    assertTagLabelsChanged(table, previousTermFqn, updatedTerm.getFullyQualifiedName());
    return updatedTerm;
  }

  private void assertTagPrefixAbsent(List<TagLabel> labels, String prefix) {
    for (TagLabel tag : labels) {
      assertFalse(tag.getTagFQN().startsWith(prefix), tag.getTagFQN());
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
}
