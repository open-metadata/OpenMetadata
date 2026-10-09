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

import java.net.http.HttpResponse;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.classification.TagService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.RestUtil;

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
