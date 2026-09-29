package org.openmetadata.service.resources.services.ingestionpipelines;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Arrays;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.services.ingestionPipelines.AgentType;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;

/**
 * Expands the {@code agentType} list filter into the {@code pipelineType} values it stands for, so
 * that clients listing agents do not have to keep that mapping in sync themselves.
 */
public final class AgentTypeResolver {
  private static final String VALUE_SEPARATOR = ",";

  private static final Map<AgentType, Set<PipelineType>> PIPELINE_TYPES_BY_AGENT_TYPE =
      Map.of(
          AgentType.METADATA,
          EnumSet.of(
              PipelineType.METADATA,
              PipelineType.USAGE,
              PipelineType.LINEAGE,
              PipelineType.PROFILER,
              PipelineType.AUTO_CLASSIFICATION,
              PipelineType.DBT,
              PipelineType.POLICY_AGENT),
          AgentType.APPLICATION,
          EnumSet.of(PipelineType.APPLICATION));

  private AgentTypeResolver() {}

  /**
   * Returns the {@code pipelineType} filter value the query should run with. When both filters are
   * set they are intersected, so a caller can narrow an agent group down to a single pipeline type.
   * An empty intersection resolves to an empty value, which matches no pipeline.
   */
  public static String resolvePipelineTypes(AgentType agentType, String pipelineType) {
    String result = pipelineType;
    if (agentType != null) {
      Set<String> agentPipelineTypes = pipelineTypeValues(agentType);
      if (!nullOrEmpty(pipelineType)) {
        agentPipelineTypes.retainAll(splitValues(pipelineType));
      }
      result = String.join(VALUE_SEPARATOR, agentPipelineTypes);
    }
    return result;
  }

  private static Set<String> pipelineTypeValues(AgentType agentType) {
    return PIPELINE_TYPES_BY_AGENT_TYPE.get(agentType).stream()
        .map(PipelineType::value)
        .collect(Collectors.toCollection(LinkedHashSet::new));
  }

  private static Set<String> splitValues(String commaSeparatedValues) {
    return Arrays.stream(commaSeparatedValues.split(VALUE_SEPARATOR))
        .map(String::trim)
        .filter(value -> !value.isEmpty())
        .collect(Collectors.toSet());
  }
}
