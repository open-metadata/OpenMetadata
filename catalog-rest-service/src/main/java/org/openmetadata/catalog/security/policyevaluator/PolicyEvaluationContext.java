package org.openmetadata.catalog.security.policyevaluator;

import java.io.IOException;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.type.TagLabel;

@Slf4j
public class PolicyEvaluationContext {
  private final OperationContext operationContext;
  private final SubjectContext subjectContext;
  private final ResourceContext resourceContext;

  public PolicyEvaluationContext(
      OperationContext operationContext, SubjectContext subjectContext, ResourceContext resourceContext) {
    this.operationContext = operationContext;
    this.subjectContext = subjectContext;
    this.resourceContext = resourceContext;
  }

  public boolean noOwner() throws IOException {
    return resourceContext.getOwner() == null;
  }

  public boolean isOwner() throws IOException {
    return subjectContext.isOwner(resourceContext.getOwner());
  }

  public boolean matchAllTags(String... tagFQNs) throws IOException {
    List<TagLabel> tags = resourceContext.getTags();
    for (String tagFQN : tagFQNs) {
      TagLabel found = tags.stream().filter(t -> t.getTagFQN().equals(tagFQN)).findAny().orElse(null);
      if (found == null) {
        return false;
      }
    }
    return true;
  }

  public boolean matchAnyTag(List<String> tagFQNs) throws IOException {
    List<TagLabel> tags = resourceContext.getTags();
    for (String tagFQN : tagFQNs) {
      TagLabel found = tags.stream().filter(t -> t.getTagFQN().equals(tagFQN)).findAny().get();
      if (found != null) {
        return true;
      }
    }
    return false;
  }
}
