package org.openmetadata.service.migration.utils.v210;

import static org.openmetadata.service.Entity.ADMIN_USER_NAME;

import java.io.IOException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.EdgeDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;

/**
 * Puts the automation-proposal branch of the seeded GlossaryTermApprovalWorkflow in front of the
 * stored definition, which seeding never updates once the workflow exists. The branch is read from
 * the seed, so the stored and seeded workflows cannot drift: every node the branch's entry check
 * reaches is added, the start node now leads to that check, and the check hands every term that is
 * not an automation's proposal back to the step the start node led to, customized or not.
 */
@Slf4j
public final class GlossaryAutomationProposalMigration {
  public static final String STEP_NAME = "glossaryAutomationProposalBranch";
  static final String WORKFLOW_NAME = "GlossaryTermApprovalWorkflow";
  static final String ENTRY_NODE = "CheckIfGlossaryTermIsAutomationProposal";
  private static final String SEED_PATH =
      ".*json/data/governance/workflows/GlossaryApprovalWorkflow\\.json$";
  private static final String START_EVENT = "startEvent";
  private static final String HAND_BACK_CONDITION = "false";

  private GlossaryAutomationProposalMigration() {}

  /** Needs the WorkflowHandler initialized: storing the definition also deploys it to Flowable. */
  public static void addAutomationProposalBranch() {
    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    WorkflowDefinition stored = repository.findByNameOrNull(WORKFLOW_NAME, Include.NON_DELETED);
    if (stored != null) {
      storeAndDeploy(repository, stored, seed());
    }
  }

  /**
   * Stores the branch, which deploys it. A definition that has the branch already is deployed
   * again: a run interrupted after storing it, before deploying it, left Flowable on the old
   * process, and its step was not recorded, so this run completes it.
   */
  static void storeAndDeploy(
      WorkflowDefinitionRepository repository, WorkflowDefinition stored, WorkflowDefinition seed) {
    if (addBranch(stored, seed)) {
      repository.createOrUpdate(null, stored, ADMIN_USER_NAME);
      LOG.info("[v210] Added the automation-proposal branch to {}", WORKFLOW_NAME);
    } else {
      WorkflowHandler.getInstance().deploy(new Workflow(stored));
    }
  }

  /** Adds the seed's branch to {@code stored}; false when it has it already or has no start. */
  static boolean addBranch(WorkflowDefinition stored, WorkflowDefinition seed) {
    Optional<EdgeDefinition> startEdge =
        hasNode(stored, ENTRY_NODE) ? Optional.empty() : startEdgeOf(stored);
    startEdge.ifPresent(edge -> insertBranch(stored, seed, edge));
    return startEdge.isPresent();
  }

  /** Every node the branch's entry check reaches without handing the term back. */
  static Set<String> branchNodes(WorkflowDefinition seed) {
    Set<String> branch = new LinkedHashSet<>();
    Deque<String> toVisit = new ArrayDeque<>(List.of(ENTRY_NODE));
    while (!toVisit.isEmpty()) {
      String node = toVisit.pop();
      if (branch.add(node)) {
        seed.getEdges().stream()
            .filter(edge -> node.equals(edge.getFrom()) && !isHandBack(edge))
            .forEach(edge -> toVisit.push(edge.getTo()));
      }
    }
    return branch;
  }

  private static void insertBranch(
      WorkflowDefinition stored, WorkflowDefinition seed, EdgeDefinition startEdge) {
    Set<String> branch = branchNodes(seed);
    List<WorkflowNodeDefinitionInterface> nodes = new ArrayList<>(stored.getNodes());
    seed.getNodes().stream().filter(node -> branch.contains(node.getName())).forEach(nodes::add);
    List<EdgeDefinition> edges = new ArrayList<>(stored.getEdges());
    edges.remove(startEdge);
    edges.add(new EdgeDefinition().withFrom(startEdge.getFrom()).withTo(ENTRY_NODE));
    edges.add(
        new EdgeDefinition()
            .withFrom(ENTRY_NODE)
            .withTo(startEdge.getTo())
            .withCondition(HAND_BACK_CONDITION));
    seed.getEdges().stream()
        .filter(edge -> branch.contains(edge.getFrom()) && !isHandBack(edge))
        .forEach(edges::add);
    stored.setNodes(nodes);
    stored.setEdges(edges);
  }

  private static boolean isHandBack(EdgeDefinition edge) {
    return ENTRY_NODE.equals(edge.getFrom()) && HAND_BACK_CONDITION.equals(edge.getCondition());
  }

  private static boolean hasNode(WorkflowDefinition workflow, String name) {
    return workflow.getNodes().stream().anyMatch(node -> name.equals(node.getName()));
  }

  private static Optional<EdgeDefinition> startEdgeOf(WorkflowDefinition workflow) {
    return workflow.getNodes().stream()
        .filter(node -> START_EVENT.equals(node.getSubType()))
        .map(WorkflowNodeDefinitionInterface::getName)
        .findFirst()
        .flatMap(
            start ->
                workflow.getEdges().stream()
                    .filter(edge -> start.equals(edge.getFrom()))
                    .findFirst());
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
