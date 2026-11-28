package org.openmetadata.it.tests;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.it.tests.ChangeRequestITSupport.awaitOpenApprovalTask;
import static org.openmetadata.it.tests.ChangeRequestITSupport.deployHookWorkflowFor;
import static org.openmetadata.it.tests.ChangeRequestITSupport.filterScopedTo;
import static org.openmetadata.it.tests.ChangeRequestITSupport.onlyPendingRequest;
import static org.openmetadata.it.tests.ChangeRequestITSupport.resolveAs;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.tests.mcp.McpTestBase;
import org.openmetadata.it.tests.mcp.McpTestUtils;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespace.EntityRoot;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestStatus;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.approval.ChangeRequestService;

/** The MCP relation write must retain the canonical human approval hold and decision path. */
@Isolated
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
class McpOntologyApprovalIT extends McpTestBase {
  @AfterEach
  void cleanup(final TestNamespace namespace) {
    final List<EntityRoot> roots = namespace.drainTrackedRoots();
    try {
      for (final EntityRoot root : roots) {
        if (Entity.WORKFLOW_DEFINITION.equals(root.entityType())) {
          SdkClients.adminClient().workflowDefinitions().delete(root.id());
        }
      }
    } finally {
      NamespaceCleanup.deleteRoots(
          roots.stream()
              .filter(root -> !Entity.WORKFLOW_DEFINITION.equals(root.entityType()))
              .toList());
    }
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void heldRelationIsPublishedOnlyAfterItsAssignedReviewersApproval(
      final boolean approve, final TestNamespace namespace) throws Exception {
    final Glossary glossary = glossary(namespace);
    final GlossaryTerm source = term(glossary, "Source");
    final GlossaryTerm target = term(glossary, "Target");
    deployHookWorkflowFor(
        namespace,
        Entity.GLOSSARY_TERM,
        "\"relatedTerms\"",
        "",
        filterScopedTo(Entity.GLOSSARY_TERM, source.getFullyQualifiedName()));

    final JsonNode result = proposeRelation(source, target);
    final ChangeRequest request = onlyPendingRequest(source.getId());
    assertThat(result.path("_operation").asText()).isEqualTo("pendingApproval");
    assertThat(result.path("changeRequestId").asText()).isEqualTo(request.getId().toString());
    assertThat(result.has("changed")).isFalse();
    assertThat(request.getRequestedBy()).isEqualTo(SharedEntities.get().USER2.getName());
    assertUnpublished(source);

    final Task task = awaitOpenApprovalTask(source.getFullyQualifiedName());
    assertThat(task.getId()).isEqualTo(ChangeRequestService.get(request.getId()).getTaskId());
    assertRequesterCannotApprove(task);
    resolveAs(
        SdkClients.user1Client(),
        task,
        approve ? "approve" : "reject",
        approve ? TaskResolutionType.Approved : TaskResolutionType.Rejected,
        1);
    awaitDecision(request, approve);
    assertDecision(source, target, approve);
  }

  private static Glossary glossary(final TestNamespace namespace) {
    final Glossary glossary =
        SdkClients.adminClient()
            .glossaries()
            .create(
                new CreateGlossary()
                    .withName(
                        GlossaryTestFactory.STATUS_TEST_GLOSSARY_PREFIX
                            + "__"
                            + namespace.shortPrefix())
                    .withDescription("MCP approval fixture")
                    .withReviewers(List.of(SharedEntities.get().USER1.getEntityReference())));
    return namespace.trackRoot(Entity.GLOSSARY, glossary);
  }

  private static GlossaryTerm term(final Glossary glossary, final String name) {
    return SdkClients.adminClient()
        .glossaryTerms()
        .create(
            new CreateGlossaryTerm()
                .withGlossary(glossary.getFullyQualifiedName())
                .withName(name)
                .withOwners(List.of(SharedEntities.get().USER2.getEntityReference()))
                .withDescription("MCP approval fixture"));
  }

  private JsonNode proposeRelation(final GlossaryTerm source, final GlossaryTerm target)
      throws Exception {
    final String email = SharedEntities.get().USER2.getEmail();
    final String token = "Bearer " + JwtAuthProvider.tokenFor(email, email, new String[] {}, 3600);
    final JsonNode response =
        executeMcpRequest(
            McpTestUtils.createToolCallRequest(
                "create_term_relation",
                Map.of(
                    "sourceTermId", source.getId().toString(),
                    "targetTermId", target.getId().toString(),
                    "relationType", "relatedTo")),
            token);
    assertThat(response.has("error")).as(response.toString()).isFalse();
    assertThat(response.path("result").path("isError").asBoolean())
        .as(response.toString())
        .isFalse();
    return response.path("result").path("structuredContent");
  }

  private static void assertRequesterCannotApprove(final Task task) {
    final OpenMetadataException refused =
        assertThrows(
            OpenMetadataException.class,
            () ->
                resolveAs(
                    SdkClients.user2Client(), task, "approve", TaskResolutionType.Approved, 1));
    assertThat(refused.getStatusCode()).isEqualTo(403);
  }

  private static void awaitDecision(final ChangeRequest request, final boolean approve) {
    final ChangeRequestStatus expected =
        approve ? ChangeRequestStatus.APPLIED : ChangeRequestStatus.REJECTED;
    Awaitility.await("reviewer decision completes the held relation")
        .atMost(Duration.ofSeconds(120))
        .untilAsserted(
            () ->
                assertThat(ChangeRequestService.get(request.getId()).getStatus())
                    .isEqualTo(expected));
  }

  private static void assertUnpublished(final GlossaryTerm source) {
    final GlossaryTerm current =
        SdkClients.adminClient().glossaryTerms().get(source.getId().toString(), "relatedTerms");
    assertThat(current.getRelatedTerms()).isNullOrEmpty();
    assertThat(current.getVersion()).isEqualTo(source.getVersion());
  }

  private static void assertDecision(
      final GlossaryTerm source, final GlossaryTerm target, final boolean approve) {
    if (approve) {
      final GlossaryTerm current =
          SdkClients.adminClient().glossaryTerms().get(source.getId().toString(), "relatedTerms");
      assertThat(current.getRelatedTerms()).hasSize(1);
      final var relation = current.getRelatedTerms().getFirst();
      assertThat(relation.getTerm().getId()).isEqualTo(target.getId());
      assertThat(relation.getProvenance()).isEqualTo(RelationProvenance.AI_SUGGESTED);
      assertThat(relation.getCreatedBy()).isEqualTo(SharedEntities.get().USER2.getName());
    } else {
      assertUnpublished(source);
    }
  }
}
