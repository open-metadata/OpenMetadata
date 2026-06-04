package org.openmetadata.service.search.indexes;

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.LinkedHashMap;
import java.util.Map;
import org.openmetadata.schema.entity.ai.LLMModel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

public class LlmModelIndex implements TaggableIndex, ServiceBackedIndex, LineageIndex {
  private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

  final LLMModel llmModel;

  public LlmModelIndex(LLMModel llmModel) {
    this.llmModel = llmModel;
  }

  @Override
  public Object getEntity() {
    return llmModel;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.LLM_MODEL;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    // LlmModel has a flat governance shape (governanceStatus enum + top-level
    // detection/evidence/remediationActions). Synthesize a governanceMetadata-shaped
    // map so the shared AIGovernanceIndexProjection produces the same projection
    // keys as AIApplication and McpServer.
    Map<String, Object> shim = new LinkedHashMap<>();
    if (llmModel.getGovernanceStatus() != null) {
      shim.put(
          "registrationStatus", normalizeRegistration(llmModel.getGovernanceStatus().toString()));
    }
    if (llmModel.getDetection() != null) {
      shim.put(
          "detection", JsonUtils.getObjectMapper().convertValue(llmModel.getDetection(), MAP_TYPE));
    }
    AIGovernanceIndexProjection.project(doc, shim, llmModel.getModelType());

    return doc;
  }

  private static String normalizeRegistration(String governanceStatus) {
    String result;
    switch (governanceStatus) {
      case "Approved":
        result = "Approved";
        break;
      case "PendingReview":
        result = "PendingApproval";
        break;
      case "Rejected":
        result = "Rejected";
        break;
      case "Unauthorized":
        result = "Unregistered";
        break;
      default:
        result = "Registered";
    }
    return result;
  }
}
