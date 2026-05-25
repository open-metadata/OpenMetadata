package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.ENTITY_LIST_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import io.github.resilience4j.retry.Retry;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;

@Slf4j
public class DataCompletenessImpl implements JavaDelegate {
  private Expression fieldsToCheckExpr;
  private Expression qualityBandsExpr;
  private Expression inputNamespaceMapExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
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

      List<String> entityList =
          WorkflowVariableHandler.getEntityList(inputNamespaceMap, varHandler);

      Map<String, EntityInterface> entityMap =
          Entity.getEntitiesByLinks(entityList, "*", Include.ALL);

      // Per-band entity lists and per-entity results
      Map<String, List<String>> entitiesByBand = new LinkedHashMap<>();
      Map<String, Object> entityResults = new LinkedHashMap<>();
      DataCompletenessResult lastResult = null;

      Retry retry = Retry.of("data-completeness", Workflow.TASK_RETRY_CONFIG);

      List<String> failedEntities = new ArrayList<>();

      for (String entityLinkStr : entityList) {
        EntityInterface entity = entityMap.get(entityLinkStr);
        if (entity == null) {
          failedEntities.add(entityLinkStr);
          continue;
        }
        try {
          DataCompletenessResult result =
              Retry.decorateSupplier(
                      retry,
                      () ->
                          calculateCompleteness(
                              JsonUtils.getMap(entity), fieldsToCheck, qualityBands))
                  .get();
          lastResult = result;

          entitiesByBand
              .computeIfAbsent(result.qualityBand, k -> new ArrayList<>())
              .add(entityLinkStr);
          entityResults.put(
              entityLinkStr,
              Map.of(
                  "score",
                  result.score,
                  "band",
                  result.qualityBand,
                  "missingFieldsCount",
                  result.missingFields.size(),
                  "filledFieldsCount",
                  result.filledFields.size()));

          LOG.debug(
              "[WorkflowNode][DataCompleteness] entity='{}' score={}% band='{}' filled={}/{}",
              entityLinkStr,
              result.score,
              result.qualityBand,
              result.filledFieldsCount,
              result.totalFieldsCount);
        } catch (Exception e) {
          failedEntities.add(entityLinkStr);
          LOG.error(
              "[WorkflowNode][DataCompleteness] Failed entity '{}' after retries: {}",
              entityLinkStr,
              e.getMessage(),
              e);
        }
      }

      if (!failedEntities.isEmpty()) {
        varHandler.setNodeVariable("failedEntities", failedEntities);
        LOG.warn(
            "[WorkflowNode][DataCompleteness] {}/{} entities failed processing",
            failedEntities.size(),
            entityList.size());
      }

      // Per-band entity lists — ALL bands stored, empty or not.
      // When all flags are false the split gateway falls through to its defaultFlow.
      for (QualityBand band : qualityBands) {
        List<String> bandEntities = entitiesByBand.getOrDefault(band.getName(), List.of());
        varHandler.setNodeVariable(band.getName() + "_" + ENTITY_LIST_VARIABLE, bandEntities);
        varHandler.setNodeVariable(branchFlagVariable(band.getName()), !bandEntities.isEmpty());
      }

      // Priority band = highest minimumScore band that has entities
      String priorityBand =
          qualityBands.stream()
              .sorted(Comparator.comparingDouble(QualityBand::getMinimumScore).reversed())
              .map(QualityBand::getName)
              .filter(entitiesByBand::containsKey)
              .findFirst()
              .orElse("undefined");

      LOG.info(
          "[WorkflowNode][DataCompleteness] Processed {} entities, priorityBand='{}', bands={}",
          entityList.size(),
          priorityBand,
          entitiesByBand.keySet());

      varHandler.setNodeVariable("entityResults", entityResults);

