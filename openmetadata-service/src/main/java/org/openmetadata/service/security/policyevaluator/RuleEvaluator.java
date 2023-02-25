package org.openmetadata.service.security.policyevaluator;

import java.io.IOException;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.Function;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.policyevaluator.SubjectContext.PolicyContext;

/**
 * Note that the methods in the class become available for SpEL expressions for authoring expressions such as
 * "noOwner()" or "!noOwner()"
 */
@Slf4j
public class RuleEvaluator {
  private final PolicyContext policyContext;
  private final SubjectContext subjectContext;
  private final ResourceContextInterface resourceContext;

  public RuleEvaluator(
      PolicyContext policyContext, SubjectContext subjectContext, ResourceContextInterface resourceContext) {
    this.policyContext = policyContext;
    this.subjectContext = subjectContext;
    this.resourceContext = resourceContext;
  }

  @Function(
      name = "noOwner",
      input = "none",
      description = "Returns true if the entity being accessed has no owner",
      examples = {"noOwner()", "!noOwner", "noOwner() || isOwner()"})
  public boolean noOwner() throws IOException {
    return resourceContext != null && resourceContext.getOwner() == null;
  }

  @Function(
      name = "isOwner",
      input = "none",
      description = "Returns true if the logged in user is the owner of the entity being accessed",
      examples = {"isOwner()", "!isOwner", "noOwner() || isOwner()"})
  public boolean isOwner() throws IOException {
    return subjectContext != null && subjectContext.isOwner(resourceContext.getOwner());
  }

  @Function(
      name = "matchAllTags",
      input = "List of comma separated tag or glossary fully qualified names",
      description = "Returns true if the entity being accessed has all the tags given as input",
      examples = {"matchAllTags('PersonalData.Personal', 'Tier.Tier1', 'Business Glossary.Clothing')"})
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

  @Function(
      name = "matchAnyTag",
      input = "List of comma separated tag or glossary fully qualified names",
      description = "Returns true if the entity being accessed has at least one of the tags given as input",
      examples = {"matchAnyTag('PersonalData.Personal', 'Tier.Tier1', 'Business Glossary.Clothing')"})
  public boolean matchAnyTag(String... tagFQNs) throws IOException {
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

  @Function(
      name = "matchTeam",
      input = "None",
      description =
          "Returns true if the user and the resource belongs to the team hierarchy where this policy is"
              + "attached. This allows restricting permissions to a resource to the members of the team hierarchy.",
      examples = {"matchTeam()"},
      resourceBased = true)
  public boolean matchTeam() throws IOException {
    if (resourceContext == null || resourceContext.getOwner() == null) {
      return true; // No ownership information
    }
    if (policyContext == null || !policyContext.getEntityType().equals(Entity.TEAM)) {
      return true; // Policy must be attached to a team for this function to work
    }
    return subjectContext.isTeamAsset(policyContext.getEntityName(), resourceContext.getOwner())
        && subjectContext.isUserUnderTeam(policyContext.getEntityName());
  }
}
