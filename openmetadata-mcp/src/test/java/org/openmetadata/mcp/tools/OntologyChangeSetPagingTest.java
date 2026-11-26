package org.openmetadata.mcp.tools;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.mcp.util.McpResponseTrim;
import org.openmetadata.mcp.util.PageCursor;
import org.openmetadata.schema.api.configuration.MCPConfiguration;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.OntologyChangeApplicationResult;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationResult;
import org.openmetadata.schema.type.OntologyChangeOperationResultStatus;
import org.openmetadata.schema.type.OntologyChangeOperationState;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.resources.ontology.OntologyChangeSetResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;
import org.openmetadata.service.util.RestUtil;

/** Real tool dispatch/budgeting with a canonical REST boundary double, not live RBAC or storage. */
class OntologyChangeSetPagingTest {
  private static final UUID ID = UUID.fromString("4df2f4e7-c158-45bb-98d2-741c2d99736b");
  private static final CatalogSecurityContext CONTEXT =
      new CatalogSecurityContext(() -> "alice", "https", "Bearer", Set.of(), false);

  @ParameterizedTest
  @ValueSource(strings = {"created", "updated", "unchanged", "pendingApproval"})
  void largeWriteAcknowledgementsRetainIdentityAndCanonicalOutcome(final String outcome) {
    final OntologyChangeSet proposal =
        proposal(60)
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsUpdated(
                        List.of(
                            new FieldChange()
                                .withName("state")
                                .withOldValue("DRAFT")
                                .withNewValue("SUBMITTED"))));
    final OntologyChangeSetResource resource = mock(OntologyChangeSetResource.class);
    final UUID pendingId = UUID.randomUUID();
    final boolean create = outcome.equals("created");
    final var response =
        Response.status(create ? 201 : outcome.equals("pendingApproval") ? 202 : 200)
            .entity(proposal);
    if (!create) {
      response.header(
          RestUtil.CHANGE_CUSTOM_HEADER,
          outcome.equals("unchanged")
              ? EventType.ENTITY_NO_CHANGE.value()
              : EventType.ENTITY_UPDATED.value());
    }
    if (outcome.equals("pendingApproval")) {
      response.header(RestUtil.PENDING_CHANGE_HEADER, pendingId);
    }
    when(resource.get(any(), any(), any(), any(), any())).thenReturn(proposal);
    when(resource.create(any(), any(), any(CreateOntologyChangeSet.class)))
        .thenReturn(response.build());
    when(resource.submit(any(), any(), any(), any())).thenReturn(response.build());
    final OntologyTool action =
        tool(resource, create ? OntologyTool.Action.CREATE_CHANGE_SET : OntologyTool.Action.SUBMIT);
    final Map<String, Object> values =
        create
            ? Map.of(
                "name",
                "reviewedProposal",
                "displayName",
                "Review",
                "description",
                "For review",
                "operations",
                JsonUtils.getMap(proposal).get("operations"))
            : Map.of("id", ID.toString(), "lease", Map.of("sessionId", "alice", "version", 1));
    try (final var events = mockStatic(McpChangeEventUtil.class)) {
      final JsonNode acknowledgement =
          wire(
              action, values, create ? "create_ontology_change_set" : "submit_ontology_change_set");
      assertThat(acknowledgement.path("truncated").asBoolean()).isFalse();
      assertThat(acknowledgement.path("id").asText()).isEqualTo(ID.toString());
      assertThat(acknowledgement.path("state").asText()).isEqualTo("DRAFT");
      assertThat(acknowledgement.path("operationCount").asInt()).isEqualTo(60);
      assertThat(acknowledgement.path("operations")).isEmpty();
      assertThat(acknowledgement.path("_operation").asText()).isEqualTo(outcome);
      assertThat(acknowledgement.path("readTool").asText()).isEqualTo("get_ontology_change_set");
      if (outcome.equals("pendingApproval")) {
        assertThat(acknowledgement.path("changeRequestId").asText())
            .isEqualTo(pendingId.toString());
        assertThat(acknowledgement.has("changed")).isFalse();
        events.verifyNoInteractions();
      } else {
        if (outcome.equals("unchanged")) {
          assertThat(acknowledgement.has("changed")).isFalse();
        } else {
          assertThat(acknowledgement.path("changed"))
              .isEqualTo(JsonUtils.valueToTree(List.of("state")));
        }
        events.verify(
            () ->
                McpChangeEventUtil.publishChangeEvent(
                    proposal,
                    create
                        ? EventType.ENTITY_CREATED
                        : outcome.equals("unchanged")
                            ? EventType.ENTITY_NO_CHANGE
                            : EventType.ENTITY_UPDATED,
                    "alice"));
      }
    }
  }

  @Test
  void defaultReadOfSixtyMaximumLengthRationalesRemainsReadable() {
    final OntologyChangeSet proposal = proposal(60);
    assertThat(JsonUtils.pojoToJson(proposal).length())
        .isGreaterThan(McpResponseTrim.MAX_RESPONSE_CHARS);
    final JsonNode first = wire(tool(proposal), Map.of("id", ID.toString()));
    assertThat(first.path("truncated").asBoolean()).isFalse();
    assertThat(first.path("operations").size()).isBetween(1, 25);
    assertThat(first.path("hasMore").asBoolean()).isTrue();
    assertThat(first.path("nextCursor").asText()).isNotBlank();
    assertThat(first.path("operations").get(0).path("rationale").asText()).hasSize(2000);
    assertThat(first.path("operations")).hasSize(10);
  }

  @ParameterizedTest
  @ValueSource(ints = {1, 10, 25})
  void allOperationPagesReconstructTheExactTimelineWithoutMutation(final int limit) {
    final OntologyChangeSet proposal = proposal(60);
    final String original = JsonUtils.pojoToJson(proposal);
    final List<JsonNode> read =
        collect(tool(proposal), Map.of("id", ID.toString(), "limit", limit));
    assertThat(JsonUtils.valueToTree(read))
        .isEqualTo(JsonUtils.valueToTree(proposal.getOperations()));
    assertThat(JsonUtils.pojoToJson(proposal)).isEqualTo(original);
  }

  @Test
  void lowerConfiguredBudgetFitsHeterogeneousEscapedItemsWithoutCuttingThem() {
    final OntologyChangeSet proposal = proposal(20);
    for (int index = 0; index < proposal.getOperations().size(); index++) {
      proposal
          .getOperations()
          .get(index)
          .setModelId(index % 2 == 0 ? "heavy".repeat(2500) : "\"\\\n".repeat(700));
    }
    try (final var settings = mockStatic(SecurityConfigurationManager.class)) {
      settings
          .when(SecurityConfigurationManager::getCurrentMcpConfig)
          .thenReturn(new MCPConfiguration().withMaxResponseChars(25_000));
      final JsonNode first = wire(tool(proposal), Map.of("id", ID.toString(), "limit", 25));
      assertThat(first.path("returnedCount").asInt()).isBetween(1, 19);
      final List<JsonNode> all = collect(tool(proposal), Map.of("id", ID.toString(), "limit", 25));
      assertThat(JsonUtils.valueToTree(all))
          .isEqualTo(JsonUtils.valueToTree(proposal.getOperations()));
    }
  }

  @Test
  void applicationResultPagesAreCompleteAndDoNotResendTheOperationTimeline() {
    final OntologyChangeSet proposal = appliedProposal();
    final JsonNode operationPage = wire(tool(proposal), Map.of("id", ID.toString()));
    assertThat(operationPage.at("/applicationResult/results")).isEmpty();
    assertThat(operationPage.path("applicationResultCount").asInt()).isEqualTo(60);
    final List<JsonNode> results =
        collect(tool(proposal), Map.of("id", ID.toString(), "section", "applicationResults"));
    assertThat(JsonUtils.valueToTree(results))
        .isEqualTo(JsonUtils.valueToTree(proposal.getApplicationResult().getResults()));
  }

  @Test
  void scopeIdentifiersRemainDiscoverableWithoutUnboundedReferenceDescriptions() {
    final OntologyChangeSet proposal =
        proposal(1)
            .withGlossaries(
                IntStream.range(0, 60)
                    .mapToObj(
                        index ->
                            new EntityReference()
                                .withId(new UUID(1, index))
                                .withType("glossary")
                                .withName("Scope" + index)
                                .withFullyQualifiedName("Scope" + index)
                                .withDescription("scope description".repeat(2000)))
                    .toList());
    final List<JsonNode> scopes =
        collect(tool(proposal), Map.of("id", ID.toString(), "section", "glossaries", "limit", 25));
    assertThat(scopes).hasSize(60);
    assertThat(scopes)
        .extracting(scope -> scope.path("id").asText())
        .containsExactlyElementsOf(
            proposal.getGlossaries().stream().map(scope -> scope.getId().toString()).toList());
    assertThat(scopes).allSatisfy(scope -> assertThat(scope.has("description")).isFalse());
    proposal.setOntology(
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("ontology")
            .withName("Native")
            .withFullyQualifiedName("Native")
            .withDescription("native".repeat(30_000)));
    final JsonNode nativePage = wire(tool(proposal), Map.of("id", ID.toString()));
    assertThat(nativePage.at("/ontology/id").asText())
        .isEqualTo(proposal.getOntology().getId().toString());
    assertThat(nativePage.path("ontology").has("description")).isFalse();
  }

  @Test
  void bulkyDescriptionsAndChangeDiffsCannotHideThePagedOperations() {
    final OntologyChangeSet proposal =
        proposal(60)
            .withDescription("description".repeat(20_000))
            .withDisplayName("display".repeat(20_000));
    final ChangeDescription diff =
        new ChangeDescription()
            .withFieldsAdded(
                List.of(
                    new FieldChange()
                        .withName("operations")
                        .withNewValue(proposal.getOperations())));
    proposal.setChangeDescription(diff);
    proposal.setIncrementalChangeDescription(diff);
    final JsonNode page = wire(tool(proposal), Map.of("id", ID.toString()));
    assertThat(page.path("operations")).hasSize(10);
    assertThat(
            page.has("description")
                || page.has("displayName")
                || page.has("changeDescription")
                || page.has("incrementalChangeDescription"))
        .isFalse();
    assertThat(proposal.getDescription()).hasSize("description".length() * 20_000);
  }

  @ParameterizedTest
  @MethodSource("invalidLimits")
  void invalidLimitsDoNotSilentlyCoerceOrOverflow(final Object limit) {
    assertThatThrownBy(() -> wire(tool(proposal(2)), Map.of("id", ID.toString(), "limit", limit)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("limit");
  }

  static Stream<Object> invalidLimits() {
    return Stream.of(-1, 0, 26, Long.MAX_VALUE, 1.5, "10", Double.NaN, Double.POSITIVE_INFINITY);
  }

  @ParameterizedTest
  @ValueSource(strings = {"", "OPERATIONS", "other"})
  void invalidSectionsAreRejected(final String section) {
    assertThatThrownBy(
            () -> wire(tool(proposal(2)), Map.of("id", ID.toString(), "section", section)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("section");
  }

  @Test
  void nullSectionIsABadArgumentInsteadOfAServerFault() {
    final Map<String, Object> values = new HashMap<>(Map.of("id", ID.toString()));
    values.put("section", null);
    assertThatThrownBy(() -> wire(tool(proposal(1)), values))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("section");
  }

  @ParameterizedTest
  @MethodSource("invalidCursors")
  void malformedOrWrongKindCursorsAreRejectedInsteadOfRestarting(final String cursor) {
    assertThatThrownBy(() -> wire(tool(proposal(2)), Map.of("id", ID.toString(), "cursor", cursor)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("cursor");
  }

  static Stream<String> invalidCursors() {
    return Stream.of(
        "bad-token",
        " ",
        "x".repeat(513),
        PageCursor.encodeOffset(1),
        PageCursor.encodeKeyset("missing-snapshot"));
  }

  @ParameterizedTest
  @ValueSource(strings = {"-1", "2147483648", "3"})
  void invalidCursorOffsetsAreRejected(final String offset) {
    final OntologyTool tool = tool(proposal(2));
    final String valid =
        wire(tool, Map.of("id", ID.toString(), "limit", 1)).path("nextCursor").asText();
    final String snapshot = PageCursor.decode(valid).orElseThrow().after().split(":")[0];
    final String cursor = PageCursor.encodeKeyset(snapshot + ":" + offset);
    assertThatThrownBy(() -> wire(tool, Map.of("id", ID.toString(), "cursor", cursor)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("cursor");
  }

  @Test
  void cursorsBindTheProposalSectionAndContentEvenWhenVersionDoesNotChange() {
    final OntologyChangeSet proposal = proposal(3);
    final OntologyTool tool = tool(proposal);
    final String cursor =
        wire(tool, Map.of("id", ID.toString(), "limit", 1)).path("nextCursor").asText();
    assertThatThrownBy(
            () ->
                wire(
                    tool,
                    Map.of("id", ID.toString(), "section", "applicationResults", "cursor", cursor)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("restart");
    final OntologyChangeSet other =
        JsonUtils.convertValue(proposal, OntologyChangeSet.class).withId(UUID.randomUUID());
    assertThatThrownBy(
            () -> wire(tool(other), Map.of("id", other.getId().toString(), "cursor", cursor)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("restart");
    proposal.getOperations().get(1).setRationale("Changed in the same version session");
    assertThatThrownBy(() -> wire(tool, Map.of("id", ID.toString(), "cursor", cursor)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("restart");
  }

  @Test
  void continuationStillCallsTheCanonicalAuthorizationBoundaryBeforeDecodingCursor() {
    final OntologyChangeSetResource resource = mock(OntologyChangeSetResource.class);
    final ForbiddenException denied =
        new ForbiddenException("Caller no longer has draft scope access");
    when(resource.get(any(), any(), any(), any(), any())).thenReturn(proposal(3)).thenThrow(denied);
    final OntologyTool tool = tool(resource);
    final String cursor =
        wire(tool, Map.of("id", ID.toString(), "limit", 1)).path("nextCursor").asText();
    assertThat(cursor).isNotBlank();
    assertThatThrownBy(() -> wire(tool, Map.of("id", ID.toString(), "cursor", cursor)))
        .isSameAs(denied);
    assertThatThrownBy(
            () -> wire(tool, Map.of("id", ID.toString(), "cursor", "not-even-a-valid-cursor")))
        .isSameAs(denied);
  }

  @Test
  void anEmptyProposalHasNoContinuationForEitherSection() {
    for (final String section : List.of("operations", "applicationResults", "glossaries")) {
      final JsonNode page =
          wire(tool(proposal(0)), Map.of("id", ID.toString(), "section", section));
      assertThat(page.path("returnedCount").asInt()).isZero();
      assertThat(page.path("hasMore").asBoolean()).isFalse();
      assertThat(page.has("nextCursor")).isFalse();
    }
  }

  @Test
  void oneUnpageableItemKeepsTheExistingExplicitOversizeEnvelope() {
    final OntologyChangeSet proposal = proposal(1);
    proposal.getOperations().getFirst().setModelId("m".repeat(McpResponseTrim.MAX_RESPONSE_CHARS));
    final JsonNode page = wire(tool(proposal), Map.of("id", ID.toString(), "limit", 1));
    assertThat(page.path("truncated").asBoolean()).isTrue();
    assertThat(page.toString()).contains("get_ontology_change_set");
    assertThat(proposal.getOperations().getFirst().getModelId())
        .hasSize(McpResponseTrim.MAX_RESPONSE_CHARS);
  }

  @Test
  void oversizedMetadataCannotCreateAZeroProgressContinuation() {
    final OntologyChangeSet proposal = proposal(2).withName("invalid-legacy-name".repeat(10_000));
    assertThatThrownBy(() -> wire(tool(proposal), Map.of("id", ID.toString())))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("metadata");
  }

  private static List<JsonNode> collect(
      final OntologyTool tool, final Map<String, Object> arguments) {
    final Map<String, Object> values = new HashMap<>(arguments);
    final List<JsonNode> all = new ArrayList<>();
    boolean more = true;
    for (int pageNumber = 0; more && pageNumber < 61; pageNumber++) {
      final JsonNode page = wire(tool, values);
      assertThat(page.path("truncated").asBoolean()).isFalse();
      final String section = page.path("section").asText();
      final JsonNode items =
          section.equals("applicationResults")
              ? page.at("/applicationResult/results")
              : page.path(section);
      assertThat(items.size()).isEqualTo(page.path("returnedCount").asInt());
      items.forEach(all::add);
      more = page.path("hasMore").asBoolean();
      if (more) {
        assertThat(items.size()).isPositive();
        values.put("cursor", page.path("nextCursor").asText());
      } else {
        assertThat(page.has("nextCursor")).isFalse();
      }
    }
    assertThat(more).isFalse();
    return all;
  }

  private static OntologyChangeSet appliedProposal() {
    final OntologyChangeSet proposal = proposal(60).withState(OntologyChangeSetState.APPLIED);
    return proposal.withApplicationResult(
        new OntologyChangeApplicationResult()
            .withAppliedAt(1L)
            .withAppliedBy("reviewer")
            .withOperationsProcessed(60)
            .withOperationsApplied(0)
            .withOperationsFailed(60)
            .withResults(
                proposal.getOperations().stream()
                    .map(
                        operation ->
                            new OntologyChangeOperationResult()
                                .withOperationId(operation.getId())
                                .withStatus(OntologyChangeOperationResultStatus.FAILED)
                                .withMessage("m".repeat(2000)))
                    .toList()));
  }

  private static OntologyChangeSet proposal(final int count) {
    final List<OntologyChangeOperation> operations =
        IntStream.range(0, count)
            .mapToObj(
                index ->
                    new OntologyChangeOperation()
                        .withId(new UUID(0, index + 1))
                        .withOperationType(OntologyChangeOperationType.DELETE_TERM)
                        .withState(OntologyChangeOperationState.ACTIVE)
                        .withTargetId(UUID.randomUUID())
                        .withBaseVersion(0.1)
                        .withRationale("e".repeat(2000)))
            .toList();
    return new OntologyChangeSet()
        .withId(ID)
        .withName("reviewedProposal")
        .withDisplayName("Review")
        .withDescription("A legitimate larger proposal")
        .withFullyQualifiedName("reviewedProposal")
        .withState(OntologyChangeSetState.DRAFT)
        .withVersion(0.1)
        .withUpdatedAt(1L)
        .withUndoCursor(count)
        .withOperations(operations);
  }

  private static OntologyTool tool(final OntologyChangeSet proposal) {
    final OntologyChangeSetResource resource = mock(OntologyChangeSetResource.class);
    when(resource.get(any(), any(), any(), any(), any())).thenReturn(proposal);
    return tool(resource);
  }

  private static OntologyTool tool(final OntologyChangeSetResource resource) {
    return tool(resource, OntologyTool.Action.GET_CHANGE_SET);
  }

  private static OntologyTool tool(
      final OntologyChangeSetResource resource, final OntologyTool.Action action) {
    final OntologyTool.Resources resources =
        new OntologyTool.Resources() {
          @Override
          public <T> T get(final Class<T> type) {
            return type.cast(resource);
          }
        };
    return new OntologyTool(
        action,
        resources,
        context -> OntologyToolSupport.uriInfo("https://catalog.example", "/api", context));
  }

  private static JsonNode wire(final OntologyTool tool, final Map<String, Object> values) {
    return wire(tool, values, "get_ontology_change_set");
  }

  private static JsonNode wire(
      final OntologyTool tool, final Map<String, Object> values, final String name) {
    final Object raw = tool.execute(mock(Authorizer.class), CONTEXT, values);
    final var result = DefaultToolContext.applyBudget(raw, name);
    assertThat(result.json().length()).isLessThanOrEqualTo(McpResponseTrim.maxResponseChars());
    return JsonUtils.valueToTree(result.payload());
  }
}
