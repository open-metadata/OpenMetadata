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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.ChangeRequestITSupport.*;

import java.io.StringReader;
import java.io.StringWriter;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.util.BulkApi;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestStatus;
import org.openmetadata.schema.governance.changeRequest.MutationOpType;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.classification.TagService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.RestUtil;

// Each test deploys its own Enforce workflow, which receives the signals of every event on its
// entity type, so the class runs alone instead of beside the shared-lane tests.
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class ChangeRequestImportAndBulkIT {
  private static final String TERM_DESCRIPTION = "published term description";
  private static final String PENDING_DETAIL = "Pending approval";

  private GlossaryTerm gatedTerm(TestNamespace ns, Glossary glossary) {
    GlossaryTerm term =
        SdkClients.adminClient()
            .glossaryTerms()
            .create(
                new CreateGlossaryTerm()
                    .withName(ns.shortPrefix("crterm"))
                    .withGlossary(glossary.getFullyQualifiedName())
                    .withDescription(TERM_DESCRIPTION));
    deployHookWorkflowFor(
        ns,
        Entity.GLOSSARY_TERM,
        "\"description\"",
        "",
        filterScopedTo(Entity.GLOSSARY_TERM, term.getFullyQualifiedName()));
    return term;
  }

  private Glossary plainGlossary(TestNamespace ns) {
    return ns.trackRoot(
        Entity.GLOSSARY,
        SdkClients.adminClient()
            .glossaries()
            .create(new CreateGlossary().withName(ns.shortPrefix("crcsv")).withDescription("csv")));
  }

  private CsvImportResult importEdited(Glossary glossary, boolean dryRun) {
    String exported = SdkClients.adminClient().glossaries().exportCsv(glossary.getName());
    String edited = exported.replace(TERM_DESCRIPTION, "edited through csv");
    String result =
        SdkClients.adminClient().glossaries().importCsv(glossary.getName(), edited, dryRun);
    return JsonUtils.readValue(result, CsvImportResult.class);
  }

  @Test
  void csvImportOfGatedFieldIsStagedNotPublished(TestNamespace ns) {
    Glossary glossary = plainGlossary(ns);
    GlossaryTerm term = gatedTerm(ns, glossary);
    CsvImportResult result = importEdited(glossary, false);
    assertEquals(1, result.getNumberOfRowsPendingApproval());
    assertEquals(
        result.getNumberOfRowsProcessed(),
        result.getNumberOfRowsPassed() + result.getNumberOfRowsFailed());
    assertTrue(result.getImportResultsCsv().contains(PENDING_DETAIL));
    GlossaryTerm after = SdkClients.adminClient().glossaryTerms().get(term.getId().toString(), "");
    assertEquals(TERM_DESCRIPTION, after.getDescription());
    assertEquals("admin", onlyPendingRequest(term.getId()).getRequestedBy());
  }

  // A CSV row with an empty owner column clears the term's owners; the ungoverned term shows the
  // import does, and the governed one holds it for review.
  @Test
  void csvImportClearingGatedOwnersIsHeld(TestNamespace ns) throws Exception {
    EntityReference owner = SharedEntities.get().USER2.getEntityReference();
    Glossary glossary = plainGlossary(ns);
    GlossaryTerm ungoverned = ownedTerm(ns, glossary, "crfree", owner);
    GlossaryTerm governed = ownedTerm(ns, glossary, "crowned", owner);
    deployHookWorkflowFor(
        ns,
        Entity.GLOSSARY_TERM,
        "\"owners\"",
        "",
        filterScopedTo(Entity.GLOSSARY_TERM, governed.getFullyQualifiedName()));

    String exported = SdkClients.adminClient().glossaries().exportCsv(glossary.getName());
    CsvImportResult result =
        JsonUtils.readValue(
            SdkClients.adminClient()
                .glossaries()
                .importCsv(glossary.getName(), withoutColumn(exported, "owner"), false),
            CsvImportResult.class);

    assertEquals(1, result.getNumberOfRowsPendingApproval(), result.getImportResultsCsv());
    assertTrue(ownerIds(ungoverned.getId()).isEmpty(), "the import clears an empty owner column");
    assertEquals(List.of(owner.getId()), ownerIds(governed.getId()));
    assertTrue(
        onlyPendingRequest(governed.getId()).getActiveRevision().getOps().stream()
            .anyMatch(
                op ->
                    Entity.FIELD_OWNERS.equals(op.getField())
                        && op.getOp() == MutationOpType.REMOVE));
  }

  // A PUT that leaves out a term's synonyms clears them; the governed term holds that for review.
  @Test
  void glossaryTermPutLeavingOutGatedSynonymsIsHeld(TestNamespace ns) throws Exception {
    Glossary glossary = plainGlossary(ns);
    GlossaryTerm ungoverned = termWithSynonyms(ns, glossary, "crsynfree");
    GlossaryTerm governed = termWithSynonyms(ns, glossary, "crsyn");
    deployHookWorkflowFor(
        ns,
        Entity.GLOSSARY_TERM,
        "\"synonyms\"",
        "",
        filterScopedTo(Entity.GLOSSARY_TERM, governed.getFullyQualifiedName()));

    assertEquals(200, putWithoutSynonyms(glossary, ungoverned).statusCode());
    assertTrue(synonymsOf(ungoverned.getId()).isEmpty(), "a PUT clears the synonyms it leaves out");
    HttpResponse<String> held = putWithoutSynonyms(glossary, governed);

    assertEquals(202, held.statusCode(), held.body());
    assertEquals(List.of("alias"), synonymsOf(governed.getId()));
  }

  // A bulk override replaces the stored tags of the classifications it sends and keeps the rest;
  // the
  // ungoverned table shows the bulk write does, and the governed one holds the same change.
  @Test
  void bulkOverrideHoldsTheTagsItWouldReplace(TestNamespace ns) throws Exception {
    List<String> exclusive = createMutuallyExclusiveTags(ns);
    String kept = SharedEntities.get().PERSONAL_DATA_TAG_LABEL.getTagFQN();
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    CreateTable ungoverned = taggedTable(ns, schema, "crovfree", exclusive.get(0), kept);
    CreateTable governed = taggedTable(ns, schema, "crov", exclusive.get(0), kept);
    String governedFqn = "%s.%s".formatted(schema.getFullyQualifiedName(), governed.getName());
    deployHookWorkflowFor(
        ns, Entity.TABLE, "\"tags\"", "", filterScopedTo(Entity.TABLE, governedFqn));

    BulkOperationResult result =
        BulkApi.upsert(
            "tables",
            List.of(
                ungoverned.withTags(List.of(tagLabel(exclusive.get(1)))),
                governed.withTags(List.of(tagLabel(exclusive.get(1))))),
            true,
            SdkClients.getAdminToken());

    assertEquals(1, result.getNumberOfRowsPendingApproval());
    String ungovernedFqn = "%s.%s".formatted(schema.getFullyQualifiedName(), ungoverned.getName());
    assertEquals(Set.of(exclusive.get(1), kept), tableTags(ungovernedFqn));
    assertEquals(Set.of(exclusive.get(0), kept), tableTags(governedFqn));
    Table table = SdkClients.adminClient().tables().getByName(governedFqn, "");
    assertEquals(
        Set.of("ADD " + exclusive.get(1), "REMOVE " + exclusive.get(0)),
        onlyPendingRequest(table.getId()).getActiveRevision().getOps().stream()
            .filter(op -> Entity.FIELD_TAGS.equals(op.getField()))
            .map(op -> "%s %s".formatted(op.getOp().name(), op.getKey()))
            .collect(Collectors.toSet()));
  }

  private static GlossaryTerm ownedTerm(
      TestNamespace ns, Glossary glossary, String name, EntityReference owner) {
    return SdkClients.adminClient()
        .glossaryTerms()
        .create(
            new CreateGlossaryTerm()
                .withName(ns.shortPrefix(name))
                .withGlossary(glossary.getFullyQualifiedName())
                .withDescription(TERM_DESCRIPTION)
                .withOwners(List.of(owner)));
  }

  private static GlossaryTerm termWithSynonyms(TestNamespace ns, Glossary glossary, String name) {
    return SdkClients.adminClient()
        .glossaryTerms()
        .create(
            new CreateGlossaryTerm()
                .withName(ns.shortPrefix(name))
                .withGlossary(glossary.getFullyQualifiedName())
                .withDescription(TERM_DESCRIPTION)
                .withSynonyms(List.of("alias")));
  }

  private static HttpResponse<String> putWithoutSynonyms(Glossary glossary, GlossaryTerm term)
      throws Exception {
    CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withName(term.getName())
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription(TERM_DESCRIPTION);
    return sendAsAdmin(
        "PUT", "/v1/glossaryTerms", "application/json", JsonUtils.pojoToJson(create));
  }

  private static List<String> synonymsOf(UUID termId) {
    GlossaryTerm term = SdkClients.adminClient().glossaryTerms().get(termId.toString(), "");
    return term.getSynonyms() == null ? List.of() : term.getSynonyms();
  }

  private static List<UUID> ownerIds(UUID termId) {
    GlossaryTerm term = SdkClients.adminClient().glossaryTerms().get(termId.toString(), "owners");
    return term.getOwners() == null
        ? List.of()
        : term.getOwners().stream().map(EntityReference::getId).toList();
  }

  // The exported CSV with every row's value in the named column blanked.
  private static String withoutColumn(String csv, String column) throws Exception {
    StringWriter out = new StringWriter();
    try (CSVParser parser =
            CSVFormat.DEFAULT.withFirstRecordAsHeader().parse(new StringReader(csv));
        CSVPrinter printer =
            new CSVPrinter(
                out,
                CSVFormat.DEFAULT.withHeader(parser.getHeaderNames().toArray(String[]::new)))) {
      int blanked =
          parser
              .getHeaderNames()
              .indexOf(
                  parser.getHeaderNames().stream()
                      .filter(header -> header.replace("*", "").equals(column))
                      .findFirst()
                      .orElseThrow());
      for (CSVRecord record : parser) {
        List<String> values = new ArrayList<>(record.toList());
        values.set(blanked, "");
        printer.printRecord(values);
      }
    }
    return out.toString();
  }

  private static CreateTable taggedTable(
      TestNamespace ns, DatabaseSchema schema, String name, String... tagFqns) {
    CreateTable create =
        new CreateTable()
            .withName(ns.shortPrefix(name))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)))
            .withTags(Arrays.stream(tagFqns).map(ChangeRequestImportAndBulkIT::tagLabel).toList());
    // The owner reviews a table's change requests; without one the review approves itself.
    SdkClients.adminClient()
        .tables()
        .create(
            JsonUtils.deepCopy(create, CreateTable.class)
                .withOwners(List.of(SharedEntities.get().USER1.getEntityReference())));
    return create;
  }

  private static TagLabel tagLabel(String tagFqn) {
    return JsonUtils.readValue(tagLabelJson(tagFqn), TagLabel.class);
  }

  private static Set<String> tableTags(String tableFqn) {
    Table table = SdkClients.adminClient().tables().getByName(tableFqn, "tags");
    return table.getTags().stream().map(TagLabel::getTagFQN).collect(Collectors.toSet());
  }

  @Test
  void csvDryRunReportsPendingApprovalWithoutSubmitting(TestNamespace ns) {
    Glossary glossary = plainGlossary(ns);
    GlossaryTerm term = gatedTerm(ns, glossary);
    CsvImportResult result = importEdited(glossary, true);
    assertEquals(1, result.getNumberOfRowsPendingApproval());
    assertEquals(
        result.getNumberOfRowsProcessed(),
        result.getNumberOfRowsPassed() + result.getNumberOfRowsFailed());
    assertTrue(requestsFor(term.getId()).isEmpty());
  }

  @Test
  void bulkDomainAssignmentOfGatedAssetIsHeld(TestNamespace ns) {
    Glossary glossary = gatedGlossary(ns, "dn");
    deployHookWorkflow(ns, "\"domains\"", "", filterScopedTo(glossary.getFullyQualifiedName()));
    Domain domain =
        ns.trackRoot(
            Entity.DOMAIN,
            SdkClients.adminClient()
                .domains()
                .create(
                    new CreateDomain()
                        .withName(ns.shortPrefix("crdom"))
                        .withDomainType(CreateDomain.DomainType.AGGREGATE)
                        .withDescription("domain")));
    String path = "/v1/domains/%s/assets/add".formatted(domain.getName());

    BulkOperationResult dryRun = bulkAssign(path, glossary, true);
    assertEquals(1, dryRun.getNumberOfRowsPendingApproval());
    assertTrue(dryRun.getFailedRequest().isEmpty());
    assertEquals(PENDING_DETAIL, dryRun.getSuccessRequest().get(0).getMessage());
    assertTrue(requestsFor(glossary.getId()).isEmpty(), "a dry run never submits");

    BulkOperationResult result = bulkAssign(path, glossary, false);
    assertEquals(ApiStatus.SUCCESS, result.getStatus());
    assertEquals(1, result.getNumberOfRowsPendingApproval());
    assertTrue(result.getFailedRequest().isEmpty());
    ChangeRequest request = onlyPendingRequest(glossary.getId());
    assertEquals(
        "%s: change request %s".formatted(PENDING_DETAIL, request.getId()),
        result.getSuccessRequest().get(0).getMessage());
    assertTrue(
        SdkClients.adminClient()
            .glossaries()
            .get(glossary.getId().toString(), "domains")
            .getDomains()
            .isEmpty(),
        "the domain assignment is held");
  }

  @Test
  void bulkAssetWriteAnswersAcceptedOnlyWhenEveryAssetIsHeld(TestNamespace ns) throws Exception {
    Glossary gated = gatedGlossary(ns, "dn");
    Glossary ungated = plainGlossary(ns);
    deployHookWorkflow(ns, "\"domains\"", "", filterScopedTo(gated.getFullyQualifiedName()));
    String path = "/v1/domains/%s/assets/add".formatted(domain(ns).getName());

    HttpResponse<String> dryRun = sendBulk(path, List.of(gated), true);
    assertEquals(200, dryRun.statusCode(), dryRun.body());
    assertTrue(pendingCount(dryRun).isEmpty(), "a dry run submits nothing");

    HttpResponse<String> allHeld = sendBulk(path, List.of(gated), false);
    assertEquals(202, allHeld.statusCode(), allHeld.body());
    assertEquals("1", pendingCount(allHeld).orElseThrow());

    HttpResponse<String> partlyHeld = sendBulk(path, List.of(gated, ungated), false);
    assertEquals(200, partlyHeld.statusCode(), partlyHeld.body());
    assertEquals("1", pendingCount(partlyHeld).orElseThrow());
    assertEquals(
        1,
        SdkClients.adminClient()
            .glossaries()
            .get(ungated.getId().toString(), "domains")
            .getDomains()
            .size(),
        "the ungated asset is assigned");
  }

  @Test
  void asyncTagAddReportsHeldAssetsWhenTheJobStarts(TestNamespace ns) throws Exception {
    Glossary gated = gatedGlossary(ns, "tg");
    deployHookWorkflow(ns, "\"tags\"", "", filterScopedTo(gated.getFullyQualifiedName()));
    Tag tag =
        new TagService(SdkClients.adminClient().getHttpClient())
            .getByName(createMutuallyExclusiveTags(ns).get(0));

    HttpResponse<String> started =
        sendAsAdmin(
            "PUT",
            "/v1/tags/%s/assets/add".formatted(tag.getId()),
            "application/json",
            JsonUtils.pojoToJson(new BulkAssets().withAssets(List.of(gated.getEntityReference()))));

    assertEquals(200, started.statusCode(), started.body());
    assertEquals("1", pendingCount(started).orElseThrow());
    onlyPendingRequest(gated.getId());
  }

  @Test
  void heldDataProductRemovalKeepsLineageAndOutputPortUntilApproved(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Domain domain = domain(ns);
    DataProduct source = dataProduct(ns, domain, "crsrc");
    DataProduct target = dataProduct(ns, domain, "crdst");
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    Table held =
        table(ns, schema, domain, "crheld", SharedEntities.get().USER1.getEntityReference());
    Table downstream = table(ns, schema, domain, "crdown", null);
    admin.dataProducts().bulkAddAssets(source.getFullyQualifiedName(), assets(held));
    admin.dataProducts().bulkAddAssets(target.getFullyQualifiedName(), assets(downstream));
    admin
        .lineage()
        .addLineage(
            new AddLineage()
                .withEdge(
                    new EntitiesEdge()
                        .withFromEntity(held.getEntityReference())
                        .withToEntity(downstream.getEntityReference())));
    admin.dataProducts().bulkAddOutputPorts(source.getFullyQualifiedName(), assets(held));
    assertTrue(lineageEdgeExists(source, target), "the products' lineage follows their tables'");
    deployWorkflowAssigning(
        ns,
        Entity.TABLE,
        "\"dataProducts\"",
        "",
        filterScopedTo(Entity.TABLE, held.getFullyQualifiedName()),
        SharedEntities.get().USER1.getEntityReference());

    BulkOperationResult removal =
        admin.dataProducts().bulkRemoveAssets(source.getFullyQualifiedName(), assets(held));

    assertEquals(1, removal.getNumberOfRowsPendingApproval());
    assertKeepsProduct(source, target, held, "before approval");
    ChangeRequest request = onlyPendingRequest(held.getId());
    resolveAs(
        SdkClients.user1Client(),
        awaitOpenApprovalTask(held.getFullyQualifiedName()),
        "reject",
        TaskResolutionType.Rejected,
        null);
    Awaitility.await("change request %s rejected".formatted(request.getId()))
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(1))
        .until(
            () ->
                requestsFor(held.getId()).stream()
                    .anyMatch(
                        r ->
                            r.getId().equals(request.getId())
                                && r.getStatus() == ChangeRequestStatus.REJECTED));
    assertKeepsProduct(source, target, held, "after rejection");
  }

  private static void assertKeepsProduct(
      DataProduct source, DataProduct target, Table held, String when) {
    assertTrue(
        SdkClients.adminClient()
            .tables()
            .get(held.getId().toString(), "dataProducts")
            .getDataProducts()
            .stream()
            .anyMatch(ref -> ref.getId().equals(source.getId())),
        "the table stays in the data product " + when);
    assertTrue(
        outputPortIds(source).contains(held.getId()), "the table stays an output port " + when);
    assertTrue(lineageEdgeExists(source, target), "the products' lineage stays " + when);
  }

  @SuppressWarnings("unchecked")
  private static List<UUID> outputPortIds(DataProduct product) {
    ResultList<Map<String, Object>> ports =
        (ResultList<Map<String, Object>>)
            SdkClients.adminClient().dataProducts().outputPorts(product.getId()).list(100, 0);
    return ports.getData().stream().map(port -> UUID.fromString((String) port.get("id"))).toList();
  }

  private static boolean lineageEdgeExists(DataProduct from, DataProduct to) {
    boolean exists = true;
    try {
      SdkClients.adminClient()
          .getHttpClient()
          .executeForString(
              HttpMethod.GET,
              "/v1/lineage/getLineageEdge/%s/%s".formatted(from.getId(), to.getId()),
              null);
    } catch (OpenMetadataException e) {
      if (e.getStatusCode() != 404) {
        throw e;
      }
      exists = false;
    }
    return exists;
  }

  private static BulkAssets assets(Table table) {
    return new BulkAssets().withAssets(List.of(table.getEntityReference()));
  }

  private static DataProduct dataProduct(TestNamespace ns, Domain domain, String name) {
    return ns.trackRoot(
        Entity.DATA_PRODUCT,
        SdkClients.adminClient()
            .dataProducts()
            .create(
                new CreateDataProduct()
                    .withName(ns.shortPrefix(name))
                    .withDescription("data product")
                    .withDomains(List.of(domain.getFullyQualifiedName()))));
  }

  private static Table table(
      TestNamespace ns, DatabaseSchema schema, Domain domain, String name, EntityReference owner) {
    CreateTable create =
        new CreateTable()
            .withName(ns.shortPrefix(name))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)))
            .withDomains(List.of(domain.getFullyQualifiedName()))
            .withOwners(owner == null ? null : List.of(owner));
    return SdkClients.adminClient().tables().create(create);
  }

  private Domain domain(TestNamespace ns) {
    return ns.trackRoot(
        Entity.DOMAIN,
        SdkClients.adminClient()
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.shortPrefix("crdom"))
                    .withDomainType(CreateDomain.DomainType.AGGREGATE)
                    .withDescription("domain")));
  }

  private static HttpResponse<String> sendBulk(String path, List<Glossary> assets, boolean dryRun)
      throws Exception {
    BulkAssets request =
        new BulkAssets()
            .withAssets(assets.stream().map(Glossary::getEntityReference).toList())
            .withDryRun(dryRun);
    return sendAsAdmin("PUT", path, "application/json", JsonUtils.pojoToJson(request));
  }

  private static Optional<String> pendingCount(HttpResponse<String> response) {
    return response.headers().firstValue(RestUtil.PENDING_CHANGE_COUNT_HEADER);
  }

  private BulkOperationResult bulkAssign(String path, Glossary glossary, boolean dryRun) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            path,
            new BulkAssets().withAssets(List.of(glossary.getEntityReference())).withDryRun(dryRun),
            BulkOperationResult.class);
  }
}
