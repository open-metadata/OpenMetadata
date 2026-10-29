package org.openmetadata.service.governance.workflows;

import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.OntologyReviewTarget;
import org.openmetadata.schema.type.TaskAvailableTransition;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;

/** A decision committed with the Flowable task completion, recoverable after an OM restart. */
public record OntologyWorkflowDecision(
    UUID taskId,
    OntologyReviewTarget target,
    TaskResolutionType resolution,
    String user,
    List<String> voters,
    TaskAvailableTransition transition,
    String comment) {
  public static final String VARIABLE = "ontologyReviewDecision";

  public OntologyWorkflowDecision {
    if (taskId == null
        || target == null
        || (resolution != TaskResolutionType.Approved && resolution != TaskResolutionType.Rejected)
        || user == null
        || voters == null
        || !voters.contains(user)) {
      throw new BadRequestException("An ontology decision requires an explicit reviewer decision");
    }
    target = JsonUtils.deepCopy(target, OntologyReviewTarget.class);
    voters = List.copyOf(voters);
  }

  public void requireTarget(final Task task) {
    if (!Objects.equals(taskId, task.getId())
        || !Objects.equals(target, task.getOntologyReview())) {
      throw new BadRequestException("The workflow decision belongs to another ontology review");
    }
  }
}
