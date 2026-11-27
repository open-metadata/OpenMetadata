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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.sdk.services.dataassets.PipelineService;

/**
 * Regression and fix tests for {@link Pipelines.PipelineFinder} mutation shortcuts when the finder
 * is obtained from {@link Pipelines#findByName(String)}.
 *
 * <p>Background: {@code PipelineFinder.delete()} and {@code PipelineFinder.restore()} historically
 * ignored the finder's {@code isFqn} flag, forwarding the FQN verbatim to the by-id SDK calls.
 * {@code findByName(fqn).delete().confirm()} silently misrouted to {@code DELETE /v1/pipelines/{id}}
 * (UUID-typed), and {@code findByName(fqn).restore().execute()} threw an opaque {@code
 * IllegalArgumentException("Invalid UUID string: ...")} client-side. These tests pin the contract
 * that:
 *
 * <ol>
 *   <li>{@code findByName(fqn).delete().confirm()} routes to the by-FQN delete endpoint (the fix),
 *   <li>{@code find(uuid).delete().confirm()} keeps routing to the by-id endpoint (regression guard),
 *   <li>delete options ({@code recursively}/{@code permanently}) forward on the by-FQN route,
 *   <li>FQNs with special characters are URL-encoded on the wire,
 *   <li>{@code findByName(fqn).restore()} fails fast with an actionable message before any I/O (the
 *       fix), and
 *   <li>the by-id restore path and the {@code findByName(fqn).fetch().delete()} alternative are
 *       unchanged.
 * </ol>
 *
 * <p>The delete tests use a real {@link PipelineService} backed by a mocked {@link HttpClient} (a
 * boundary mock) so they assert the actual REST path that reaches the wire, not internal call
 * wiring.
 */
class PipelineFinderByNameMutationTest {

