package org.openmetadata.service.search.indexes;

import java.util.HashMap;
import java.util.Map;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;

public record PipelineExecutionIndex(Pipeline pipeline, PipelineStatus pipelineStatus)
    implements SearchIndex {

  @Override
  public Object getEntity() {
    return new PipelineExecutionData(pipeline, pipelineStatus);
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

    return executionDoc;
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