      // Scalar outputs for backward compat when processing a single entity
      if (entityList.size() == 1 && lastResult != null) {
        varHandler.setNodeVariable("completenessScore", lastResult.score);
        varHandler.setNodeVariable("filledFieldsCount", lastResult.filledFieldsCount);
        varHandler.setNodeVariable("totalFieldsCount", lastResult.totalFieldsCount);
        varHandler.setNodeVariable("qualityBand", lastResult.qualityBand);
        storeFieldList(varHandler, "missingFields", lastResult.missingFields);
        storeFieldList(varHandler, "filledFields", lastResult.filledFields);
      }

    } catch (Exception exc) {
      LOG.error(
          "[{}] Data completeness check failed: ",
          getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()),
          exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(exc));
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }

  public static String branchFlagVariable(String branch) {
    return "has_" + branch + "_entities";
  }

  private void storeFieldList(
      WorkflowVariableHandler varHandler, String varName, List<String> fields) {
    if (fields.size() <= 50) {
      varHandler.setNodeVariable(varName, fields);
    } else {
      List<String> truncated = new ArrayList<>(fields.subList(0, 50));
      truncated.add("[+" + (fields.size() - 50) + " more]");
      varHandler.setNodeVariable(varName, truncated);
    }
  }

  private DataCompletenessResult calculateCompleteness(
      Map<String, Object> entityMap, List<String> fieldsToCheck, List<QualityBand> qualityBands) {

    DataCompletenessResult result = new DataCompletenessResult();
    result.missingFields = new ArrayList<>();
    result.filledFields = new ArrayList<>();

    int totalFieldsToCheck = 0;
    int totalFieldsFilled = 0;

    for (String fieldPath : fieldsToCheck) {
      FieldCompletenessInfo fieldInfo = evaluateFieldCompleteness(entityMap, fieldPath);

      totalFieldsToCheck += fieldInfo.totalCount;
      totalFieldsFilled += fieldInfo.filledCount;

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

    result.score =
        result.totalFieldsCount > 0
            ? (result.filledFieldsCount * 100.0) / result.totalFieldsCount
            : 0.0;

    result.qualityBand = determineQualityBand(result.score, qualityBands);

    return result;
  }

  /**
   * Evaluates the completeness of a field, handling nested arrays properly.
   * Automatically detects arrays and validates them as non-null AND non-empty.
   * For example:
   * - "columns" - auto-detects it's an array and checks non-null AND non-empty
   * - "columns.description" - checks description field in ALL column objects
   * - "reviewers" - auto-detects it's an array and checks non-empty
   */
  private FieldCompletenessInfo evaluateFieldCompleteness(
      Map<String, Object> entityMap, String fieldPath) {

    FieldCompletenessInfo info = new FieldCompletenessInfo();

    String[] parts = fieldPath.split("\\.");

    if (parts.length > 1) {
      Object firstField = getNestedValue(entityMap, parts[0]);

      if (firstField instanceof List<?> arrayList) {
        // It's an array field check like "columns.description"
        if (arrayList.isEmpty()) {
          info.totalCount = 1;
          info.filledCount = 0;
        } else {
          String nestedPath = fieldPath.substring(parts[0].length() + 1);
          info.totalCount = arrayList.size();

          for (Object item : arrayList) {
            if (item instanceof Map) {
              Object nestedValue = getNestedValue((Map<String, Object>) item, nestedPath);
              if (isFieldFilled(nestedValue)) {
                info.filledCount++;
              }
            }
          }
        }
      } else {
        Object value = getNestedValue(entityMap, fieldPath);
        info.totalCount = 1;
        if (value instanceof List<?> list) {
          info.filledCount = !list.isEmpty() ? 1 : 0;
        } else {
          info.filledCount = isFieldFilled(value) ? 1 : 0;
        }
      }
    } else {
      Object value = getNestedValue(entityMap, fieldPath);
      info.totalCount = 1;

      if (value instanceof List<?> list) {
        info.filledCount = !list.isEmpty() ? 1 : 0;
      } else {
        info.filledCount = isFieldFilled(value) ? 1 : 0;
      }
    }

    return info;
  }

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

  private boolean isFieldFilled(Object value) {

    if (value == null) {
      return false;
    }

    if (value instanceof String str) {
      return !str.trim().isEmpty();
    }

    if (value instanceof List<?> list) {
      return !list.isEmpty();
    }

    if (value instanceof Map<?, ?> map) {
      return !map.isEmpty();
    }

    return true;
  }

  private String determineQualityBand(double score, List<QualityBand> qualityBands) {
    List<QualityBand> sortedBands = new ArrayList<>(qualityBands);
    sortedBands.sort(Comparator.comparingDouble(QualityBand::getMinimumScore).reversed());

    for (QualityBand band : sortedBands) {
      if (score >= band.getMinimumScore()) {
        return band.getName();
      }
    }

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
