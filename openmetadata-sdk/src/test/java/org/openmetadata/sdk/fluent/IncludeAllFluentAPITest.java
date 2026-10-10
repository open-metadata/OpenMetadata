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
package org.openmetadata.sdk.fluent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.services.ai.AIApplicationService;
import org.openmetadata.sdk.services.dataassets.DashboardService;
import org.openmetadata.sdk.services.dataassets.PipelineService;
import org.openmetadata.sdk.services.glossary.GlossaryTermService;

/**
 * Regression tests for the {@code includeAll()} convenience method on the data-asset fluent
 * finders. {@code includeAll()} builds the {@code fields} query parameter that is sent to the
 * OpenMetadata REST API. The server validates each requested field strictly against the entity's
 * {@link JsonPropertyOrder @JsonPropertyOrder} (see {@code EntityUtil.Fields} /
 * {@code Entity.getEntityFields}); an unknown field makes the request fail with HTTP 400
 * {@code invalid field: ...}.
 *
 * <p>Historically {@code includeAll()} on {@link Pipelines}, {@link Dashboards}, {@link
 * GlossaryTerms} and {@link AIApplications} emitted the singular names {@code "owner"} and/or
 * {@code "domain"} (and, for {@link GlossaryTerms}, the non-existent {@code "followers"}), so
 * every call to {@code includeAll().fetch()} threw instead of returning the entity.
 *
 * <p>These tests pin the contract that the emitted {@code fields} set, for every finder:
 *
 * <ol>
 *   <li>equals exactly the documented plural relation set for that entity,
 *   <li>never contains the singular names {@code owner} / {@code domain},
 *   <li>is a subset of the entity's {@code @JsonPropertyOrder} — the exact set the server
 *       validates against — so the request can never produce {@code invalid field: ...}.
 * </ol>
 */
class IncludeAllFluentAPITest {

