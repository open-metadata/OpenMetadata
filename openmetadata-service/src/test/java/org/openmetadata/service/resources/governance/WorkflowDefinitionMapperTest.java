package org.openmetadata.service.resources.governance;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.governance.CreateWorkflowDefinition;
import org.openmetadata.schema.api.governance.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.LifecycleConfiguration;
import org.openmetadata.schema.governance.workflows.LifecycleFieldCheck;
import org.openmetadata.schema.governance.workflows.LifecycleGate;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.service.rules.RuleEngine;

class WorkflowDefinitionMapperTest {
  @ParameterizedTest
  @ValueSource(strings = {"dataProduct", "domain", "glossaryTerm", "metric"})
  void carriesTypedLifecycleMetadataIntoTheSavedWorkflow(String entityType) {
    final LifecycleConfiguration lifecycle =
        new LifecycleConfiguration()
            .withVersion(LifecycleConfiguration.Version._1)
            .withEntityType(LifecycleConfiguration.EntityType.fromValue(entityType))
            .withGates(
                List.of(
                    new LifecycleGate()
                        .withStage(EntityStatus.DRAFT)
                        .withChecks(
                            List.of(
                                new LifecycleFieldCheck()
                                    .withField("description")
                                    .withRequirement(LifecycleFieldCheck.Requirement.RECOMMENDED)
                                    .withGuidance("Describe the purpose")))));
    final CreateWorkflowDefinition request =
        new CreateWorkflowDefinition()
            .withName("lifecycle")
            .withConfig(
                new WorkflowConfiguration().withStoreStageStatus(true).withLifecycle(lifecycle));
    final var saved = new WorkflowDefinitionMapper().createToEntity(request, "admin");
    assertEquals(lifecycle, saved.getConfig().getLifecycle());
    assertTrue(saved.getConfig().getStoreStageStatus());
  }

  @Test
  void leavesLegacyWorkflowConfigurationCompatible() {
    final var saved =
        new WorkflowDefinitionMapper()
            .createToEntity(new CreateWorkflowDefinition().withName("legacy"), "admin");
    assertNull(saved.getConfig().getLifecycle());
  }

  @Test
  void fieldPresenceRulesAcceptZeroAndFalseInTheServerEvaluator() {
    final String rule =
        """
        {"and":[{"!==":[{"var":"extension.value"},null]},{"!==":[{"var":"extension.value"},""]}]}
        """;
    for (final Object value : List.of(0, false)) {
      assertEquals(
          true, RuleEngine.getInstance().apply(rule, Map.of("extension", Map.of("value", value))));
    }
    assertEquals(false, RuleEngine.getInstance().apply(rule, Map.of()));
    assertEquals(
        false, RuleEngine.getInstance().apply(rule, Map.of("extension", Map.of("value", ""))));
  }

  @Test
  void checksLiteralCustomPropertyNamesWithoutMistakingDotsForNestedPaths() {
    final String rule = "{\"isPropertySet\":[{\"var\":\"extension\"},\"cost.centre\"]}";
    for (final Object value : List.of(0, false, "finance")) {
      assertEquals(
          true,
          RuleEngine.getInstance().apply(rule, Map.of("extension", Map.of("cost.centre", value))));
    }
    for (final Object value : List.of("", " ", List.of(), Map.of())) {
      assertEquals(
          false,
          RuleEngine.getInstance().apply(rule, Map.of("extension", Map.of("cost.centre", value))));
    }
    assertEquals(
        false,
        RuleEngine.getInstance()
            .apply(rule, Map.of("extension", Map.of("cost", Map.of("centre", "wrong field")))));
    assertEquals(false, RuleEngine.getInstance().apply(rule, Map.of()));
  }
}
