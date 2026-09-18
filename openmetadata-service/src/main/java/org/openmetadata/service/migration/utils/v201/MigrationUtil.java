package org.openmetadata.service.migration.utils.v201;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.search.GlobalSettings;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.migration.utils.SearchSettingsMergeUtil;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
public final class MigrationUtil {
  private static final String AUTOPILOT_WORKFLOW_NAME = "AutoPilotWorkflow";
  private static final double PREVIOUS_KEYWORD_WEIGHT = 0.4;
  private static final double PREVIOUS_SEMANTIC_WEIGHT = 0.6;
  private static final double KEYWORD_WEIGHT = 0.6;
  private static final double SEMANTIC_WEIGHT = 0.4;
  private static final double WEIGHT_TOLERANCE = 1e-9;

  private MigrationUtil() {}

  /**
   * Re-deploy AutoPilotWorkflow so its Flowable process definition is regenerated from the current
   * node/delegate code. When {@code CreateIngestionPipelineDelegate}'s {@code
   * pipelineServiceClientExpr} field was removed in #28741, the BPMN deployed by the previous
   * release still declared that field and Flowable field injection threw {@code "Field definition
   * uses non-existent field ..."} at runtime. Scoped to AutoPilotWorkflow because it is the only
   * definition whose delegate contract drifted across the 2.0.0 → 2.0.1 boundary. Best-effort: a
   * failure only warns.
   */
  public static void redeployAutoPilotWorkflow() {
    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    WorkflowDefinition autoPilotWorkflow = loadAutoPilotWorkflow(repository);
    if (autoPilotWorkflow == null) {
      return;
    }
    try {
      WorkflowHandler.getInstance().deploy(new Workflow(autoPilotWorkflow));
      LOG.info("[v201] Re-deployed AutoPilotWorkflow to realign BPMN with current delegates");
    } catch (Exception e) {
      LOG.warn("[v201] Failed to re-deploy AutoPilotWorkflow: {}", e.getMessage());
    }
  }

  private static WorkflowDefinition loadAutoPilotWorkflow(WorkflowDefinitionRepository repository) {
    WorkflowDefinition result = null;
    try {
      result = repository.getByName(null, AUTOPILOT_WORKFLOW_NAME, EntityUtil.Fields.EMPTY_FIELDS);
    } catch (EntityNotFoundException e) {
      LOG.info("[v201] AutoPilotWorkflow not present; skipping re-deploy");
    } catch (Exception e) {
      LOG.warn("[v201] Failed to load AutoPilotWorkflow: {}", e.getMessage());
    }
    return result;
  }

  /**
   * Aligns the hybrid search weights in the stored search settings with the shipped defaults.
   *
   * <p>The weights are seeded into the settings row from the schema defaults on first startup, so
   * every installation carries an explicit pair that takes precedence over a later default. Only a
   * pair equal to the previous default is rewritten; any other pair is an operator choice.
   */
  public static void alignHybridSearchWeightsWithDefaults() {
    try {
      Settings storedSettings = SearchSettingsMergeUtil.getSearchSettingsFromDatabase();
      if (storedSettings == null) {
        LOG.warn("[v201] Search settings not found in database; skipping hybrid weight alignment");
      } else {
        alignStoredHybridWeights(storedSettings);
      }
    } catch (Exception e) {
      LOG.error("[v201] Error aligning hybrid search weights in stored search settings", e);
    }
  }

  private static void alignStoredHybridWeights(Settings storedSettings) {
    SearchSettings searchSettings = SearchSettingsMergeUtil.loadSearchSettings(storedSettings);
    if (swapPreviousHybridWeights(searchSettings)) {
      SearchSettingsMergeUtil.saveSearchSettings(storedSettings, searchSettings);
      LOG.info(
          "[v201] Hybrid search weights aligned to keyword={}, semantic={}",
          KEYWORD_WEIGHT,
          SEMANTIC_WEIGHT);
    } else {
      LOG.info("[v201] Stored hybrid search weights are not the previous defaults; left unchanged");
    }
  }

  /** Returns true when the previous default pair was found and swapped. */
  public static boolean swapPreviousHybridWeights(SearchSettings searchSettings) {
    GlobalSettings globalSettings = searchSettings.getGlobalSettings();
    boolean carriesPreviousDefaults =
        globalSettings != null
            && weightIs(globalSettings.getKeywordWeight(), PREVIOUS_KEYWORD_WEIGHT)
            && weightIs(globalSettings.getSemanticWeight(), PREVIOUS_SEMANTIC_WEIGHT);
    if (carriesPreviousDefaults) {
      globalSettings.setKeywordWeight(KEYWORD_WEIGHT);
      globalSettings.setSemanticWeight(SEMANTIC_WEIGHT);
    }
    return carriesPreviousDefaults;
  }

  private static boolean weightIs(Double weight, double expected) {
    return weight != null && Math.abs(weight - expected) < WEIGHT_TOLERANCE;
  }
}
