package org.openmetadata.sdk.resources;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;

class BaseResourceTest {

  @Mock private HttpClient httpClient;

  private BaseResource<TestEntity> resource;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    resource =
        new BaseResource<TestEntity>(httpClient, "/v1/test-entities") {
          @Override
          protected Class<TestEntity> getEntityClass() {
            return TestEntity.class;
          }
        };
  }

  @Test
  void updateWithSnapshotCanEmitRemoveForClearedField() {
    String id = "entity-1";
    TestEntity original = new TestEntity(id, "table_a", List.of("PII.None"), "old");

    when(httpClient.execute(
            eq(HttpMethod.GET), eq("/v1/test-entities/" + id), isNull(), eq(TestEntity.class)))
        .thenReturn(original);

    ArgumentCaptor<JsonNode> patchCaptor = ArgumentCaptor.forClass(JsonNode.class);
    TestEntity response = new TestEntity(id, "table_a", null, "old");
    when(httpClient.execute(
            eq(HttpMethod.PATCH),
            eq("/v1/test-entities/" + id),
            patchCaptor.capture(),
            eq(TestEntity.class),
            isNull()))
        .thenReturn(response);

    resource.get(id); // stores snapshot with tags populated

    TestEntity updated = new TestEntity(id, "table_a", null, "old");
    TestEntity result = resource.update(id, updated);

    assertNotNull(result);
    JsonNode patch = patchCaptor.getValue();
    assertTrue(hasPatchOp(patch, "remove", "/tags"));
    verify(httpClient, times(1))
        .execute(eq(HttpMethod.GET), eq("/v1/test-entities/" + id), isNull(), eq(TestEntity.class));
  }

  @Test
  void updateWithoutSnapshotDoesNotRemoveUnspecifiedFields() {
    String id = "entity-2";
    TestEntity original = new TestEntity(id, "table_b", List.of("PII.Sensitive"), "old");

    when(httpClient.execute(
            eq(HttpMethod.GET), eq("/v1/test-entities/" + id), isNull(), eq(TestEntity.class)))
        .thenReturn(original);

    ArgumentCaptor<JsonNode> patchCaptor = ArgumentCaptor.forClass(JsonNode.class);
    TestEntity response = new TestEntity(id, "table_b", List.of("PII.Sensitive"), "new");
    when(httpClient.execute(
            eq(HttpMethod.PATCH),
            eq("/v1/test-entities/" + id),
            patchCaptor.capture(),
            eq(TestEntity.class),
            isNull()))
        .thenReturn(response);

    TestEntity updated = new TestEntity();
    updated.setId(id);
    updated.setDescription("new");
    TestEntity result = resource.update(id, updated);

    assertNotNull(result);
    JsonNode patch = patchCaptor.getValue();
    assertFalse(hasPatchOp(patch, "remove", "/tags"));
    assertFalse(hasPatchOp(patch, "remove", "/name"));
    assertTrue(hasPatchOp(patch, "replace", "/description"));
    verify(httpClient, times(1))
        .execute(eq(HttpMethod.GET), eq("/v1/test-entities/" + id), isNull(), eq(TestEntity.class));
  }

  private static boolean hasPatchOp(JsonNode patch, String op, String path) {
    if (patch == null || !patch.isArray()) {
      return false;
    }
    for (JsonNode operation : patch) {
      if (op.equals(operation.path("op").asText())
          && path.equals(operation.path("path").asText())) {
        return true;
      }
    }
    return false;
  }

  static class TestEntity {
    private String id;
    private String name;
    private List<String> tags;
    private String description;

    TestEntity() {}

    TestEntity(String id, String name, List<String> tags, String description) {
      this.id = id;
      this.name = name;
      this.tags = tags;
      this.description = description;
    }

    public String getId() {
      return id;
    }

    public void setId(String id) {
      this.id = id;
    }

    public String getName() {
      return name;
    }

    public void setName(String name) {
      this.name = name;
    }

    public List<String> getTags() {
      return tags;
    }

    public void setTags(List<String> tags) {
      this.tags = tags;
    }

    public String getDescription() {
      return description;
    }

    public void setDescription(String description) {
      this.description = description;
    }
  }
}
