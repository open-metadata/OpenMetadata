package org.openmetadata.service.search.indexes;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.HashMap;
import java.util.Map;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;

public record PipelineExecutionIndex(Pipeline pipeline, PipelineStatus pipelineStatus)
    implements SearchIndex {
  /** The pipeline fields a run document copies from its pipeline. */
  public static final String ACCESS_FIELDS = "owners,domains,tags,tasks,certification";

  @Override
  public Object getEntity() {
    return new PipelineExecutionData(pipeline, pipelineStatus);
  }

  @Override
  public String getEntityTypeName() {
    return Entity.PIPELINE_EXECUTION;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Map<String, Object> executionDoc = new HashMap<>();

    executionDoc.put("pipelineId", pipeline.getId().toString());
    executionDoc.put("pipelineFqn", pipeline.getFullyQualifiedName());
    executionDoc.put("pipelineName", pipeline.getName());

    if (pipeline.getService() != null) {
      executionDoc.put("serviceName", pipeline.getService().getName());
    }
    executionDoc.put("serviceType", pipeline.getServiceType().value());

    executionDoc.put("executionId", pipelineStatus.getExecutionId());
    executionDoc.put("timestamp", pipelineStatus.getTimestamp());
    executionDoc.put("executionStatus", pipelineStatus.getExecutionStatus().value());

    if (pipelineStatus.getEndTime() != null) {
      executionDoc.put("endTime", pipelineStatus.getEndTime());
      Long runtime = pipelineStatus.getEndTime() - pipelineStatus.getTimestamp();
      executionDoc.put("runtime", runtime);
    }

    if (pipelineStatus.getVersion() != null) {
      executionDoc.put("version", pipelineStatus.getVersion());
    }

    executionDoc.put("entityType", "pipelineExecution");
    executionDoc.put("deleted", false);
    executionDoc.putAll(accessFields(pipeline));

    return executionDoc;
  }

  /**
   * The pipeline's fields search access control decides on, shaped as on the pipeline's own
   * document, so a run is found exactly where its pipeline is. The pipeline must be loaded with
   * {@link #ACCESS_FIELDS} (ADR:2026-11-03-search-applies-the-same-access-rules-as-entity-reads).
   */
  @SuppressWarnings("unchecked")
  public static Map<String, Object> accessFields(Pipeline pipeline) {
    ParseTags tags = new ParseTags(Entity.getEntityTags(Entity.PIPELINE, pipeline));
    Map<String, Object> fields = new HashMap<>();
    fields.put("owners", listOrEmpty(pipeline.getOwners()));
    fields.put("domains", listOrEmpty(pipeline.getDomains()));
    fields.put("tags", tags.getTags());
    fields.put("tier", tags.getTierTag());
    fields.put("certification", pipeline.getCertification());
    fields.put("service", pipeline.getService());
    return JsonUtils.convertValue(fields, Map.class);
  }

  public static Pipeline withAccessFields(EntityReference pipeline) {
    return pipeline.getId() != null
        ? Entity.getEntity(Entity.PIPELINE, pipeline.getId(), ACCESS_FIELDS, Include.ALL)
        : Entity.getEntityByName(
            Entity.PIPELINE, pipeline.getFullyQualifiedName(), ACCESS_FIELDS, Include.ALL);
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = new HashMap<>();
    fields.put("pipelineName", 10.0f);
    fields.put("pipelineFqn", 8.0f);
    fields.put("serviceName", 5.0f);
    fields.put("executionId", 3.0f);
    return fields;
  }

  public static String getDocumentId(Pipeline pipeline, PipelineStatus pipelineStatus) {
    return String.format(
        "%s_%s_%s",
        pipeline.getFullyQualifiedName(),
        pipelineStatus.getExecutionId(),
        pipelineStatus.getTimestamp());
  }

  public static class PipelineExecutionData {
    private final Pipeline pipeline;
    private final PipelineStatus pipelineStatus;

    public PipelineExecutionData(Pipeline pipeline, PipelineStatus pipelineStatus) {
      this.pipeline = pipeline;
      this.pipelineStatus = pipelineStatus;
    }

    public Pipeline getPipeline() {
      return pipeline;
    }

    public PipelineStatus getPipelineStatus() {
      return pipelineStatus;
    }
  }
}