  @Mock private OpenMetadataClient mockClient;
  @Mock private PipelineService mockPipelines;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    when(mockClient.pipelines()).thenReturn(mockPipelines);
    Pipelines.setDefaultClient(mockClient);
  }

  // ==================== delete() — wire path (real service, mocked http) ====================

  @Test
  void findByName_delete_confirm_hitsDeleteByNameWirePath() throws Exception {
    String fqn = "sample_data.service.pipeline1";
    HttpClient mockHttp = stubRealPipelineService(mockClient);

    Pipelines.findByName(fqn).delete().confirm();

    // The fix: by-FQN delete reaches DELETE /v1/pipelines/name/{fqn}, never the UUID-only /{id}.
    verify(mockHttp)
        .execute(eq(HttpMethod.DELETE), eq("/v1/pipelines/name/" + fqn), isNull(), eq(Void.class));
    verify(mockHttp, never())
        .execute(eq(HttpMethod.DELETE), eq("/v1/pipelines/" + fqn), isNull(), eq(Void.class));
  }

  @Test
  void find_delete_confirm_hitsByIdWirePath() throws Exception {
    String id = UUID.randomUUID().toString();
    HttpClient mockHttp = stubRealPipelineService(mockClient);

    Pipelines.find(id).delete().confirm();

    // Regression guard: by-id delete still appends the id directly (no /name segment).
    verify(mockHttp)
        .execute(eq(HttpMethod.DELETE), eq("/v1/pipelines/" + id), isNull(), eq(Void.class));
    verify(mockHttp, never())
        .execute(eq(HttpMethod.DELETE), eq("/v1/pipelines/name/" + id), isNull(), eq(Void.class));
  }

  @Test
  void findByName_deleteWithOptions_hitsDeleteByNameWirePathWithParams() throws Exception {
    String fqn = "sample_data.service.pipeline1";
    HttpClient mockHttp = stubRealPipelineService(mockClient);

    Pipelines.findByName(fqn).delete().recursively().permanently().confirm();

    ArgumentCaptor<RequestOptions> options = ArgumentCaptor.forClass(RequestOptions.class);
    verify(mockHttp)
        .execute(
            eq(HttpMethod.DELETE),
            eq("/v1/pipelines/name/" + fqn),
            isNull(),
            eq(Void.class),
            options.capture());
    Map<String, String> qp = options.getValue().getQueryParams();
    assertEquals("true", qp.get("recursive"));
    assertEquals("true", qp.get("hardDelete"));
  }

  @Test
  void findByName_delete_encodesSpecialCharsInWirePath() throws Exception {
    String fqn = "sample_data.service.\"pipeline 1\"";
    HttpClient mockHttp = stubRealPipelineService(mockClient);

    Pipelines.findByName(fqn).delete().confirm();

    ArgumentCaptor<String> path = ArgumentCaptor.forClass(String.class);
    verify(mockHttp).execute(eq(HttpMethod.DELETE), path.capture(), isNull(), eq(Void.class));
    assertTrue(
        path.getValue().startsWith("/v1/pipelines/name/"),
        () -> "expected /name segment in path but was: " + path.getValue());
    // The raw FQN (with unencoded quotes/spaces) must never reach the wire verbatim; deleteByName
    // reuses the same buildPathWithEncodedName helper as getByName.
    assertTrue(
        !path.getValue().contains(" "),
        () -> "spaces must be encoded in path but was: " + path.getValue());
    assertTrue(
        !path.getValue().contains("\""),
        () -> "quotes must be encoded in path but was: " + path.getValue());
    assertDoesNotThrow(() -> okhttp3.HttpUrl.parse("http://localhost" + path.getValue()));
  }

  // ==================== restore() — fail fast on by-FQN (the fix) ====================

  @Test
  void findByName_restore_throwsActionableUnsupportedOperation() {
    String fqn = "sample_data.service.pipeline1";

    UnsupportedOperationException ex =
        assertThrows(
            UnsupportedOperationException.class, () -> Pipelines.findByName(fqn).restore());

    // The original defect threw an opaque "Invalid UUID string: ..." with no guidance; the fix must
    // surface an actionable message pointing at the working by-UUID idiom.
    String msg = ex.getMessage();
    assertTrue(msg.contains("UUID"), () -> "message should mention UUID but was: " + msg);
    assertTrue(
        msg.contains("find(uuid).restore()"),
        () -> "message should suggest find(uuid).restore() but was: " + msg);
    assertTrue(
        msg.toLowerCase().contains("findbyname"),
        () -> "message should reference findByName context but was: " + msg);
  }

  @Test
  void findByName_restore_makesNoServiceCall() {
    String fqn = "sample_data.service.pipeline1";

    assertThrows(UnsupportedOperationException.class, () -> Pipelines.findByName(fqn).restore());

    // Fail fast: no lookup (getByName) and no restore attempt before throwing.
    verifyNoInteractions(mockPipelines);
  }

  // ==================== regression guards (unchanged paths) ====================

  @Test
  void find_restore_routesToByIdRestore() throws Exception {
    String id = UUID.randomUUID().toString();
    Pipeline restored = new Pipeline().withId(UUID.fromString(id)).withName("p");
    when(mockPipelines.restore(id)).thenReturn(restored);

    Pipeline result = Pipelines.find(id).restore().execute();

    assertSame(restored, result);
    verify(mockPipelines).restore(id);
  }

  @Test
  void findByName_fetch_delete_routesToByIdDeleteUsingResolvedUuid() {
    String fqn = "sample_data.service.pipeline1";
    UUID resolvedId = UUID.randomUUID();
    Pipeline fetched = new Pipeline().withId(resolvedId).withName("pipeline1");
    when(mockPipelines.getByName(fqn)).thenReturn(fetched);

    // The documented alternative: fetch() resolves via getByName (isFqn branch), then
    // FluentPipeline.delete() uses the entity's UUID, so confirm() hits the by-id delete path.
    Pipelines.findByName(fqn).fetch().delete().confirm();

    verify(mockPipelines).getByName(fqn);
    verify(mockPipelines)
        .delete(eq(resolvedId.toString()), argThat(PipelineFinderByNameMutationTest::emptyParams));
    verify(mockPipelines, never()).deleteByName(any(), any());
  }

  // ==================== helpers ====================

  /**
   * Wires {@code mockClient.pipelines()} to a real {@link PipelineService} backed by {@code
   * mockHttp} so delete tests assert the REST path that actually reaches the wire.
   */
  private static HttpClient stubRealPipelineService(OpenMetadataClient mockClient) {
    HttpClient mockHttp = mock(HttpClient.class);
    when(mockClient.pipelines()).thenReturn(new PipelineService(mockHttp));
    return mockHttp;
  }

  private static boolean emptyParams(Map<String, String> p) {
    return p == null || p.isEmpty();
  }
}
