package org.openmetadata.mcp.tools;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.api.data.AcquireOntologyEditLock;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.api.data.OntologyChangeSetCommand;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.schema.type.OntologyEditLock;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.OpenMetadataApplicationConfigHolder;
import org.openmetadata.service.resources.glossary.GlossaryTermResource;
import org.openmetadata.service.resources.ontology.OntologyChangeSetResource;
import org.openmetadata.service.resources.ontology.OntologyEditLockResource;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.util.RestUtil;

/** REST resources are boundary doubles here; live authorization/persistence is covered by the IT. */
class OntologyToolExecutionTest {
  private static final UUID ID = UUID.fromString("30028612-7a62-4f0b-94ef-84073f65bedd");
  private static final CatalogSecurityContext CONTEXT =
      new CatalogSecurityContext(() -> "alice", "https", "Bearer", Set.of(), false);

  @Test
  void typedRelationForcesAiProvenanceWithoutClientLifecycleOrAttribution() {
    final UUID target = UUID.randomUUID();
    final GlossaryTermResource resource = mock(GlossaryTermResource.class);
    doAnswer(
            invocation -> {
              assertThat(invocation.getArgument(1, CatalogSecurityContext.class)).isSameAs(CONTEXT);
              assertThat(invocation.getArgument(2, UUID.class)).isEqualTo(ID);
              final TermRelation relation = invocation.getArgument(3);
              assertThat(relation.getTerm().getId()).isEqualTo(target);
              assertThat(relation.getTerm().getType()).isEqualTo("glossaryTerm");
              assertThat(relation.getRelationType()).isEqualTo("broader");
              assertThat(relation.getProvenance()).isEqualTo(RelationProvenance.AI_SUGGESTED);
              assertThat(relation.getStatus()).isNull();
              assertThat(relation.getCreatedBy()).isNull();
              assertThat(relation.getCreatedAt()).isNull();
              return updated(new GlossaryTerm().withId(ID).withName("Customer"));
            })
        .when(resource)
        .addTermRelation(any(), any(), any(), any());
    try (final MockedStatic<McpChangeEventUtil> events = mockStatic(McpChangeEventUtil.class);
        final MockedStatic<Entity> registry = mockStatic(Entity.class)) {
      final Object result =
          tool(OntologyTool.Action.CREATE_RELATION, resource)
              .execute(
                  mock(Authorizer.class),
                  null,
                  CONTEXT,
                  Map.of(
                      "sourceTermId",
                      ID.toString(),
                      "targetTermId",
                      target.toString(),
                      "relationType",
                      "broader"));
      assertThat(((Map<?, ?>) result).get("_operation")).isEqualTo("updated");
    }
  }

  @Test
  void createsThroughTheCanonicalRequestAndPreservesDraftResponse() {
    final OntologyChangeSetResource resource = mock(OntologyChangeSetResource.class);
    doAnswer(
            invocation -> {
              assertThat(invocation.getArgument(1, CatalogSecurityContext.class)).isSameAs(CONTEXT);
              final CreateOntologyChangeSet request = invocation.getArgument(2);
              assertThat(request.getName()).isEqualTo("proposal");
              assertThat(request.getState()).isNull();
              return Response.status(201).entity(changeSet(OntologyChangeSetState.DRAFT)).build();
            })
        .when(resource)
        .create(any(), any(), any(CreateOntologyChangeSet.class));
    try (final MockedStatic<McpChangeEventUtil> events = mockStatic(McpChangeEventUtil.class)) {
      final Object result =
          tool(OntologyTool.Action.CREATE_CHANGE_SET, resource)
              .execute(
                  mock(Authorizer.class),
                  CONTEXT,
                  Map.of(
                      "name",
                      "proposal",
                      "displayName",
                      "Proposal",
                      "description",
                      "For review",
                      "operations",
                      List.of()));
      assertThat(JsonUtils.valueToTree(result).path("state").asText()).isEqualTo("DRAFT");
    }
  }

  @Test
  void returnsPagedReadAndSubmitsTheExactLeaseTokenWithoutApplying() {
    final OntologyChangeSetResource resource = mock(OntologyChangeSetResource.class);
    final OntologyChangeSet draft = changeSet(OntologyChangeSetState.DRAFT);
    when(resource.get(
            any(),
            eq(CONTEXT),
            eq(ID),
            eq("operations,applicationResult"),
            eq(Include.NON_DELETED)))
        .thenReturn(draft);
    final var page =
        JsonUtils.valueToTree(
            tool(OntologyTool.Action.GET_CHANGE_SET, resource)
                .execute(mock(Authorizer.class), CONTEXT, Map.of("id", ID.toString())));
    assertThat(page.path("id").asText()).isEqualTo(ID.toString());
    assertThat(page.path("state").asText()).isEqualTo("DRAFT");
    assertThat(page.path("operations").size()).isZero();
    assertThat(page.path("hasMore").asBoolean()).isFalse();
    doAnswer(
            invocation -> {
              assertThat(invocation.getArgument(1, CatalogSecurityContext.class)).isSameAs(CONTEXT);
              final OntologyChangeSetCommand command = invocation.getArgument(3);
              assertThat(command.getLease().getSessionId()).isEqualTo("session");
              assertThat(command.getLease().getVersion()).isEqualTo(7);
              return updated(changeSet(OntologyChangeSetState.SUBMITTED));
            })
        .when(resource)
        .submit(any(), any(), any(), any());
    try (final MockedStatic<McpChangeEventUtil> events = mockStatic(McpChangeEventUtil.class)) {
      final Object submitted =
          tool(OntologyTool.Action.SUBMIT, resource)
              .execute(
                  mock(Authorizer.class),
                  CONTEXT,
                  Map.of(
                      "id", ID.toString(), "lease", Map.of("sessionId", "session", "version", 7)));
      assertThat(JsonUtils.valueToTree(submitted).path("state").asText()).isEqualTo("SUBMITTED");
    }
  }

