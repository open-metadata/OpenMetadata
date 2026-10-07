package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.util.ApiAssertions.assertForbidden;
import static org.openmetadata.it.util.UriTestUtils.assertHttpStatusFor;
import static org.openmetadata.it.util.UriTestUtils.encodeURIComponent;

import java.time.Duration;
import java.util.Date;
import java.util.List;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.DenyPolicyPrincipals;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.ValidateGlossaryTagsRequest;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.ai.CreateAIGovernanceFramework;
import org.openmetadata.schema.api.ai.CreateAuditReport;
import org.openmetadata.schema.api.ai.ForkAIGovernanceFrameworkRequest;
import org.openmetadata.schema.api.data.CreateDataContract;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.dataInsight.kpi.CreateKpiRequest;
import org.openmetadata.schema.api.dataInsight.kpi.KpiDataInsightChart;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.api.governance.CreateWorkflowDefinition;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.dataInsight.kpi.Kpi;
import org.openmetadata.schema.dataInsight.type.KpiTargetType;
import org.openmetadata.schema.entity.ai.AIGovernanceFramework;
import org.openmetadata.schema.entity.ai.AuditReport;
import org.openmetadata.schema.entity.ai.AuditReportStatus;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.RecognizerFeedback;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.kpi.KpiService;

/**
 * Endpoints that read or act on a single entity outside the generic CRUD paths must enforce the
 * same permission as that entity's own GET or PATCH. Each test calls the endpoint as a principal
 * denied exactly that permission, so the 403 can only come from the endpoint's own check.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class SubResourceAuthorizationIT {

  private static final String PII_SENSITIVE = "PII.Sensitive";

  // The data consumer resolves through SubjectCache; create it up front so an authorization
  // check answers 403 rather than 404 for a user this JVM has not seen yet.
  @BeforeAll
  static void ensureDataConsumerUser() {
    UserTestFactory.getDataConsumer(null);
  }

  @Test
  void tableSystemProfile_requiresViewDataProfile(TestNamespace ns) {
    Table table = createTable(ns);
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDenied(
            ns.shortPrefix("sysprofile"), "table", MetadataOperation.VIEW_DATA_PROFILE);
    String path =
        "/v1/tables/"
            + encodeURIComponent(table.getFullyQualifiedName())
            + "/systemProfile?startTs=0&endTs="
            + System.currentTimeMillis();

    assertHttpStatusFor(denied, 403, HttpMethod.GET, path, null);
    assertNotNull(adminGet(path));
  }

  @Test
  void tableEntityRelationship_requiresViewOnTheRootTable(TestNamespace ns) {
    Table table = createTable(ns);
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDenied(
            ns.shortPrefix("tablerel"), "table", MetadataOperation.VIEW_BASIC);
    String fqnQuery = "?fqn=" + encodeURIComponent(table.getFullyQualifiedName());

    assertHttpStatusFor(
        denied, 403, HttpMethod.GET, "/v1/tables/entityRelationship" + fqnQuery, null);
    assertHttpStatusFor(
        denied, 403, HttpMethod.GET, "/v1/tables/entityRelationship/Upstream" + fqnQuery, null);
    assertNotNull(adminGet("/v1/tables/entityRelationship" + fqnQuery));
  }

  @Test
  void schemaEntityRelationship_requiresViewOnTheSchema(TestNamespace ns) {
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDenied(
            ns.shortPrefix("schemarel"), "databaseSchema", MetadataOperation.VIEW_BASIC);
    String path =
        "/v1/databaseSchemas/entityRelationship?fqn="
            + encodeURIComponent(schema.getFullyQualifiedName());

    assertHttpStatusFor(denied, 403, HttpMethod.GET, path, null);
    assertNotNull(adminGet(path));
  }

  @Test
  void ingestionPipelineStatusHistory_requiresViewAll(TestNamespace ns) {
    IngestionPipeline pipeline = createIngestionPipeline(ns);
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDenied(
            ns.shortPrefix("pipestatus"), "ingestionPipeline", MetadataOperation.VIEW_ALL);
    String path =
        "/v1/services/ingestionPipelines/"
            + encodeURIComponent(pipeline.getFullyQualifiedName())
            + "/pipelineStatus";

    assertHttpStatusFor(denied, 403, HttpMethod.GET, path, null);
    assertNotNull(
        SdkClients.ingestionBotClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, path, null));
  }

  @Test
  void kpiResults_requireViewOnTheKpi(TestNamespace ns) {
    Kpi kpi =
        new KpiService(SdkClients.adminClient().getHttpClient())
            .create(
                new CreateKpiRequest()
                    .withName(ns.prefix("kpi"))
                    .withDescription("KPI whose results a denied user must not read")
                    .withDataInsightChart(
                        KpiDataInsightChart.PERCENTAGE_OF_DATA_ASSET_WITH_DESCRIPTION_KPI)
                    .withMetricType(KpiTargetType.PERCENTAGE)
                    .withTargetValue(80.0)
                    .withStartDate(System.currentTimeMillis())
                    .withEndDate(System.currentTimeMillis() + Duration.ofDays(30).toMillis()));
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDenied(
            ns.shortPrefix("kpiresult"), "kpi", MetadataOperation.VIEW_BASIC);
    String kpiPath = "/v1/kpi/" + encodeURIComponent(kpi.getName());

    assertHttpStatusFor(
        denied,
        403,
        HttpMethod.GET,
        kpiPath + "/kpiResult?startTs=0&endTs=" + System.currentTimeMillis(),
        null);
    assertHttpStatusFor(denied, 403, HttpMethod.GET, kpiPath + "/latestKpiResult", null);
  }

  @Test
  void reportList_requiresView(TestNamespace ns) {
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDenied(
            ns.shortPrefix("reports"), "report", MetadataOperation.VIEW_BASIC);

    assertHttpStatusFor(denied, 403, HttpMethod.GET, "/v1/reports", null);
    assertNotNull(adminGet("/v1/reports"));
  }

  /**
   * A tag-conditioned deny only matches once the context resolves the table itself. GET by id used
   * to build a type-only context, so it served usage that GET by name refused.
   */
  @Test
  void usageById_appliesEntityConditionedPolicies(TestNamespace ns) {
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    Table sensitive = createTable(ns, schema, "sensitive", List.of(piiSensitiveTag()));
    Table plain = createTable(ns, schema, "plain", List.of());
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDeniedWhen(
            ns.shortPrefix("usage"),
            "table",
            MetadataOperation.VIEW_USAGE,
            "matchAnyTag('" + PII_SENSITIVE + "')");

    assertHttpStatusFor(
        denied, 403, HttpMethod.GET, "/v1/usage/table/" + sensitive.getId() + "?days=1", null);
    assertNotNull(
        denied
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/v1/usage/table/" + plain.getId() + "?days=1", null));
  }

  @Test
  void lineageEdge_requiresViewOnBothEnds(TestNamespace ns) {
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    Table upstream = createTable(ns, schema, "edge_from", List.of());
    Table downstream = createTable(ns, schema, "edge_to", List.of());
    addLineage(upstream, downstream);
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDenied(
            ns.shortPrefix("lineageedge"), "table", MetadataOperation.VIEW_BASIC);
    String byId = "/v1/lineage/getLineageEdge/" + upstream.getId() + "/" + downstream.getId();
    String byName =
        "/v1/lineage/getLineageEdge/table/name/"
            + encodeURIComponent(upstream.getFullyQualifiedName())
            + "/table/name/"
            + encodeURIComponent(downstream.getFullyQualifiedName());

    assertHttpStatusFor(denied, 403, HttpMethod.GET, byId, null);
    assertHttpStatusFor(denied, 403, HttpMethod.GET, byName, null);
    assertNotNull(adminGet(byId));
    assertNotNull(adminGet(byName));
  }

  @Test
  void dataContractValidation_requiresViewOnTheTargetEntity(TestNamespace ns) {
    Table table = createTable(ns);
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDenied(
            ns.shortPrefix("contractval"), "table", MetadataOperation.VIEW_BASIC);
    CreateDataContract probe =
        new CreateDataContract()
            .withName(ns.prefix("probe"))
            .withEntity(table.getEntityReference().withFullyQualifiedName("not_the_real_name"))
            .withSchema(List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)));
    String yamlProbe =
        "name: "
            + ns.prefix("yaml_probe")
            + "\nentity:\n  id: "
            + table.getId()
            + "\n  type: table\n";

    OpenMetadataException jsonDenied =
        assertForbidden(
            () -> denied.dataContracts().validateContract(probe),
            "a schema probe must not run against a table the caller cannot view");
    assertFalse(
        String.valueOf(jsonDenied.getMessage()).contains(table.getFullyQualifiedName()),
        "the denial must not reveal the table's real name: " + jsonDenied.getMessage());
    assertForbidden(
        () -> denied.dataContracts().validateContractYaml(yamlProbe),
        "the YAML variant must apply the same check");
    assertForbidden(
        () ->
            denied.dataContracts().validateODCSYaml("kind: DataContract\n", table.getId(), "table"),
        "the ODCS variant must apply the same check");
    assertNotNull(
        SdkClients.adminClient()
            .dataContracts()
            .validateContract(probe.withEntity(table.getEntityReference())));
  }

  @Test
  void auditReportCancel_requiresEditOnTheReport(TestNamespace ns) {
    AuditReport report =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.POST,
                "/v1/auditReports",
                new CreateAuditReport().withName(ns.prefix("audit")),
                AuditReport.class);

    assertHttpStatusFor(
        SdkClients.dataConsumerClient(),
        403,
        HttpMethod.POST,
        "/v1/auditReports/" + report.getId() + "/cancel",
        null);
    AuditReport after =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(HttpMethod.GET, "/v1/auditReports/" + report.getId(), null, AuditReport.class);
    assertNotEquals(AuditReportStatus.Cancelled, after.getStatus());
  }

  @Test
  void workflowDefinitionTriggerAndRedeploy_requireEditOnTheWorkflow(TestNamespace ns) {
    WorkflowDefinition workflow = createNoOpWorkflow(ns);
    OpenMetadataClient viewer = SdkClients.user3Client();

    assertHttpStatusFor(
        viewer,
        403,
        HttpMethod.POST,
        "/v1/governance/workflowDefinitions/name/"
            + encodeURIComponent(workflow.getFullyQualifiedName())
            + "/trigger",
        null);
    assertHttpStatusFor(
        viewer,
        403,
        HttpMethod.POST,
        "/v1/governance/workflowDefinitions/" + workflow.getId() + "/redeploy",
        null);
  }

  @Test
  void aiGovernanceFrameworkFork_requiresCreate(TestNamespace ns) {
    AIGovernanceFramework framework =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.POST,
                "/v1/aiGovernanceFrameworks",
                new CreateAIGovernanceFramework().withName(ns.prefix("framework")),
                AIGovernanceFramework.class);
    String forkName = ns.prefix("framework_fork");

    assertHttpStatusFor(
        SdkClients.dataConsumerClient(),
        403,
        HttpMethod.POST,
        "/v1/aiGovernanceFrameworks/" + framework.getId() + "/fork",
        new ForkAIGovernanceFrameworkRequest().withName(forkName));
    assertHttpStatusFor(
        SdkClients.adminClient(),
        404,
        HttpMethod.GET,
        "/v1/aiGovernanceFrameworks/name/" + encodeURIComponent(forkName),
        null);
  }

  @Test
  void domainAssets_requireViewOnTheDomain(TestNamespace ns) {
    Domain domain =
        SdkClients.adminClient()
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.prefix("domain"))
                    .withDomainType(DomainType.AGGREGATE)
                    .withDescription("Domain whose assets a denied user must not list"));

    assertAssetListingsDenied(
        ns,
        "domain",
        "/v1/domains/" + domain.getId() + "/assets",
        "/v1/domains/name/" + encodeURIComponent(domain.getFullyQualifiedName()) + "/assets");
  }

  @Test
  void glossaryTermAssets_requireViewOnTheTerm(TestNamespace ns) {
    GlossaryTerm term =
        GlossaryTermTestFactory.createSimple(ns, GlossaryTestFactory.createSimple(ns));

    assertAssetListingsDenied(
        ns,
        "glossaryTerm",
        "/v1/glossaryTerms/" + term.getId() + "/assets",
        "/v1/glossaryTerms/name/" + encodeURIComponent(term.getFullyQualifiedName()) + "/assets");
  }

  @Test
  void glossaryTermTagValidation_requiresTagEditOnTheTerm(TestNamespace ns) {
    GlossaryTerm term =
        GlossaryTermTestFactory.createSimple(ns, GlossaryTestFactory.createSimple(ns));
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDenied(
            ns.shortPrefix("termtags"), "glossaryTerm", MetadataOperation.EDIT_ALL);

    assertHttpStatusFor(
        denied,
        403,
        HttpMethod.PUT,
        "/v1/glossaryTerms/" + term.getId() + "/tags/validate",
        new ValidateGlossaryTagsRequest().withDryRun(true).withGlossaryTags(List.of()));
  }

  @Test
  void tagAssets_requireViewOnTheTag(TestNamespace ns) {
    Tag tag = SdkClients.adminClient().tags().getByName(PII_SENSITIVE);

    assertAssetListingsDenied(
        ns,
        "tag",
        "/v1/tags/" + tag.getId() + "/assets",
        "/v1/tags/name/" + encodeURIComponent(PII_SENSITIVE) + "/assets");
  }

  @Test
  void teamAssets_requireViewOnTheTeam(TestNamespace ns) {
    Team team =
        SdkClients.adminClient()
            .teams()
            .create(new CreateTeam().withName(ns.prefix("team")).withTeamType(TeamType.GROUP));

    assertAssetListingsDenied(
        ns,
        "team",
        "/v1/teams/" + team.getId() + "/assets",
        "/v1/teams/name/" + encodeURIComponent(team.getName()) + "/assets");
  }

  @Test
  void userAssets_requireViewOnTheUser(TestNamespace ns) {
    User owner = SharedEntities.get().USER2;

    assertAssetListingsDenied(
        ns,
        "user",
        "/v1/users/" + owner.getId() + "/assets",
        "/v1/users/name/" + encodeURIComponent(owner.getName()) + "/assets");
  }

  /** A vote answers with the whole entity, so voting takes the same view as reading. */
  @Test
  void voting_requiresViewOnTheEntity(TestNamespace ns) {
    Table table = createTable(ns);
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDenied(
            ns.shortPrefix("vote"), "table", MetadataOperation.VIEW_BASIC);
    String path = "/v1/tables/" + table.getId() + "/vote";
    VoteRequest upVote = new VoteRequest().withUpdatedVoteType(VoteRequest.VoteType.VOTED_UP);

    assertHttpStatusFor(denied, 403, HttpMethod.PUT, path, upVote);
    assertNotNull(
        SdkClients.dataConsumerClient()
            .getHttpClient()
            .executeForString(HttpMethod.PUT, path, upVote));
  }

  @Test
  void following_requiresViewOnTheEntity(TestNamespace ns) {
    Table table = createTable(ns);
    String prefix = ns.shortPrefix("follow");
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDenied(prefix, "table", MetadataOperation.VIEW_BASIC);
    User deniedUser = SdkClients.adminClient().users().getByName(prefix + "_user");

    assertHttpStatusFor(
        denied,
        403,
        HttpMethod.PUT,
        "/v1/tables/" + table.getId() + "/followers",
        deniedUser.getId());
  }

  @Test
  void recognizerFeedback_requiresTagEditOnTheAsset(TestNamespace ns) {
    Table table = createTable(ns);
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDenied(
            ns.shortPrefix("feedback"), "table", MetadataOperation.EDIT_TAGS);
    RecognizerFeedback feedback =
        new RecognizerFeedback()
            .withEntityLink("<#E::table::" + table.getFullyQualifiedName() + ">")
            .withTagFQN(PII_SENSITIVE)
            .withFeedbackType(RecognizerFeedback.FeedbackType.FALSE_POSITIVE);

    assertHttpStatusFor(
        denied,
        403,
        HttpMethod.POST,
        "/v1/tags/name/" + encodeURIComponent(PII_SENSITIVE) + "/feedback",
        feedback);
  }

  @Test
  void knowledgePageHierarchy_requiresView(TestNamespace ns) {
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDenied(
            ns.shortPrefix("pages"), "page", MetadataOperation.VIEW_BASIC);

    assertHttpStatusFor(denied, 403, HttpMethod.GET, "/v1/contextCenter/pages/hierarchy", null);
    assertHttpStatusFor(
        denied, 403, HttpMethod.GET, "/v1/contextCenter/pages/search/hierarchy", null);
  }

  @Test
  void lineageGraph_requiresViewOnTheRootAndPrunesDeniedNeighbours(TestNamespace ns) {
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    Table open = createTable(ns, schema, "graph_open", List.of());
    Table sensitive = createTable(ns, schema, "graph_sensitive", List.of(piiSensitiveTag()));
    addLineage(open, sensitive);
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDeniedWhen(
            ns.shortPrefix("graph"),
            "table",
            MetadataOperation.VIEW_BASIC,
            "matchAnyTag('" + PII_SENSITIVE + "')");
    String sensitiveFqn = encodeURIComponent(sensitive.getFullyQualifiedName());

    assertHttpStatusFor(
        denied, 403, HttpMethod.GET, "/v1/lineage/table/name/" + sensitiveFqn, null);
    assertHttpStatusFor(
        denied,
        403,
        HttpMethod.GET,
        "/v1/lineage/getLineage?type=table&upstreamDepth=1&downstreamDepth=1&fqn=" + sensitiveFqn,
        null);
    String openGraph =
        "/v1/lineage/table/name/"
            + encodeURIComponent(open.getFullyQualifiedName())
            + "?downstreamDepth=1";
    String deniedGraph = denied.getHttpClient().executeForString(HttpMethod.GET, openGraph, null);
    assertFalse(deniedGraph.contains(sensitive.getId().toString()), deniedGraph);
    assertTrue(adminGet(openGraph).contains(sensitive.getId().toString()));
  }

  /** Column search walks every table, so it must leave out the tables the caller cannot view. */
  @Test
  void columnSearch_leavesOutTablesTheCallerCannotView(TestNamespace ns) {
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    Table sensitive = createTable(ns, schema, "col_sensitive", List.of(piiSensitiveTag()));
    Table open = createTable(ns, schema, "col_open", List.of());
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDeniedWhen(
            ns.shortPrefix("colsearch"),
            "table",
            MetadataOperation.VIEW_BASIC,
            "matchAnyTag('" + PII_SENSITIVE + "')");
    String path =
        "/v1/columns/search?columnName=id&serviceName="
            + encodeURIComponent(schema.getService().getName());

    String deniedView = denied.getHttpClient().executeForString(HttpMethod.GET, path, null);
    assertFalse(deniedView.contains(sensitive.getFullyQualifiedName()), deniedView);
    assertTrue(deniedView.contains(open.getFullyQualifiedName()), deniedView);
    assertTrue(adminGet(path).contains(sensitive.getFullyQualifiedName()));
  }

  private static void assertAssetListingsDenied(
      TestNamespace ns, String resource, String byIdPath, String byNamePath) {
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDenied(
            ns.shortPrefix(resource + "assets"), resource, MetadataOperation.VIEW_BASIC);

    assertHttpStatusFor(denied, 403, HttpMethod.GET, byIdPath, null);
    assertHttpStatusFor(denied, 403, HttpMethod.GET, byNamePath, null);
    assertNotNull(adminGet(byIdPath));
  }

  private static String adminGet(String path) {
    return SdkClients.adminClient().getHttpClient().executeForString(HttpMethod.GET, path, null);
  }

  private static Table createTable(TestNamespace ns) {
    return TableTestFactory.createSimple(
        ns, DatabaseSchemaTestFactory.createSimple(ns).getFullyQualifiedName());
  }

  private static Table createTable(
      TestNamespace ns, DatabaseSchema schema, String baseName, List<TagLabel> tags) {
    return SdkClients.adminClient()
        .tables()
        .create(
            new CreateTable()
                .withName(ns.prefix(baseName))
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(
                    List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)))
                .withTags(tags));
  }

  private static TagLabel piiSensitiveTag() {
    return new TagLabel()
        .withTagFQN(PII_SENSITIVE)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private static void addLineage(Table from, Table to) {
    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(from.getEntityReference())
                    .withToEntity(to.getEntityReference()));
    Awaitility.await("lineage edge between freshly created tables")
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .until(
            () -> {
              SdkClients.adminClient().lineage().addLineage(addLineage);
              return true;
            });
  }

  private static IngestionPipeline createIngestionPipeline(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    return SdkClients.adminClient()
        .ingestionPipelines()
        .create(
            new CreateIngestionPipeline()
                .withName(ns.prefix("pipeline"))
                .withPipelineType(PipelineType.METADATA)
                .withService(service.getEntityReference())
                .withSourceConfig(
                    new SourceConfig().withConfig(new DatabaseServiceMetadataPipeline()))
                .withAirflowConfig(new AirflowConfig().withStartDate(new Date())));
  }

  private static WorkflowDefinition createNoOpWorkflow(TestNamespace ns) {
    String workflowJson =
        """
        {
          "name": "%s",
          "description": "No-op workflow a viewer must not trigger or redeploy",
          "trigger": {"type": "noOp"},
          "nodes": [
            {"type": "startEvent", "subType": "startEvent", "name": "start"},
            {"type": "endEvent", "subType": "endEvent", "name": "end"}
          ],
          "edges": [{"from": "start", "to": "end"}]
        }
        """
            .formatted(ns.prefix("noop_workflow"));
    return SdkClients.adminClient()
        .workflowDefinitions()
        .create(JsonUtils.readValue(workflowJson, CreateWorkflowDefinition.class));
  }
}
