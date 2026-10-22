package org.openmetadata.service.migration.utils.v210;

import static org.openmetadata.service.Entity.ADMIN_USER_NAME;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.stream.StreamSupport;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;

/**
 * Brings the stored GlossaryTermApprovalWorkflow, which seeding never updates once it exists, the
 * 2.1.0 settings that send a term an automation proposed to a person: its reviewers check also
 * passes such a term, and its approval steps fall back to the admins instead of approving a term
 * nobody was assigned. The workflow keeps its steps and edges. A check an admin changed keeps their
 * rule, and a step with a fallback of its own keeps it.
 */
@Slf4j
public final class GlossaryAutomationReviewMigration {
  public static final String STEP_NAME = "glossaryAutomationReview";
  static final String WORKFLOW_NAME = "GlossaryTermApprovalWorkflow";
  static final String REVIEWERS_CHECK = "CheckGlossaryTermHasReviewers";
  static final List<String> APPROVAL_STEPS = List.of("ApproveGlossaryTerm", "ApprovalForUpdates");
  // The check every release before 2.1.0 shipped, to tell it from one an admin changed.
  static final String PREVIOUS_REVIEWERS_RULE =
      "{\"and\":[{\"some\":[{\"var\":\"reviewers\"},{\"!=\":[{\"var\":\"fullyQualifiedName\"},null]}]}]}";
  private static final String NO_FALLBACK = "none";
  private static final String ADMIN_FALLBACK = "assignAdmins";
  private static final String SEED_PATH =
      ".*json/data/governance/workflows/GlossaryApprovalWorkflow\\.json$";

  private GlossaryAutomationReviewMigration() {}

  /** Needs the WorkflowHandler initialized: storing the definition also deploys it to Flowable. */
  public static void sendAutomationProposalsToPeople() {
    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    WorkflowDefinition stored = repository.findByNameOrNull(WORKFLOW_NAME, Include.NON_DELETED);
    if (stored != null) {
      storeAndDeploy(repository, stored, seed());
    }
  }

  /**
   * A definition that has the settings already is deployed again: a run interrupted after storing
   * it, before deploying it, left Flowable on the old process, and its step was not recorded.
   */
  static void storeAndDeploy(
      WorkflowDefinitionRepository repository, WorkflowDefinition stored, WorkflowDefinition seed) {
    Optional<WorkflowDefinition> updated = withAutomationReview(stored, seed);
    if (updated.isPresent()) {
      repository.createOrUpdate(null, updated.get(), ADMIN_USER_NAME);
      LOG.info("[v210] {} now sends automation proposals to a person", WORKFLOW_NAME);
    } else {
      WorkflowHandler.getInstance().deploy(new Workflow(stored));
    }
  }

  /** {@code stored} with the seed's reviewers check and admin fallbacks; empty when it has them. */
  static Optional<WorkflowDefinition> withAutomationReview(
      WorkflowDefinition stored, WorkflowDefinition seed) {
    ObjectNode workflow = (ObjectNode) JsonUtils.valueToTree(stored);
    boolean adoptedCheck = adoptReviewersCheck(workflow, JsonUtils.valueToTree(seed));
    boolean adoptedFallback =
        APPROVAL_STEPS.stream()
            .map(step -> adoptAdminFallback(workflow, step))
            .reduce(false, Boolean::logicalOr);
    return adoptedCheck || adoptedFallback
        ? Optional.of(JsonUtils.treeToValue(workflow, WorkflowDefinition.class))
        : Optional.empty();
  }

  private static boolean adoptReviewersCheck(ObjectNode workflow, JsonNode seed) {
    Optional<ObjectNode> check =
        node(workflow, REVIEWERS_CHECK)
            .filter(
                node -> PREVIOUS_REVIEWERS_RULE.equals(node.path("config").path("rules").asText()));
    check.ifPresent(node -> node.setAll(node(seed, REVIEWERS_CHECK).orElseThrow()));
    return check.isPresent();
  }

  private static boolean adoptAdminFallback(ObjectNode workflow, String step) {
    Optional<ObjectNode> assignees =
        node(workflow, step)
            .map(node -> node.path("config").path("assignees"))
            .filter(ObjectNode.class::isInstance)
            .map(ObjectNode.class::cast)
            .filter(GlossaryAutomationReviewMigration::hasNoFallback);
    assignees.ifPresent(node -> node.put("emptyAssigneeStrategy", ADMIN_FALLBACK));
    return assignees.isPresent();
  }

  private static boolean hasNoFallback(ObjectNode assignees) {
    return NO_FALLBACK.equals(assignees.path("emptyAssigneeStrategy").asText(NO_FALLBACK));
  }

  private static Optional<ObjectNode> node(JsonNode workflow, String name) {
    return StreamSupport.stream(workflow.path("nodes").spliterator(), false)
        .filter(node -> name.equals(node.path("name").asText()))
        .map(ObjectNode.class::cast)
        .findFirst();
  }

  static WorkflowDefinition seed() {
    List<WorkflowDefinition> seeds;
    try {
      seeds =
          EntityRepository.getEntitiesFromSeedData(
              Entity.WORKFLOW_DEFINITION, SEED_PATH, WorkflowDefinition.class);
    } catch (IOException e) {
      throw new IllegalStateException("Cannot read the seeded " + WORKFLOW_NAME, e);
    }
    if (seeds.isEmpty()) {
      throw new IllegalStateException("No seeded workflow matches " + SEED_PATH);
    }
    return seeds.getFirst();
  }
}
