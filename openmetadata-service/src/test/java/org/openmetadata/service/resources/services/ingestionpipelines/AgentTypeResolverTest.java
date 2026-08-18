package org.openmetadata.service.resources.services.ingestionpipelines;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ingestionPipelines.AgentType;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;

class AgentTypeResolverTest {

  private static Set<String> resolvedTypes(AgentType agentType, String pipelineType) {
    return Set.of(AgentTypeResolver.resolvePipelineTypes(agentType, pipelineType).split(","));
  }

  @Test
  void metadataAgentTypeResolvesToTheMetadataPipelineTypes() {
    assertEquals(
        Set.of(
            "metadata", "usage", "lineage", "profiler", "autoClassification", "dbt", "policyAgent"),
        resolvedTypes(AgentType.METADATA, null));
  }

  @Test
  void metadataAgentTypeExcludesEveryPipelineTypeThatIsNotAMetadataAgent() {
    Set<String> metadataTypes = resolvedTypes(AgentType.METADATA, null);
    List<PipelineType> excluded =
        Arrays.stream(PipelineType.values())
            .filter(pipelineType -> !metadataTypes.contains(pipelineType.value()))
            .toList();
    assertEquals(
        List.of(
            PipelineType.TEST_SUITE,
            PipelineType.DATA_INSIGHT,
            PipelineType.ELASTIC_SEARCH_REINDEX,
            PipelineType.APPLICATION),
        excluded,
        "A new pipelineType must be explicitly classified as a metadata agent or not");
  }

  @Test
  void applicationAgentTypeResolvesToTheApplicationPipelineType() {
    assertEquals(
        "application", AgentTypeResolver.resolvePipelineTypes(AgentType.APPLICATION, null));
  }

  @Test
  void noAgentTypeLeavesThePipelineTypeFilterUntouched() {
    assertNull(AgentTypeResolver.resolvePipelineTypes(null, null));
    assertEquals("dbt,usage", AgentTypeResolver.resolvePipelineTypes(null, "dbt,usage"));
  }

  @Test
  void bothFiltersAreIntersected() {
    assertEquals(
        Set.of("lineage", "dbt"), resolvedTypes(AgentType.METADATA, "lineage,dbt,application"));
  }

  @Test
  void anEmptyIntersectionMatchesNoPipeline() {
    assertTrue(AgentTypeResolver.resolvePipelineTypes(AgentType.METADATA, "application").isEmpty());
  }

  @Test
  void blankPipelineTypeValuesAreIgnoredWhenIntersecting() {
    assertEquals(Set.of("usage"), resolvedTypes(AgentType.METADATA, " usage , "));
  }
}
