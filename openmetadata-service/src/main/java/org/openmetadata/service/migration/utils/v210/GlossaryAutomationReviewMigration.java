package org.openmetadata.service.migration.utils.v210;

import static org.openmetadata.service.Entity.ADMIN_USER_NAME;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;
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
 * 2.1.0 review of automation proposals: a branch right after the start sends a term an automation
 * proposed, until a person approves it, to approval steps of its own, which fall back to the admins
 * when nobody else may decide it. The branch is spliced onto the start's edge, so it does not depend
 * on the shape an admin gave the rest of the workflow, which keeps its steps, edges and rules, and
 * every other term is reviewed exactly as before. A start with several edges is left for an admin
 * to wire.
 */
@Slf4j
public final class GlossaryAutomationReviewMigration {
  public static final String STEP_NAME = "glossaryAutomationReview";
  static final String WORKFLOW_NAME = "GlossaryTermApprovalWorkflow";
  static final String PROPOSAL_CHECK = "CheckIfGlossaryTermIsAutomationProposal";
  private static final String NODES = "nodes";
  private static final String EDGES = "edges";
  private static final String NAME = "name";
  private static final String FROM = "from";
  private static final String TO = "to";
  private static final String CONDITION = "condition";
  private static final String NOT_A_PROPOSAL = "false";
  private static final String SUB_TYPE = "subType";
  private static final String START_EVENT = "startEvent";
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

  /** {@code stored} with the seed's proposal branch; empty when it has it or cannot take it. */
  static Optional<WorkflowDefinition> withAutomationReview(
      WorkflowDefinition stored, WorkflowDefinition seed) {
    ObjectNode workflow = (ObjectNode) JsonUtils.valueToTree(stored);
    return addProposalBranch(workflow, JsonUtils.valueToTree(seed))
        ? Optional.of(JsonUtils.treeToValue(workflow, WorkflowDefinition.class))
        : Optional.empty();
  }

  private static boolean addProposalBranch(ObjectNode workflow, JsonNode seed) {
    Set<String> branch = proposalBranch(seed);
    Optional<ObjectNode> startEdge =
        hasAnyNode(workflow, branch) ? Optional.empty() : soleStartEdge(workflow);
    startEdge.ifPresent(edge -> spliceProposalBranch(workflow, seed, branch, edge));
    return startEdge.isPresent();
  }

  /** The seed's nodes from the proposal check on, short of where a person's term continues. */
  static Set<String> proposalBranch(JsonNode seed) {
    Set<String> branch = new HashSet<>();
    Deque<String> pending = new ArrayDeque<>(List.of(PROPOSAL_CHECK));
    while (!pending.isEmpty()) {
      String name = pending.pop();
      if (branch.add(name)) {
        edgesFrom(seed, name)
            .filter(edge -> !isNotAProposalEdge(edge))
            .forEach(edge -> pending.push(edge.path(TO).asText()));
      }
    }
    return branch;
  }

  private static Optional<ObjectNode> soleStartEdge(ObjectNode workflow) {
    String start =
        nodes(workflow)
            .filter(node -> START_EVENT.equals(node.path(SUB_TYPE).asText()))
            .map(node -> node.path(NAME).asText())
            .findFirst()
            .orElse("");
    List<ObjectNode> startEdges = edgesFrom(workflow, start).toList();
    if (startEdges.size() != 1) {
      LOG.warn(
          "[v210] {} starts with {} edges; wire its automation proposal branch by hand",
          WORKFLOW_NAME,
          startEdges.size());
    }
    return startEdges.size() == 1 ? Optional.of(startEdges.getFirst()) : Optional.empty();
  }

  private static void spliceProposalBranch(
      ObjectNode workflow, JsonNode seed, Set<String> branch, ObjectNode startEdge) {
    String firstStep = startEdge.path(TO).asText();
    nodes(seed)
        .filter(node -> branch.contains(node.path(NAME).asText()))
        .forEach(node -> ((ArrayNode) workflow.path(NODES)).add(node.deepCopy()));
    branch.forEach(
        name ->
            edgesFrom(seed, name)
                .map(ObjectNode::deepCopy)
                .map(edge -> isNotAProposalEdge(edge) ? edge.put(TO, firstStep) : edge)
                .forEach(edge -> ((ArrayNode) workflow.path(EDGES)).add(edge)));
    startEdge.put(TO, PROPOSAL_CHECK);
  }

  private static boolean isNotAProposalEdge(JsonNode edge) {
    return PROPOSAL_CHECK.equals(edge.path(FROM).asText())
        && NOT_A_PROPOSAL.equals(edge.path(CONDITION).asText());
  }

  private static boolean hasAnyNode(JsonNode workflow, Set<String> names) {
    return nodes(workflow).anyMatch(node -> names.contains(node.path(NAME).asText()));
  }

  private static Stream<ObjectNode> nodes(JsonNode workflow) {
    return StreamSupport.stream(workflow.path(NODES).spliterator(), false)
        .map(ObjectNode.class::cast);
  }

  private static Stream<ObjectNode> edgesFrom(JsonNode workflow, String name) {
    return StreamSupport.stream(workflow.path(EDGES).spliterator(), false)
        .map(ObjectNode.class::cast)
        .filter(edge -> name.equals(edge.path(FROM).asText()));
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
