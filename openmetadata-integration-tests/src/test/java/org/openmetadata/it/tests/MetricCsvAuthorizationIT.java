/*
 *  Copyright 2026 Collate.
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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.StringReader;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.util.CsvJobClient;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespace.EntityRoot;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.CreateBot;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.data.CreateMetricGroup;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.MetricGroup;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.MetricType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class MetricCsvAuthorizationIT {
  private static final String RESTRICTED_TAG = "PII.Sensitive";
  private static final String IMPORTED_DESCRIPTION = "Updated by CSV";
  private static final OpenMetadataClient ADMIN = SdkClients.adminClient();

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void inheritedGroupIsAuthorizedForCreatesAndMoves(boolean dryRun, TestNamespace ns)
      throws Exception {
    Editor editor = editor(ns, "true", "matchAnyTag('" + RESTRICTED_TAG + "')");
    Metric parent = metric(ns, "parent");
    MetricGroup group =
        ns.trackRoot(
            Entity.METRIC_GROUP,
            ADMIN
                .getHttpClient()
                .execute(
                    HttpMethod.POST,
                    "/v1/metricGroups",
                    new CreateMetricGroup()
                        .withName(ns.shortPrefix("denied_group"))
                        .withMetrics(List.of(parent.getFullyQualifiedName()))
                        .withTags(List.of(new TagLabel().withTagFQN(RESTRICTED_TAG))),
                    MetricGroup.class));
    Metric moved = metric(ns, "moved");
    String child = ns.shortPrefix("child");
    assertThrows(
        ForbiddenException.class,
        () ->
            editor
                .client()
                .metrics()
                .create(request(child).withParent(parent.getFullyQualifiedName())));
    String csv =
        csv(
            moved,
            List.of(
                Map.of(0, child, 19, parent.getFullyQualifiedName(), 21, ""),
                Map.of(19, parent.getFullyQualifiedName(), 21, "")));

    assertRows(importCsv(ns, editor.client(), moved, csv, dryRun), 0, 2);

    assertNull(ADMIN.metrics().get(moved.getId().toString(), "parent,metricGroup").getParent());
    assertMissing(child);
    assertEquals(
        group.getId(),
        ADMIN.metrics().get(parent.getId().toString(), "metricGroup").getMetricGroup().getId());
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void pendingParentTagsCannotBypassDestinationDeny(boolean dryRun, TestNamespace ns)
      throws Exception {
    Editor editor = editor(ns, "true", "matchAnyTag('" + RESTRICTED_TAG + "')");
    Metric anchor = metric(ns, "anchor");
    String parent = ns.shortPrefix("pending_parent");
    String child = ns.shortPrefix("pending_child");
    String csv =
        csv(anchor, List.of(Map.of(0, parent, 10, RESTRICTED_TAG), Map.of(0, child, 19, parent)));

    assertRows(importCsv(ns, editor.client(), anchor, csv, dryRun), 1, 1);

    assertMissing(child);
    if (dryRun) {
      assertMissing(parent);
    } else {
      assertTrue(
          ADMIN.metrics().getByName(parent, "tags").getTags().stream()
              .anyMatch(tag -> RESTRICTED_TAG.equals(tag.getTagFQN())));
    }
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void pendingParentOwnersAllowValidChildren(boolean dryRun, TestNamespace ns) throws Exception {
    Editor editor = editor(ns, "isOwner()", null);
    Metric anchor =
        create(
            ns,
            request(ns.shortPrefix("anchor"))
                .withOwners(List.of(editor.user().getEntityReference())));
    String parent = ns.shortPrefix("owned_parent");
    String child = ns.shortPrefix("owned_child");
    String csv =
        csv(
            anchor,
            List.of(
                Map.of(0, parent, 13, "user:" + editor.user().getName()),
                Map.of(0, child, 13, "user:" + editor.user().getName(), 19, parent)));

    assertRows(importCsv(ns, editor.client(), anchor, csv, dryRun), 2, 0);

    if (dryRun) {
      assertMissing(parent);
      assertMissing(child);
    } else {
      assertEquals(
          ADMIN.metrics().getByName(parent).getId(),
          ADMIN.metrics().getByName(child, "parent").getParent().getId());
    }
  }

  @ParameterizedTest
  @CsvSource({"true,false", "false,false", "true,true", "false,true"})
  void movingMetricRequiresEditOnItsWholeSubtree(
      boolean dryRun, boolean moveToRoot, TestNamespace ns) throws Exception {
    Editor editor = editor(ns, "true", "matchAnyTag('" + RESTRICTED_TAG + "')");
    Metric destination = metric(ns, "destination");
    Metric source =
        create(
            ns,
            request(ns.shortPrefix("source"))
                .withParent(moveToRoot ? destination.getFullyQualifiedName() : null));
    create(
        ns,
        request(ns.shortPrefix("denied_descendant"))
            .withParent(source.getFullyQualifiedName())
            .withTags(List.of(new TagLabel().withTagFQN(RESTRICTED_TAG))));

    assertRows(
        importCsv(
            ns,
            editor.client(),
            source,
            csv(source, List.of(Map.of(19, moveToRoot ? "" : destination.getFullyQualifiedName()))),
            dryRun),
        0,
        1);

    Metric stored = ADMIN.metrics().get(source.getId().toString(), "parent");
    if (moveToRoot) {
      assertEquals(destination.getId(), stored.getParent().getId());
    } else {
      assertNull(stored.getParent());
    }
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void movingMetricRequiresEditOnChildrenQueuedEarlierInTheImport(boolean dryRun, TestNamespace ns)
      throws Exception {
    Editor editor = editor(ns, "true", "matchAnyTag('" + RESTRICTED_TAG + "')");
    Metric root = metric(ns, "root");
    MetricGroup group =
        ns.trackRoot(
            Entity.METRIC_GROUP,
            ADMIN
                .getHttpClient()
                .execute(
                    HttpMethod.POST,
                    "/v1/metricGroups",
                    new CreateMetricGroup().withName(ns.shortPrefix("group")),
                    MetricGroup.class));
    String child = ns.shortPrefix("queued_child");
    String csv =
        csv(
            root,
            List.of(
                Map.of(0, child, 10, RESTRICTED_TAG, 19, root.getFullyQualifiedName(), 21, ""),
                Map.of(21, group.getFullyQualifiedName())));

    assertRows(importCsv(ns, editor.client(), root, csv, dryRun), 1, 1);

    assertNull(ADMIN.metrics().get(root.getId().toString(), "metricGroup").getMetricGroup());
    if (dryRun) {
      assertMissing(child);
    } else {
      assertNull(ADMIN.metrics().getByName(child, "metricGroup").getMetricGroup());
    }
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void movingMetricChecksTheImportedStateOfExistingChildren(boolean dryRun, TestNamespace ns)
      throws Exception {
    Editor editor = editor(ns, "true", "matchAnyTag('" + RESTRICTED_TAG + "')");
    Metric root = metric(ns, "root");
    Metric child =
        create(ns, request(ns.shortPrefix("child")).withParent(root.getFullyQualifiedName()));
    MetricGroup group =
        ns.trackRoot(
            Entity.METRIC_GROUP,
            ADMIN
                .getHttpClient()
                .execute(
                    HttpMethod.POST,
                    "/v1/metricGroups",
                    new CreateMetricGroup().withName(ns.shortPrefix("group")),
                    MetricGroup.class));
    String csv =
        csv(
            child,
            List.of(
                Map.of(10, RESTRICTED_TAG),
                Map.of(0, root.getName(), 19, "", 21, group.getFullyQualifiedName())));

    assertRows(importCsv(ns, editor.client(), root, csv, dryRun), 1, 1);

    assertNull(ADMIN.metrics().get(root.getId().toString(), "metricGroup").getMetricGroup());
    assertNull(ADMIN.metrics().get(child.getId().toString(), "metricGroup").getMetricGroup());
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void unchangedMembershipDoesNotRequireEditOnParent(boolean dryRun, TestNamespace ns)
      throws Exception {
    Editor editor = editor(ns, "true", "matchAnyTag('" + RESTRICTED_TAG + "')");
    Metric parent =
        create(
            ns,
            request(ns.shortPrefix("parent"))
                .withTags(List.of(new TagLabel().withTagFQN(RESTRICTED_TAG))));
    Metric child =
        create(ns, request(ns.shortPrefix("child")).withParent(parent.getFullyQualifiedName()));

    assertRows(
        importCsv(
            ns,
            editor.client(),
            child,
            csv(child, List.of(Map.of(2, IMPORTED_DESCRIPTION))),
            dryRun),
        1,
        0);

    Metric stored = ADMIN.metrics().get(child.getId().toString(), "parent");
    assertEquals(parent.getId(), stored.getParent().getId());
    assertEquals(dryRun ? "Original description" : IMPORTED_DESCRIPTION, stored.getDescription());
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void asyncImportRetainsImpersonationDeny(boolean dryRun, TestNamespace ns) throws Exception {
    Editor editor = editor(ns, "true", "isImpersonated() && matchAnyTag('" + RESTRICTED_TAG + "')");
    Metric anchor = metric(ns, "allowed_anchor");
    Metric protectedMetric =
        create(
            ns,
            request(ns.shortPrefix("protected"))
                .withTags(List.of(new TagLabel().withTagFQN(RESTRICTED_TAG))));
    OpenMetadataClient impersonated = impersonating(ns, editor.user());
    String csv = csv(protectedMetric, List.of(Map.of(2, IMPORTED_DESCRIPTION)));
    assertThrows(
        ForbiddenException.class,
        () ->
            impersonated
                .metrics()
                .patch(
                    protectedMetric.getId(),
                    JsonUtils.readTree(
                        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"Updated by CSV\"}]")));
    assertRows(importCsv(ns, impersonated, anchor, csv, dryRun), 0, 1);

    String submitted =
        impersonated
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                "/v1/metrics/name/" + anchor.getFullyQualifiedName() + "/importAsync",
                csv,
                importOptions(dryRun));
    String jobId = JsonUtils.readTree(submitted).path("jobId").asText();
    assertTrue(!jobId.isEmpty(), submitted);
    CsvJobClient jobs = CsvJobClient.onDefaultServer();
    jobs.awaitJobStatus(jobId, "COMPLETED");
    String result =
        jobs.request("GET", "/v1/csvAsyncJobs/" + jobId + "/import-result", null).body();
    assertRows(JsonUtils.readValue(result, CsvImportResult.class), 0, 1);
    assertEquals(
        "Original description", ADMIN.metrics().get(protectedMetric.getId()).getDescription());

    assertRows(importCsv(ns, editor.client(), anchor, csv, dryRun), 1, 0);
  }

  private static Editor editor(TestNamespace ns, String editCondition, String denyCondition) {
    List<Rule> rules = new ArrayList<>();
    rules.add(
        new Rule()
            .withName("CreateAndView")
            .withResources(List.of(Entity.METRIC, Entity.METRIC_GROUP))
            .withOperations(List.of(MetadataOperation.CREATE, MetadataOperation.VIEW_ALL))
            .withEffect(Rule.Effect.ALLOW));
    rules.add(
        new Rule()
            .withName("Edit")
            .withResources(List.of(Entity.METRIC, Entity.METRIC_GROUP))
            .withOperations(List.of(MetadataOperation.EDIT_ALL))
            .withCondition(editCondition)
            .withEffect(Rule.Effect.ALLOW));
    if (denyCondition != null) {
      rules.add(
          new Rule()
              .withName("DenyProtected")
              .withResources(List.of(Entity.METRIC, Entity.METRIC_GROUP))
              .withOperations(List.of(MetadataOperation.EDIT_ALL))
              .withCondition(denyCondition)
              .withEffect(Rule.Effect.DENY));
    }
    Policy policy =
        ADMIN
            .policies()
            .create(new CreatePolicy().withName(ns.shortPrefix("policy")).withRules(rules));
    Role role =
        ADMIN
            .roles()
            .create(
                new CreateRole()
                    .withName(ns.shortPrefix("role"))
                    .withPolicies(List.of(policy.getFullyQualifiedName())));
    String name = "csv_editor_" + ns.uniqueShortId();
    User user =
        ADMIN
            .users()
            .create(
                new CreateUser()
                    .withName(name)
                    .withEmail(name + "@test.com")
                    .withRoles(List.of(role.getId())));
    // Cleanup runs in tracking order: the user before the role it holds, the role before its
    // policy.
    ns.trackRoot(Entity.USER, user);
    ns.trackRoot(Entity.ROLE, role);
    ns.trackRoot(Entity.POLICY, policy);
    return new Editor(
        user, SdkClients.createClient(user.getEmail(), user.getEmail(), new String[] {}));
  }

  private static OpenMetadataClient impersonating(TestNamespace ns, User user) {
    String name = "csvbot" + ns.uniqueShortId();
    User bot =
        ADMIN
            .users()
            .create(
                new CreateUser()
                    .withName(name)
                    .withEmail(name + "@test.com")
                    .withIsBot(true)
                    .withAuthenticationMechanism(
                        new AuthenticationMechanism()
                            .withAuthType(AuthenticationMechanism.AuthType.JWT)
                            .withConfig(
                                new JWTAuthMechanism()
                                    .withJWTTokenExpiry(JWTTokenExpiry.Unlimited))));
    // Hard-deleting the bot also removes its bot user.
    ns.trackRoot(
        Entity.BOT,
        ADMIN
            .bots()
            .create(
                new CreateBot()
                    .withName(ns.shortPrefix("bot"))
                    .withBotUser(bot.getName())
                    .withAllowImpersonation(true)));
    String token = ADMIN.users().generateToken(bot.getId(), JWTTokenExpiry.Seven).getJWTToken();
    return new OpenMetadataClient(
        OpenMetadataConfig.builder()
            .serverUrl(SdkClients.baseUrl())
            .accessToken(token)
            .header("X-Impersonate-User", user.getName())
            .build());
  }

  private static Metric metric(TestNamespace ns, String name) {
    return create(ns, request(ns.shortPrefix(name)));
  }

  // Only top-level metrics are tracked: deleting one recursively removes its children.
  private static Metric create(TestNamespace ns, CreateMetric request) {
    Metric metric = ADMIN.metrics().create(request);
    return request.getParent() == null ? ns.trackRoot(Entity.METRIC, metric) : metric;
  }

  private static void trackImported(TestNamespace ns, String csv) throws IOException {
    try (CSVParser parser = CSVFormat.DEFAULT.parse(new StringReader(csv))) {
      for (CSVRecord row : parser.getRecords().stream().skip(1).toList()) {
        try {
          Metric metric = ADMIN.metrics().getByName(row.get(0), "parent");
          boolean untracked =
              !ns.trackedRoots().contains(new EntityRoot(Entity.METRIC, metric.getId()));
          if (metric.getParent() == null && untracked) {
            ns.trackRoot(Entity.METRIC, metric);
          }
        } catch (OpenMetadataException e) {
          if (e.getStatusCode() != 404) {
            throw e;
          }
        }
      }
    }
  }

  private static CreateMetric request(String name) {
    return new CreateMetric()
        .withName(name)
        .withDescription("Original description")
        .withMetricType(MetricType.COUNT);
  }

  private static String csv(Metric template, List<Map<Integer, String>> edits) throws Exception {
    String exported = ADMIN.metrics().exportCsv(template.getFullyQualifiedName());
    try (CSVParser parser = CSVFormat.DEFAULT.parse(new StringReader(exported));
        StringWriter output = new StringWriter();
        CSVPrinter printer = new CSVPrinter(output, CSVFormat.DEFAULT)) {
      List<CSVRecord> records = parser.getRecords();
      printer.printRecord(records.getFirst());
      for (Map<Integer, String> edit : edits) {
        List<String> row = new ArrayList<>(records.get(1).toList());
        edit.forEach(row::set);
        printer.printRecord(row);
      }
      printer.flush();
      return output.toString();
    }
  }

  // Tracks what the import created before any assertion runs, so a failing test still cleans up.
  private static CsvImportResult importCsv(
      TestNamespace ns, OpenMetadataClient client, Metric anchor, String csv, boolean dryRun)
      throws IOException {
    String result =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                "/v1/metrics/name/" + anchor.getFullyQualifiedName() + "/import",
                csv,
                importOptions(dryRun));
    trackImported(ns, csv);
    return JsonUtils.readValue(result, CsvImportResult.class);
  }

  private static RequestOptions importOptions(boolean dryRun) {
    return RequestOptions.builder()
        .header("Content-Type", "text/plain; charset=UTF-8")
        .queryParam("dryRun", Boolean.toString(dryRun))
        .build();
  }

  private static void assertRows(CsvImportResult result, int passed, int failed) {
    assertEquals(passed, result.getNumberOfRowsPassed(), result.getImportResultsCsv());
    assertEquals(failed, result.getNumberOfRowsFailed(), result.getImportResultsCsv());
  }

  private static void assertMissing(String name) {
    OpenMetadataException missing =
        assertThrows(OpenMetadataException.class, () -> ADMIN.metrics().getByName(name));
    assertEquals(404, missing.getStatusCode());
  }

  private record Editor(User user, OpenMetadataClient client) {}
}