  @Mock private OpenMetadataClient mockClient;
  @Mock private PipelineService mockPipelines;
  @Mock private DashboardService mockDashboards;
  @Mock private GlossaryTermService mockGlossaryTerms;
  @Mock private AIApplicationService mockAIApplications;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    when(mockClient.pipelines()).thenReturn(mockPipelines);
    when(mockClient.dashboards()).thenReturn(mockDashboards);
    when(mockClient.glossaryTerms()).thenReturn(mockGlossaryTerms);
    when(mockClient.aiApplications()).thenReturn(mockAIApplications);
    Pipelines.setDefaultClient(mockClient);
    Dashboards.setDefaultClient(mockClient);
    GlossaryTerms.setDefaultClient(mockClient);
    AIApplications.setDefaultClient(mockClient);
  }

  // ==================== Pipelines ====================

  @Test
  void pipelinesIncludeAll_emitsPluralSchemaValidFields() throws Exception {
    String id = UUID.randomUUID().toString();
    Pipeline stub = new Pipeline().withId(UUID.fromString(id)).withName("p");
    when(mockPipelines.get(eq(id), anyString())).thenReturn(stub);

    Pipeline result = Pipelines.find(id).includeAll().fetch().get();

    assertSame(stub, result);
    Set<String> emitted = captureGetFields(mockPipelines, id);
    assertEquals(Set.of("owners", "tags", "followers", "domains"), emitted);
    assertAllFieldsAllowed(emitted, Pipeline.class);
    assertSingularKeywordsAbsent(emitted);
  }

  @Test
  void pipelinesIncludeAll_byName_emitsPluralSchemaValidFields() throws Exception {
    String fqn = "sample_data.service.pipeline1";
    Pipeline stub = new Pipeline().withId(UUID.randomUUID()).withName("pipeline1");
    when(mockPipelines.getByName(eq(fqn), anyString())).thenReturn(stub);

    Pipeline result = Pipelines.findByName(fqn).includeAll().fetch().get();

    assertSame(stub, result);
    Set<String> emitted = captureGetByNameFields(mockPipelines, fqn);
    assertEquals(Set.of("owners", "tags", "followers", "domains"), emitted);
    assertAllFieldsAllowed(emitted, Pipeline.class);
    assertSingularKeywordsAbsent(emitted);
  }

  // ==================== Dashboards ====================

  @Test
  void dashboardsIncludeAll_emitsPluralSchemaValidFields() throws Exception {
    String id = UUID.randomUUID().toString();
    Dashboard stub = new Dashboard().withId(UUID.fromString(id)).withName("d");
    when(mockDashboards.get(eq(id), anyString())).thenReturn(stub);

    Dashboard result = Dashboards.find(id).includeAll().fetch().get();

    assertSame(stub, result);
    Set<String> emitted = captureGetFields(mockDashboards, id);
    assertEquals(Set.of("owners", "tags", "followers", "domains"), emitted);
    assertAllFieldsAllowed(emitted, Dashboard.class);
    assertSingularKeywordsAbsent(emitted);
  }

  @Test
  void dashboardsIncludeAll_byName_emitsPluralSchemaValidFields() throws Exception {
    String fqn = "sample_data.service.dashboard1";
    Dashboard stub = new Dashboard().withId(UUID.randomUUID()).withName("dashboard1");
    when(mockDashboards.getByName(eq(fqn), anyString())).thenReturn(stub);

    Dashboard result = Dashboards.findByName(fqn).includeAll().fetch().get();

    assertSame(stub, result);
    Set<String> emitted = captureGetByNameFields(mockDashboards, fqn);
    assertEquals(Set.of("owners", "tags", "followers", "domains"), emitted);
    assertAllFieldsAllowed(emitted, Dashboard.class);
    assertSingularKeywordsAbsent(emitted);
  }

  // ==================== GlossaryTerms ====================
  // GlossaryTerm has no "followers" relation (it uses "votes"), so includeAll() must NOT emit
  // "followers" either — otherwise the HTTP 400 just shifts from "invalid field: owner" to
  // "invalid field: followers".

  @Test
  void glossaryTermsIncludeAll_emitsPluralSchemaValidFields() throws Exception {
    String id = UUID.randomUUID().toString();
    GlossaryTerm stub = new GlossaryTerm().withId(UUID.fromString(id)).withName("term");
    when(mockGlossaryTerms.get(eq(id), anyString())).thenReturn(stub);

    GlossaryTerm result = GlossaryTerms.find(id).includeAll().fetch().get();

    assertSame(stub, result);
    Set<String> emitted = captureGetFields(mockGlossaryTerms, id);
    assertEquals(Set.of("owners", "tags", "domains"), emitted);
    assertAllFieldsAllowed(emitted, GlossaryTerm.class);
    assertSingularKeywordsAbsent(emitted);
    assertFalse(emitted.contains("followers"), "GlossaryTerm has no 'followers' field");
  }

  @Test
  void glossaryTermsIncludeAll_byName_emitsPluralSchemaValidFields() throws Exception {
    String fqn = "glossary.term1";
    GlossaryTerm stub = new GlossaryTerm().withId(UUID.randomUUID()).withName("term1");
    when(mockGlossaryTerms.getByName(eq(fqn), anyString())).thenReturn(stub);

    GlossaryTerm result = GlossaryTerms.findByName(fqn).includeAll().fetch().get();

    assertSame(stub, result);
    Set<String> emitted = captureGetByNameFields(mockGlossaryTerms, fqn);
    assertEquals(Set.of("owners", "tags", "domains"), emitted);
    assertAllFieldsAllowed(emitted, GlossaryTerm.class);
    assertSingularKeywordsAbsent(emitted);
    assertFalse(emitted.contains("followers"), "GlossaryTerm has no 'followers' field");
  }

  // ==================== AIApplications ====================

  @Test
  void aiApplicationsIncludeAll_emitsPluralDomainsField() throws Exception {
    String id = UUID.randomUUID().toString();
    AIApplication stub = new AIApplication().withId(UUID.fromString(id)).withName("app");
    when(mockAIApplications.get(eq(id), anyString())).thenReturn(stub);

    AIApplication result = AIApplications.find(id).includeAll().fetch().get();

    assertSame(stub, result);
    Set<String> emitted = captureGetFields(mockAIApplications, id);
    assertEquals(Set.of("owners", "tags", "followers", "domains"), emitted);
    assertAllFieldsAllowed(emitted, AIApplication.class);
    assertFalse(emitted.contains("domain"), "singular 'domain' must not be emitted");
  }

  @Test
  void aiApplicationsIncludeAll_byName_emitsPluralDomainsField() throws Exception {
    String fqn = "service.app1";
    AIApplication stub = new AIApplication().withId(UUID.randomUUID()).withName("app1");
    when(mockAIApplications.getByName(eq(fqn), anyString())).thenReturn(stub);

    AIApplication result = AIApplications.findByName(fqn).includeAll().fetch().get();

    assertSame(stub, result);
    Set<String> emitted = captureGetByNameFields(mockAIApplications, fqn);
    assertEquals(Set.of("owners", "tags", "followers", "domains"), emitted);
    assertAllFieldsAllowed(emitted, AIApplication.class);
    assertFalse(emitted.contains("domain"), "singular 'domain' must not be emitted");
  }

  // ==================== Sibling-method guards ====================
  // includeOwners() is the fine-grained counterpart that already used the correct plural; lock
  // that in so a future copy-paste cannot regress it too.

  @Test
  void pipelinesIncludeOwners_emitsPluralOwnersOnly() throws Exception {
    String id = UUID.randomUUID().toString();
    Pipeline stub = new Pipeline().withId(UUID.fromString(id)).withName("p");
    when(mockPipelines.get(eq(id), anyString())).thenReturn(stub);

    Pipelines.find(id).includeOwners().fetch();

    Set<String> emitted = captureGetFields(mockPipelines, id);
    assertEquals(Set.of("owners"), emitted);
    assertSingularKeywordsAbsent(emitted);
  }

  @Test
  void glossaryTermsIncludeOwners_emitsPluralOwnersOnly() throws Exception {
    String id = UUID.randomUUID().toString();
    GlossaryTerm stub = new GlossaryTerm().withId(UUID.fromString(id)).withName("term");
    when(mockGlossaryTerms.get(eq(id), anyString())).thenReturn(stub);

    GlossaryTerms.find(id).includeOwners().fetch();

    Set<String> emitted = captureGetFields(mockGlossaryTerms, id);
    assertEquals(Set.of("owners"), emitted);
    assertSingularKeywordsAbsent(emitted);
  }

  // ==================== helpers ====================

  private Set<String> captureGetFields(PipelineService service, String id) {
    ArgumentCaptor<String> fields = ArgumentCaptor.forClass(String.class);
    verify(service).get(eq(id), fields.capture());
    return parseFields(fields.getValue());
  }

  private Set<String> captureGetByNameFields(PipelineService service, String fqn) {
    ArgumentCaptor<String> fields = ArgumentCaptor.forClass(String.class);
    verify(service).getByName(eq(fqn), fields.capture());
    return parseFields(fields.getValue());
  }

  private Set<String> captureGetFields(DashboardService service, String id) {
    ArgumentCaptor<String> fields = ArgumentCaptor.forClass(String.class);
    verify(service).get(eq(id), fields.capture());
    return parseFields(fields.getValue());
  }

  private Set<String> captureGetByNameFields(DashboardService service, String fqn) {
    ArgumentCaptor<String> fields = ArgumentCaptor.forClass(String.class);
    verify(service).getByName(eq(fqn), fields.capture());
    return parseFields(fields.getValue());
  }

  private Set<String> captureGetFields(GlossaryTermService service, String id) {
    ArgumentCaptor<String> fields = ArgumentCaptor.forClass(String.class);
    verify(service).get(eq(id), fields.capture());
    return parseFields(fields.getValue());
  }

  private Set<String> captureGetByNameFields(GlossaryTermService service, String fqn) {
    ArgumentCaptor<String> fields = ArgumentCaptor.forClass(String.class);
    verify(service).getByName(eq(fqn), fields.capture());
    return parseFields(fields.getValue());
  }

  private Set<String> captureGetFields(AIApplicationService service, String id) {
    ArgumentCaptor<String> fields = ArgumentCaptor.forClass(String.class);
    verify(service).get(eq(id), fields.capture());
    return parseFields(fields.getValue());
  }

  private Set<String> captureGetByNameFields(AIApplicationService service, String fqn) {
    ArgumentCaptor<String> fields = ArgumentCaptor.forClass(String.class);
    verify(service).getByName(eq(fqn), fields.capture());
    return parseFields(fields.getValue());
  }

  private static Set<String> parseFields(String fields) {
    return new HashSet<>(Arrays.asList(fields.replace(" ", "").split(",")));
  }

  /** The exact set the server validates the {@code fields} query parameter against. */
  private static Set<String> allowedFields(Class<?> entityClass) {
    JsonPropertyOrder order = entityClass.getAnnotation(JsonPropertyOrder.class);
    return new HashSet<>(Arrays.asList(order.value()));
  }

  /**
   * Asserts every emitted field is a member of the entity's {@code @JsonPropertyOrder}; if any is
   * not, the server would reject the request with HTTP 400 {@code invalid field: ...} (see {@code
   * EntityUtil.Fields} / {@code Entity.getEntityFields}).
   */
  private static void assertAllFieldsAllowed(Set<String> emitted, Class<?> entityClass) {
    Set<String> allowed = allowedFields(entityClass);
    Set<String> invalid = new HashSet<>(emitted);
    invalid.removeAll(allowed);
    assertTrue(
        invalid.isEmpty(),
        entityClass.getSimpleName()
            + ".includeAll() emitted fields not in @JsonPropertyOrder (would cause HTTP 400): "
            + invalid);
  }

  private static void assertSingularKeywordsAbsent(Set<String> emitted) {
    assertFalse(emitted.contains("owner"), "singular 'owner' must not be emitted");
    assertFalse(emitted.contains("domain"), "singular 'domain' must not be emitted");
  }
}
