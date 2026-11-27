package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.governance.EntityLifecycleStages;
import org.openmetadata.schema.api.governance.EntityTypeLifecycle;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

@Execution(ExecutionMode.CONCURRENT)
class EntityLifecycleStagesIT {
  @Test
  void discoveryReturnsEachEntityTypesOwnVocabularyAndCompleteGraph() {
    EntityLifecycleStages discovery = discover(null);
    EntityTypeLifecycle memory = lifecycleOf(discovery, Entity.CONTEXT_MEMORY);
    EntityTypeLifecycle table = lifecycleOf(discovery, Entity.TABLE);
    assertEquals(codes(ContextMemoryStatus.values()), Set.copyOf(memory.getStages()));
    assertEquals(codes(EntityStatus.values()), Set.copyOf(table.getStages()));
    assertFalse(table.getStages().contains(ContextMemoryStatus.SUPERSEDED.value()));
    assertTrue(discovery.getStages().contains(ContextMemoryStatus.INVALIDATED.value()));
    for (EntityTypeLifecycle lifecycle : discovery.getEntityTypes()) {
      assertEquals(
          Set.copyOf(lifecycle.getStages()),
          lifecycle.getTransitions().stream()
              .map(move -> move.getFrom())
              .collect(Collectors.toSet()));
      assertTrue(
          lifecycle.getTransitions().stream()
              .flatMap(move -> move.getTo().stream())
              .allMatch(lifecycle.getStages()::contains));
    }
  }

  @Test
  void discoveryScopesStatusFiltersToTheSelectedEntityType() {
    EntityLifecycleStages table = discover(Entity.TABLE);
    assertEquals(
        List.of(Entity.TABLE),
        table.getEntityTypes().stream().map(EntityTypeLifecycle::getEntityType).toList());
    assertEquals(codes(EntityStatus.values()), Set.copyOf(table.getStages()));
    EntityLifecycleStages memory = discover(Entity.CONTEXT_MEMORY);
    assertEquals(
        List.of(Entity.CONTEXT_MEMORY),
        memory.getEntityTypes().stream().map(EntityTypeLifecycle::getEntityType).toList());
    assertEquals(codes(ContextMemoryStatus.values()), Set.copyOf(memory.getStages()));
  }

  @Test
  void discoveryResolvesSearchAliasesAndMultipleSelectedTypes() {
    EntityLifecycleStages assets = discover("dataAsset");
    assertFalse(assets.getEntityTypes().isEmpty());
    assertFalse(assets.getStages().contains(ContextMemoryStatus.SUPERSEDED.value()));
    EntityLifecycleStages combined = discover(Entity.TABLE + "," + Entity.CONTEXT_MEMORY);
    assertEquals(
        Set.of(Entity.TABLE, Entity.CONTEXT_MEMORY),
        combined.getEntityTypes().stream()
            .map(EntityTypeLifecycle::getEntityType)
            .collect(Collectors.toSet()));
    assertTrue(combined.getStages().contains(ContextMemoryStatus.SUPERSEDED.value()));
    assertTrue(combined.getStages().contains(EntityStatus.IN_REVIEW.value()));
  }

  private static EntityLifecycleStages discover(String index) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/v1/metadata/types/lifecycleStages",
            null,
            EntityLifecycleStages.class,
            index == null
                ? RequestOptions.builder().build()
                : RequestOptions.builder().queryParam("index", index).build());
  }

  private static EntityTypeLifecycle lifecycleOf(EntityLifecycleStages discovery, String type) {
    return discovery.getEntityTypes().stream()
        .filter(lifecycle -> lifecycle.getEntityType().equals(type))
        .findFirst()
        .orElseThrow();
  }

  private static Set<String> codes(Enum<?>[] statuses) {
    return Arrays.stream(statuses).map(Enum::toString).collect(Collectors.toSet());
  }
}