  @Test
  void explicitLeaseAcquisitionRenewalAndReleasePreserveTheCallerAndVersion() {
    final OntologyChangeSetResource proposals = mock(OntologyChangeSetResource.class);
    final OntologyEditLockResource locks = mock(OntologyEditLockResource.class);
    final OntologyEditLock lease = new OntologyEditLock().withVersion(8);
    doAnswer(
            invocation -> {
              assertThat(invocation.getArgument(0, CatalogSecurityContext.class)).isSameAs(CONTEXT);
              final AcquireOntologyEditLock request = invocation.getArgument(1);
              assertThat(request.getResourceType()).isEqualTo("ontologyChangeSet");
              assertThat(request.getResourceId()).isEqualTo(ID);
              assertThat(request.getSessionId()).isEqualTo("session");
              assertThat(request.getExpectedVersion()).isEqualTo(7);
              assertThat(request.getLeaseSeconds()).isEqualTo(120);
              return lease;
            })
        .when(locks)
        .acquire(any(), any());
    when(locks.release(eq(CONTEXT), eq("ontologyChangeSet"), eq(ID), eq("session")))
        .thenReturn(Response.noContent().build());
    final OntologyTool tool = tool(OntologyTool.Action.LEASE, proposals, locks);
    assertThat(
            tool.execute(
                mock(Authorizer.class),
                CONTEXT,
                Map.of(
                    "id",
                    ID.toString(),
                    "action",
                    "ACQUIRE",
                    "sessionId",
                    "session",
                    "expectedVersion",
                    7,
                    "leaseSeconds",
                    120)))
        .isSameAs(lease);
    assertThat(
            tool.execute(
                mock(Authorizer.class),
                CONTEXT,
                Map.of("id", ID.toString(), "action", "RELEASE", "sessionId", "session")))
        .isEqualTo(new OntologyTool.ReleasedLease(ID, "session", true));
  }

  @Test
  void configuredUriContextDoesNotDependOnRdf() {
    try (final MockedStatic<SettingsCache> settings = mockStatic(SettingsCache.class);
        final MockedStatic<OpenMetadataApplicationConfigHolder> configs =
            mockStatic(OpenMetadataApplicationConfigHolder.class)) {
      final OpenMetadataApplicationConfig config = mock(OpenMetadataApplicationConfig.class);
      when(config.getApiRootPath()).thenReturn("/api/");
      configs.when(OpenMetadataApplicationConfigHolder::getInstance).thenReturn(config);
      final OpenMetadataBaseUrlConfiguration base =
          new OpenMetadataBaseUrlConfiguration()
              .withOpenMetadataUrl("https://catalog.example/metadata/");
      settings
          .when(
              () ->
                  SettingsCache.getSetting(
                      SettingsType.OPEN_METADATA_BASE_URL_CONFIGURATION,
                      OpenMetadataBaseUrlConfiguration.class))
          .thenReturn(base);
      assertThat(OntologyToolSupport.uriInfo(CONTEXT).getBaseUri().toString())
          .isEqualTo("https://catalog.example/metadata/api/");
      base.setOpenMetadataUrl(" ");
      assertThatThrownBy(() -> OntologyToolSupport.uriInfo(CONTEXT))
          .isInstanceOf(IllegalStateException.class)
          .hasMessageContaining("not configured");
    }
  }

  @Test
  void releaseFailureRemainsAnErrorInsteadOfASuccessfulToolResult() {
    final OntologyChangeSetResource proposals = mock(OntologyChangeSetResource.class);
    final OntologyEditLockResource locks = mock(OntologyEditLockResource.class);
    when(locks.release(any(), any(), any(), any())).thenReturn(Response.status(403).build());
    assertThatThrownBy(
            () ->
                tool(OntologyTool.Action.LEASE, proposals, locks)
                    .execute(
                        mock(Authorizer.class),
                        CONTEXT,
                        Map.of("id", ID.toString(), "action", "RELEASE", "sessionId", "session")))
        .isInstanceOf(WebApplicationException.class);
  }

  private static OntologyChangeSet changeSet(final OntologyChangeSetState state) {
    return new OntologyChangeSet().withId(ID).withName("proposal").withState(state);
  }

  private static Response updated(final EntityInterface<?> entity) {
    return Response.ok(entity)
        .header(RestUtil.CHANGE_CUSTOM_HEADER, EventType.ENTITY_UPDATED)
        .build();
  }

  private static OntologyTool tool(final OntologyTool.Action action, final Object... resources) {
    final OntologyTool.Resources provider =
        new OntologyTool.Resources() {
          @Override
          public <T> T get(final Class<T> type) {
            return List.of(resources).stream()
                .filter(type::isInstance)
                .map(type::cast)
                .findFirst()
                .orElseThrow();
          }
        };
    return new OntologyTool(
        action,
        provider,
        context -> OntologyToolSupport.uriInfo("https://catalog.example", "/api/", context));
  }
}
