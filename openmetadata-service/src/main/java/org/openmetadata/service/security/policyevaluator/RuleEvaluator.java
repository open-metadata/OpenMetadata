package org.openmetadata.service.security.policyevaluator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.Function;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.EntityReference;
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

  // When true, RuleEvaluator is only used for validating the expression and not for access control
  private final boolean expressionValidation;

  public RuleEvaluator() {
    this.policyContext = null;
    this.subjectContext = null;
    this.resourceContext = null;
    this.expressionValidation = true;
  }

  public RuleEvaluator(
      PolicyContext policyContext,
      SubjectContext subjectContext,
      ResourceContextInterface resourceContext) {
    this.policyContext = policyContext;
    this.subjectContext = subjectContext;
    this.resourceContext = resourceContext;
    this.expressionValidation = false;
  }

  @Function(
      name = "noOwner",
      input = "none",
      description = "Returns true if the entity being accessed has no owner",
      examples = {"noOwner()", "!noOwner", "noOwner() || isOwner()"})
  @SuppressWarnings("unused") // Used in SpelExpressions
  public boolean noOwner() {
    if (expressionValidation) {
      return false;
    }
    return resourceContext != null && nullOrEmpty(resourceContext.getOwners());
  }

  @Function(
      name = "isOwner",
      input = "none",
      description = "Returns true if the logged in user is the owner of the entity being accessed",
      examples = {"isOwner()", "!isOwner", "noOwner() || isOwner()"})
  public boolean isOwner() {
    if (expressionValidation) {
      return false;
    }
    if (subjectContext == null || resourceContext == null) {
      return false;
    }
    return subjectContext.isOwner(resourceContext.getOwners());
  }

  @Function(
      name = "hasDomain",
      input = "none",
      description =
          "Returns true if the logged in user has domain access to the entity being accessed. "
              + "For entities with domains (explicit or inherited), the user must have at least one matching domain. "
              + "For entities without domains, users without domains can access them.",
      examples = {"hasDomain()", "!hasDomain()"})
  public boolean hasDomain() {
    if (expressionValidation) {
      return false;
    }
    if (subjectContext == null || resourceContext == null || subjectContext.user() == null) {
      return false;
    }

    // Special handling for list operations where no specific resource is being accessed
    // In list operations, resourceContext.getEntity() might be null or a placeholder
    if (resourceContext.getEntity() == null || resourceContext.getEntity().getId() == null) {
      // For list operations, we allow access and rely on post-filtering
      // This is because we can't check domain match without a specific resource
      LOG.info(
          "hasDomain() - List operation detected (no specific resource), returning true for post-filtering");
      return true;
    }

    // Get user's domains and resource's domains (including inherited domains)
    List<EntityReference> userDomains = subjectContext.user().getDomains();
    List<EntityReference> resourceDomains = resourceContext.getDomains();

    // Log for debugging (including whether domains are inherited)
    String userName = subjectContext.user().getName();
    String userDomainNames =
        nullOrEmpty(userDomains)
            ? "none"
            : userDomains.stream()
                .map(EntityReference::getFullyQualifiedName)
                .collect(Collectors.joining(","));
    String resourceDomainInfo = "none";
    if (!nullOrEmpty(resourceDomains)) {
      resourceDomainInfo =
          resourceDomains.stream()
              .map(
                  d ->
                      d.getFullyQualifiedName()
                          + (Boolean.TRUE.equals(d.getInherited()) ? "(inherited)" : ""))
              .collect(Collectors.joining(","));
    }

    LOG.info(
        "hasDomain() check - User: {}, UserDomains: {}, ResourceDomains: {}, Entity: {}",
        userName,
        userDomainNames,
        resourceDomainInfo,
        resourceContext.getEntity() != null
            ? resourceContext.getEntity().getFullyQualifiedName()
            : "unknown");

    // Both null or empty - allow access (no domain restrictions)
    if (nullOrEmpty(userDomains) && nullOrEmpty(resourceDomains)) {
      LOG.info("hasDomain() - Both have no domains, returning true");
      return true;
    }

    // User has domains but resource doesn't - deny access
    // (domain-restricted users can't access non-domain resources)
    if (!nullOrEmpty(userDomains) && nullOrEmpty(resourceDomains)) {
      LOG.info("hasDomain() - User has domains but resource doesn't, returning false");
      return false;
    }

    // Resource has domains but user doesn't - deny access
    if (nullOrEmpty(userDomains) && !nullOrEmpty(resourceDomains)) {
      LOG.info("hasDomain() - Resource has domains but user doesn't, returning false");
      return false;
    }

    // Both have domains - check for match
    // We need to check if any user domain matches any resource domain
    for (EntityReference userDomain : userDomains) {
      for (EntityReference resourceDomain : resourceDomains) {
        if (userDomain.getId() != null && userDomain.getId().equals(resourceDomain.getId())) {
          LOG.info(
              "hasDomain() - Domain match found by ID: {}, returning true", userDomain.getId());
          return true;
        }
        // Also check by name if IDs are not available
        if (userDomain.getFullyQualifiedName() != null
            && userDomain.getFullyQualifiedName().equals(resourceDomain.getFullyQualifiedName())) {
          LOG.info(
              "hasDomain() - Domain match found by FQN: {}, returning true",
              userDomain.getFullyQualifiedName());
          return true;
        }
      }
    }

    LOG.info("hasDomain() - No matching domains found, returning false");
    return false; // No matching domains found
  }

  @Function(
      name = "matchAllTags",
      input = "List of comma separated tag or glossary fully qualified names",
      description = "Returns true if the entity being accessed has all the tags given as input",
      examples = {
        "matchAllTags('PersonalData.Personal', 'Tier.Tier1', 'Business Glossary.Clothing')"
      })
  @SuppressWarnings("ununsed")
  public boolean matchAllTags(String... tagFQNs) {
    if (expressionValidation) {
      for (String tagFqn : tagFQNs) {
        Entity.getEntityReferenceByName(Entity.TAG, tagFqn, NON_DELETED); // Validate tag exists
      }
      return false;
    }
    if (resourceContext == null) {
      return false;
    }
    List<TagLabel> tags = resourceContext.getTags();
    if (nullOrEmpty(tags)) {
      LOG.debug("No Tags found for resource");
      return false;
    }
    LOG.debug(
        "matchAllTags {} resourceTags {}",
        Arrays.toString(tagFQNs),
        Arrays.toString(tags.toArray()));
    for (String tagFQN : tagFQNs) {
      TagLabel found =
          tags.stream().filter(t -> t.getTagFQN().equals(tagFQN)).findAny().orElse(null);
      if (found == null) {
        return false;
      }
    }
    return true;
  }

  @Function(
      name = "matchAnyTag",
      input = "List of comma separated tag or glossary fully qualified names",
      description =
          "Returns true if the entity being accessed has at least one of the tags given as input",
      examples = {
        "matchAnyTag('PersonalData.Personal', 'Tier.Tier1', 'Business Glossary.Clothing')"
      })
  @SuppressWarnings("unused") // Used in SpelExpressions
  public boolean matchAnyTag(String... tagFQNs) {
    if (expressionValidation) {
      for (String tagFqn : tagFQNs) {
        Entity.getEntityReferenceByName(Entity.TAG, tagFqn, NON_DELETED); // Validate tag exists
      }
      return false;
    }
    if (resourceContext == null) {
      return false;
    }
    List<TagLabel> tags = resourceContext.getTags();
    if (!nullOrEmpty(tags)) {
      LOG.debug(
          "matchAnyTag {} resourceTags {}",
          Arrays.toString(tagFQNs),
          Arrays.toString(tags.toArray()));
      for (String tagFQN : tagFQNs) {
        TagLabel found =
            tags.stream().filter(t -> t.getTagFQN().equals(tagFQN)).findAny().orElse(null);
        if (found != null) {
          return true;
        }
      }
    }
    return false;
  }

  @Function(
      name = "matchAnyCertification",
      input = "List of comma separated Certification fully qualified names",
      description =
          "Returns true if the entity being accessed has any of the Certification given as input",
      examples = {"matchAnyCertification('Certification.Silver', 'Certification.Gold')"})
  @SuppressWarnings("unused") // Used in SpelExpressions
  public boolean matchAnyCertification(String... tagFQNs) {
    if (expressionValidation) {
      for (String tagFqn : tagFQNs) {
        Entity.getEntityReferenceByName(Entity.TAG, tagFqn, NON_DELETED); // Validate tag exists
      }
      return false;
    }
    if (resourceContext == null) {
      return false;
    }

    Optional<AssetCertification> oCertification =
        Optional.ofNullable(resourceContext.getEntity().getCertification());

    if (oCertification.isEmpty()) {
      LOG.debug(
          "matchAnyCertification {} resourceCertification is null.", Arrays.toString(tagFQNs));
      return false;
    } else {
      AssetCertification certification = oCertification.get();

      LOG.debug(
          "matchAnyCertification {} resourceCertification {}",
          Arrays.toString(tagFQNs),
          certification.getTagLabel().getTagFQN());
      return Arrays.stream(tagFQNs)
          .anyMatch(tagFQN -> tagFQN.equals(certification.getTagLabel().getTagFQN()));
    }
  }

  @Function(
      name = "matchTeam",
      input = "None",
      description =
          "Returns true if the user and the resource belongs to the team hierarchy where this policy is"
              + "attached. This allows restricting permissions to a resource to the members of the team hierarchy.",
      examples = {"matchTeam()"})
  @SuppressWarnings("unused") // Used in SpelExpressions
  public boolean matchTeam() {
    if (expressionValidation) {
      return false;
    }
    if (resourceContext == null || nullOrEmpty(resourceContext.getOwners())) {
      return false; // No ownership information
    }
    if (policyContext == null || !policyContext.getEntityType().equals(Entity.TEAM)) {
      return false; // Policy must be attached to a team for this function to work
    }
    return subjectContext.isTeamAsset(policyContext.getEntityName(), resourceContext.getOwners())
        && subjectContext.isUserUnderTeam(policyContext.getEntityName());
  }

  @Function(
      name = "inAnyTeam",
      input = "List of comma separated team names",
      description =
          "Returns true if the user belongs under the hierarchy of any of the teams in the given team list.",
      examples = {"inAnyTeam('marketing')"})
  @SuppressWarnings("unused") // Used in SpelExpressions
  public boolean inAnyTeam(String... teams) {
    if (expressionValidation) {
      for (String team : teams) {
        Entity.getEntityByName(Entity.TEAM, team, "", NON_DELETED);
      }
      return false;
    }
    if (subjectContext == null) {
      return false;
    }
    for (String team : teams) {
      if (subjectContext.isUserUnderTeam(team)) {
        LOG.debug(
            "inAnyTeam - User {} is under the team {}", subjectContext.user().getName(), team);
        return true;
      }
      LOG.debug(
          "inAnyTeam - User {} is not under the team {}", subjectContext.user().getName(), team);
    }
    return false;
  }

  @Function(
      name = "hasAnyRole",
      input = "List of comma separated roles",
      description =
          "Returns true if the user (either direct or inherited from the parent teams) has one or more roles "
              + "from the list.",
      examples = {"hasAnyRole('DataSteward', 'DataEngineer')"})
  @SuppressWarnings("unused") // Used in SpelExpressions
  public boolean hasAnyRole(String... roles) {
    if (expressionValidation) {
      for (String role : roles) {
        Entity.getEntityReferenceByName(Entity.ROLE, role, NON_DELETED); // Validate role exists
      }
      return false;
    }
    if (subjectContext == null) {
      return false;
    }
    for (String role : roles) {
      if (subjectContext.hasAnyRole(role)) {
        LOG.debug("hasAnyRole - User {} has the role {}", subjectContext.user().getName(), role);
        return true;
      }
    }
    return false;
  }
}
