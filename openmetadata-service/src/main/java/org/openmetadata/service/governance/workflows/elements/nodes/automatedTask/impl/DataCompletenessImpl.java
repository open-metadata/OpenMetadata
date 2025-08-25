package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RESULT_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.resources.feeds.MessageParser;

@Slf4j
public class DataCompletenessImpl implements JavaDelegate {
  private Expression fieldsToCheckExpr;
  private Expression qualityBandsExpr;
  private Expression treatEmptyStringAsNullExpr;
  private Expression treatEmptyArrayAsNullExpr;
  private Expression inputNamespaceMapExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      // Get configuration
      Map<String, String> inputNamespaceMap =
          JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);
      List<String> fieldsToCheck =
          JsonUtils.readOrConvertValue(fieldsToCheckExpr.getValue(execution), List.class);
      List<Map<String, Object>> qualityBandMaps =
          JsonUtils.readOrConvertValue(qualityBandsExpr.getValue(execution), List.class);
      List<QualityBand> qualityBands = new ArrayList<>();
      for (Map<String, Object> bandMap : qualityBandMaps) {
        QualityBand band = new QualityBand();
        band.setName((String) bandMap.get("name"));
        band.setMinimumScore(((Number) bandMap.get("minimumScore")).doubleValue());
        qualityBands.add(band);
      }
      boolean treatEmptyStringAsNull =
          Boolean.parseBoolean(treatEmptyStringAsNullExpr.getValue(execution).toString());
      boolean treatEmptyArrayAsNull =
          Boolean.parseBoolean(treatEmptyArrayAsNullExpr.getValue(execution).toString());

      // Get the entity
      MessageParser.EntityLink entityLink =
          MessageParser.EntityLink.parse(
              (String)
                  varHandler.getNamespacedVariable(
                      inputNamespaceMap.get(RELATED_ENTITY_VARIABLE), RELATED_ENTITY_VARIABLE));

      EntityInterface entity = Entity.getEntity(entityLink, "*", Include.ALL);
      Map<String, Object> entityMap = JsonUtils.getMap(entity);

      // Calculate completeness
      DataCompletenessResult result =
          calculateCompleteness(
              entityMap,
              fieldsToCheck,
              qualityBands,
              treatEmptyStringAsNull,
              treatEmptyArrayAsNull);

      // Set output variables
      varHandler.setNodeVariable("completenessScore", result.score);
      varHandler.setNodeVariable("filledFieldsCount", result.filledFieldsCount);
      varHandler.setNodeVariable("totalFieldsCount", result.totalFieldsCount);
      varHandler.setNodeVariable("missingFields", result.missingFields);
      varHandler.setNodeVariable("filledFields", result.filledFields);
      varHandler.setNodeVariable("qualityBand", result.qualityBand);

      // Set result variable for edge routing (using the quality band name)
      varHandler.setNodeVariable(RESULT_VARIABLE, result.qualityBand);

      LOG.info(
          "[WorkflowNode][DataCompleteness] EXECUTED: entity='{}' score={}% band='{}' filled={}/{}",
          entityLink,
          result.score,
          result.qualityBand,
          result.filledFieldsCount,
          result.totalFieldsCount);

    } catch (Exception exc) {
      LOG.error(
          "[{}] Data completeness check failed: ",
          getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()),
          exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(exc));
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }

  private DataCompletenessResult calculateCompleteness(
      Map<String, Object> entityMap,
      List<String> fieldsToCheck,
      List<QualityBand> qualityBands,
      boolean treatEmptyStringAsNull,
      boolean treatEmptyArrayAsNull) {

    DataCompletenessResult result = new DataCompletenessResult();
    result.missingFields = new ArrayList<>();
    result.filledFields = new ArrayList<>();

    int totalFieldsToCheck = 0;
    int totalFieldsFilled = 0;

    for (String fieldPath : fieldsToCheck) {
      FieldCompletenessInfo fieldInfo =
          evaluateFieldCompleteness(
              entityMap, fieldPath, treatEmptyStringAsNull, treatEmptyArrayAsNull);

      totalFieldsToCheck += fieldInfo.totalCount;
      totalFieldsFilled += fieldInfo.filledCount;

      // Record detailed results
      if (fieldInfo.isFullyComplete()) {
        result.filledFields.add(
            fieldPath + " (" + fieldInfo.filledCount + "/" + fieldInfo.totalCount + ")");
      } else if (fieldInfo.isPartiallyComplete()) {
        result.missingFields.add(
            fieldPath + " (partial: " + fieldInfo.filledCount + "/" + fieldInfo.totalCount + ")");
      } else {
        result.missingFields.add(fieldPath + " (0/" + fieldInfo.totalCount + ")");
      }
    }

    result.totalFieldsCount = totalFieldsToCheck;
    result.filledFieldsCount = totalFieldsFilled;

    // Calculate percentage
    result.score =
        result.totalFieldsCount > 0
            ? (result.filledFieldsCount * 100.0) / result.totalFieldsCount
            : 0.0;

    // Determine quality band based on score
    result.qualityBand = determineQualityBand(result.score, qualityBands);

    return result;
  }

  /**
   * Evaluates the completeness of a field, handling nested arrays properly.
   * For example, "columns.description" checks description field in ALL column objects.
   */
  private FieldCompletenessInfo evaluateFieldCompleteness(
      Map<String, Object> entityMap,
      String fieldPath,
      boolean treatEmptyStringAsNull,
      boolean treatEmptyArrayAsNull) {

    FieldCompletenessInfo info = new FieldCompletenessInfo();

    // Handle nested fields with dot notation
    String[] parts = fieldPath.split("\\.");

    // Check if this is an array field check (e.g., "columns.description")
    boolean isArrayFieldCheck = parts.length > 1 && !parts[0].endsWith("[]");

    if (isArrayFieldCheck) {
      // Handle array field checks like "columns.description"
      Object arrayField = getNestedValue(entityMap, parts[0]);

      if (arrayField instanceof List) {
        List<?> arrayList = (List<?>) arrayField;
        if (arrayList.isEmpty()) {
          // Empty array - no items to check
          info.totalCount = 1;
          info.filledCount = treatEmptyArrayAsNull ? 0 : 1;
        } else {
          // Check the nested field in each array element
          String nestedPath = fieldPath.substring(parts[0].length() + 1);
          info.totalCount = arrayList.size();

          for (Object item : arrayList) {
            if (item instanceof Map) {
              Object nestedValue = getNestedValue((Map<String, Object>) item, nestedPath);
              if (isFieldFilled(nestedValue, treatEmptyStringAsNull, treatEmptyArrayAsNull)) {
                info.filledCount++;
              }
            }
          }
        }
      } else {
        // Field should be an array but isn't - treat as missing
        info.totalCount = 1;
        info.filledCount = 0;
      }
    } else {
      // Handle simple field or array existence check (e.g., "description" or "columns[]")
      Object value = getNestedValue(entityMap, fieldPath);
      info.totalCount = 1;

      if (fieldPath.endsWith("[]")) {
        // Check if array exists and is non-empty
        String arrayFieldName = fieldPath.substring(0, fieldPath.length() - 2);
        value = getNestedValue(entityMap, arrayFieldName);
        info.filledCount = (value instanceof List && !((List<?>) value).isEmpty()) ? 1 : 0;
      } else {
        // Check if simple field is filled
        info.filledCount =
            isFieldFilled(value, treatEmptyStringAsNull, treatEmptyArrayAsNull) ? 1 : 0;
      }
    }

    return info;
  }

  /**
   * Gets a nested value from a map using dot notation.
   */
  private Object getNestedValue(Map<String, Object> map, String path) {
    if (map == null || path == null) {
      return null;
    }

    String[] parts = path.split("\\.");
    Object current = map;

    for (String part : parts) {
      if (current == null) {
        return null;
      }

      if (current instanceof Map) {
        current = ((Map<?, ?>) current).get(part);
      } else {
        return null;
      }
    }

    return current;
  }

  private boolean isFieldFilled(
      Object value, boolean treatEmptyStringAsNull, boolean treatEmptyArrayAsNull) {

    if (value == null) {
      return false;
    }

    if (value instanceof String) {
      String str = (String) value;
      return treatEmptyStringAsNull ? !str.trim().isEmpty() : true;
    }

    if (value instanceof List) {
      List<?> list = (List<?>) value;
      return treatEmptyArrayAsNull ? !list.isEmpty() : true;
    }

    if (value instanceof Map) {
      Map<?, ?> map = (Map<?, ?>) value;
      return !map.isEmpty();
    }

    // For other types (numbers, booleans), non-null means filled
    return true;
  }

  private String determineQualityBand(double score, List<QualityBand> qualityBands) {
    // Sort bands by minimumScore in descending order to evaluate from highest to lowest
    List<QualityBand> sortedBands = new ArrayList<>(qualityBands);
    sortedBands.sort(Comparator.comparingDouble(QualityBand::getMinimumScore).reversed());

    // Find the matching band
    for (QualityBand band : sortedBands) {
      if (score >= band.getMinimumScore()) {
        return band.getName();
      }
    }

    // If no band matches (shouldn't happen if bands are configured correctly)
    // Return the band with the lowest threshold
    return sortedBands.isEmpty() ? "undefined" : sortedBands.getLast().getName();
  }

  @Data
  public static class QualityBand {
    private String name;
    private Double minimumScore;
  }

  private static class DataCompletenessResult {
    double score = 0.0;
    int filledFieldsCount = 0;
    int totalFieldsCount = 0;
    List<String> missingFields;
    List<String> filledFields;
    String qualityBand = "undefined";
  }

  private static class FieldCompletenessInfo {
    int totalCount = 0;
    int filledCount = 0;

    boolean isFullyComplete() {
      return totalCount > 0 && filledCount == totalCount;
    }

    boolean isPartiallyComplete() {
      return filledCount > 0 && filledCount < totalCount;
    }
  }
}
