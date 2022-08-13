package org.openmetadata.catalog.security.policyevaluator;

import java.io.IOException;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.type.TagLabel;

@Slf4j
/**
 * Note that the methods in the class become available for SpEL expressions for authoring expressions such as
 * "noOwner()" or "!noOwner()"
 */
public class RuleEvaluator {
  private final OperationContext operationContext;
  private final SubjectContext subjectContext;
  private final ResourceContextInterface resourceContext;

  public RuleEvaluator(
      OperationContext operationContext, SubjectContext subjectContext, ResourceContextInterface resourceContext) {
    this.operationContext = operationContext;
    this.subjectContext = subjectContext;
    this.resourceContext = resourceContext;
  }

  /** Returns true if the resource being accessed has no owner */
  public boolean noOwner() throws IOException {
    return resourceContext != null && resourceContext.getOwner() == null;
  }

  /** Returns true if the resource is owned by the subject/user */
  public boolean isOwner() throws IOException {
    return subjectContext != null && subjectContext.isOwner(resourceContext.getOwner());
  }

  /** Returns true if the tags of a resource being accessed matches all the tags provided as parameters */
  public boolean matchAllTags(String... tagFQNs) throws IOException {
    if (resourceContext == null) {
      return false;
    }
    List<TagLabel> tags = resourceContext.getTags();
    for (String tagFQN : tagFQNs) {
      TagLabel found = tags.stream().filter(t -> t.getTagFQN().equals(tagFQN)).findAny().orElse(null);
      if (found == null) {
        return false;
      }
    }
    return true;
  }

  /** Returns true if the tags of a resource being accessed matches at least one tag provided as parameters */
  public boolean matchAnyTag(List<String> tagFQNs) throws IOException {
    if (resourceContext == null) {
      return false;
    }
    List<TagLabel> tags = resourceContext.getTags();
    for (String tagFQN : tagFQNs) {
      TagLabel found = tags.stream().filter(t -> t.getTagFQN().equals(tagFQN)).findAny().orElse(null);
      if (found != null) {
        return true;
      }
    }
    return false;
  }
}
