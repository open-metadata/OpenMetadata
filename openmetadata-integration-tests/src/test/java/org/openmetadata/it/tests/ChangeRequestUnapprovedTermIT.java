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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.it.tests.ChangeRequestITSupport.awaitOpenApprovalTask;
import static org.openmetadata.it.tests.ChangeRequestITSupport.deployHookWorkflowFor;
import static org.openmetadata.it.tests.ChangeRequestITSupport.filterScopedTo;
import static org.openmetadata.it.tests.ChangeRequestITSupport.requestsFor;
import static org.openmetadata.it.tests.ChangeRequestITSupport.resolveAs;
import static org.openmetadata.it.tests.ChangeRequestITSupport.sendAsAdmin;

import jakarta.ws.rs.core.Response;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestStatus;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * An approval workflow holds an edit that applies a glossary term that is not Approved for review
 * like any other. When the review approves it, the edit is published, but the term is held back as
 * a pending label, as any write holds it, until the term itself is approved.
 */
// Each test deploys its own Enforce workflow, which receives the signals of every event on its
// entity type, so the class runs alone instead of beside the shared-lane tests.
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class ChangeRequestUnapprovedTermIT {
  private static final String GATE_TAGS = "\"tags\"";
  private static final String JSON_PATCH = "application/json-patch+json";

  @Test
  void heldEditWithUnapprovedTermWaitsForReview(TestNamespace ns) throws Exception {
    GlossaryTerm draft = draftTerm(ns);
    Table table = gatedTable(ns, "crdpatch", GATE_TAGS);

    HttpResponse<String> response = patchTable(table, addTableTag(draft));

    assertEquals(Response.Status.ACCEPTED.getStatusCode(), response.statusCode(), response.body());
    assertEquals(1, requestsFor(table.getId()).size());
    assertTrue(tagFqns(table).isEmpty());
    assertTrue(pendingTargets(draft).isEmpty());
  }

  @Test
  void approvingTheHeldEditHoldsTheUnapprovedTermBack(TestNamespace ns) throws Exception {
    GlossaryTerm draft = draftTerm(ns);
    Table table = gatedTable(ns, "crdapprove", GATE_TAGS);
    HttpResponse<String> held = patchTable(table, addTableTag(draft));
    assertEquals(Response.Status.ACCEPTED.getStatusCode(), held.statusCode(), held.body());

    approveAndAwaitApplied(table);

    assertTrue(tagFqns(table).isEmpty());
    assertEquals(1, pendingTargets(draft).size());
  }

  @Test
  void heldPatchApplyingApprovedTermIsStillHeld(TestNamespace ns) throws Exception {
    GlossaryTerm approved = approvedTerm(ns);
    Table table = gatedTable(ns, "crapatch", GATE_TAGS);

    HttpResponse<String> response = patchTable(table, addTableTag(approved));

    assertEquals(Response.Status.ACCEPTED.getStatusCode(), response.statusCode(), response.body());
    assertEquals(1, requestsFor(table.getId()).size());
    assertTrue(tagFqns(table).isEmpty());
  }

  // A term demoted after it was applied stays on its asset; an edit that keeps it is still held.
  @Test
  void heldEditKeepingADeprecatedTermIsStillHeld(TestNamespace ns) throws Exception {
    GlossaryTerm term = approvedTerm(ns);
    CreateTable create = tableRequest(ns, DatabaseSchemaTestFactory.createSimple(ns), "crdep");
    Table table = createTable(create.withTags(List.of(label(term))));
    deprecate(term);
    gate(ns, table, GATE_TAGS);

    HttpResponse<String> response =
        patchTable(
            table,
            "[{\"op\":\"add\",\"path\":\"/tags/-\",\"value\":%s}]"
                .formatted(JsonUtils.pojoToJson(SharedEntities.get().PII_SENSITIVE_TAG_LABEL)));

    assertEquals(Response.Status.ACCEPTED.getStatusCode(), response.statusCode(), response.body());
    assertEquals(1, requestsFor(table.getId()).size());
    assertEquals(List.of(term.getFullyQualifiedName()), tagFqns(table));
  }

  // A term demoted after its edit was held is held back when the approved edit is published.
  @Test
  void approvedEditWhoseTermWasDemotedHoldsTheTermBack(TestNamespace ns) throws Exception {
    GlossaryTerm term = approvedTerm(ns);
    Table table = gatedTable(ns, "crdemote", GATE_TAGS);
    HttpResponse<String> held = patchTable(table, addTableTag(term));
    assertEquals(Response.Status.ACCEPTED.getStatusCode(), held.statusCode(), held.body());
    deprecate(term);

    approveAndAwaitApplied(table);

    assertTrue(tagFqns(table).isEmpty());
    assertEquals(1, pendingTargets(term).size());
  }

  private static void approveAndAwaitApplied(Table table) {
    resolveAs(
        SdkClients.user1Client(),
        awaitOpenApprovalTask(table.getFullyQualifiedName()),
        "approve",
        TaskResolutionType.Approved,
        null);
    Awaitility.await("held edit applied")
        .atMost(Duration.ofSeconds(120))
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () -> requestsFor(table.getId()).getFirst().getStatus() == ChangeRequestStatus.APPLIED);
  }

  private static List<String> pendingTargets(GlossaryTerm term) {
    return Entity.getCollectionDAO()
        .tagUsageDAO()
        .listPendingTargetHashes(
            TagLabel.TagSource.GLOSSARY.ordinal(),
            FullyQualifiedName.buildHash(term.getFullyQualifiedName()),
            "",
            100);
  }

  private static Table gatedTable(TestNamespace ns, String name, String gatedField) {
    CreateTable create = tableRequest(ns, DatabaseSchemaTestFactory.createSimple(ns), name);
    return gate(ns, createTable(create), gatedField);
  }

  private static Table gate(TestNamespace ns, Table table, String gatedField) {
    deployHookWorkflowFor(
        ns,
        Entity.TABLE,
        gatedField,
        "",
        filterScopedTo(Entity.TABLE, table.getFullyQualifiedName()));
    return table;
  }

  private static CreateTable tableRequest(TestNamespace ns, DatabaseSchema schema, String name) {
    return new CreateTable()
        .withName(ns.shortPrefix(name))
        .withDatabaseSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)));
  }

  // The owner reviews a table's change requests; without one the review approves itself.
  private static Table createTable(CreateTable create) {
    return SdkClients.adminClient()
        .tables()
        .create(
            JsonUtils.deepCopy(create, CreateTable.class)
                .withOwners(List.of(SharedEntities.get().USER1.getEntityReference())));
  }

  private static HttpResponse<String> patchTable(Table table, String opsJson) throws Exception {
    return sendAsAdmin("PATCH", "/v1/tables/%s".formatted(table.getId()), JSON_PATCH, opsJson);
  }

  private static String addTableTag(GlossaryTerm term) {
    return "[{\"op\":\"add\",\"path\":\"/tags\",\"value\":[%s]}]"
        .formatted(JsonUtils.pojoToJson(label(term)));
  }

  private static List<String> tagFqns(Table table) {
    return listOrEmpty(
            SdkClients.adminClient().tables().get(table.getId().toString(), "tags").getTags())
        .stream()
        .map(TagLabel::getTagFQN)
        .toList();
  }

  private static GlossaryTerm approvedTerm(TestNamespace ns) {
    GlossaryTerm term =
        createTerm(GlossaryTestFactory.createForStatusTests(ns), ns.shortPrefix("term"));
    assertEquals(EntityStatus.APPROVED, term.getEntityStatus());
    return term;
  }

  /** A term whose glossary has reviewers is not Approved until they approve it. */
  private static GlossaryTerm draftTerm(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary =
        ns.trackRoot(
            Entity.GLOSSARY,
            client
                .glossaries()
                .create(
                    new CreateGlossary()
                        .withName(ns.prefix(GlossaryTestFactory.STATUS_TEST_GLOSSARY_PREFIX))
                        .withDescription("Glossary whose terms wait for review")
                        .withReviewers(
                            List.of(client.users().getByName("admin").getEntityReference()))));
    GlossaryTerm term = createTerm(glossary, ns.shortPrefix("draft_term"));
    assertTrue(EntityStatus.APPROVED != term.getEntityStatus(), term.getEntityStatus()::toString);
    return term;
  }

  private static GlossaryTerm createTerm(Glossary glossary, String name) {
    return SdkClients.adminClient()
        .glossaryTerms()
        .create(
            new CreateGlossaryTerm()
                .withName(name)
                .withGlossary(glossary.getFullyQualifiedName())
                .withDescription("Term for held-edit admission"));
  }

  private static void deprecate(GlossaryTerm term) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm fetched = client.glossaryTerms().get(term.getId().toString());
    fetched.setEntityStatus(EntityStatus.DEPRECATED);
    client.glossaryTerms().update(term.getId().toString(), fetched);
  }

  private static TagLabel label(GlossaryTerm term) {
    return new TagLabel()
        .withTagFQN(term.getFullyQualifiedName())
        .withSource(TagLabel.TagSource.GLOSSARY)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }
}
