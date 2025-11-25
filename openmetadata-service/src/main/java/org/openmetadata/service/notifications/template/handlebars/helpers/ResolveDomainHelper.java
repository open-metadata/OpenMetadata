package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperMetadata;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperUsage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Helper to resolve domain references to display names. Usage: {{resolveDomain domainRef}}
 *
 * <p>Handles both EntityReference objects and UUID strings.
 */
public class ResolveDomainHelper implements HandlebarsHelper {
  private static final Logger LOG = LoggerFactory.getLogger(ResolveDomainHelper.class);
  private static final String NO_DOMAIN = "(no domain)";

  @Override
  public String getName() {
    return "resolveDomain";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(
        getName(),
        (context, options) -> {
          if (context == null) {
            return NO_DOMAIN;
          }

          return switch (context) {
            case Map<?, ?> entityReference -> {
              String resolved = resolveFromEntityReference(entityReference);
              yield resolved != null ? resolved : context.toString();
            }
            case String domainId -> resolveFromString(domainId);
            default -> context.toString();
          };
        });
  }

  /**
   * Resolves domain name from an EntityReference map.
   * Prioritizes displayName, then name, then fullyQualifiedName.
   *
   * @param entityReference Map containing entity reference fields
   * @return Resolved domain name or null if not found
   */
  private String resolveFromEntityReference(Map<?, ?> entityReference) {
    Object displayName = entityReference.get("displayName");
    Object name = entityReference.get("name");
    Object fullyQualifiedName = entityReference.get("fullyQualifiedName");

    if (displayName != null && !displayName.toString().isEmpty()) {
      return displayName.toString();
    }

    if (name != null && !name.toString().isEmpty()) {
      return name.toString();
    }

    if (fullyQualifiedName != null) {
      return fullyQualifiedName.toString();
    }

    return null;
  }

  /**
   * Resolves domain from a string UUID.
   * Attempts to fetch the domain entity and return its fully qualified name.
   *
   * @param domainId String representation of domain UUID
   * @return Domain's fully qualified name or the original ID if resolution fails
   */
  private String resolveFromString(String domainId) {
    try {
      Domain domain =
          Entity.getEntity(Entity.DOMAIN, UUID.fromString(domainId), "id", Include.NON_DELETED);
      return domain.getFullyQualifiedName();
    } catch (Exception e) {
      LOG.debug("Could not resolve domain ID {}: {}", domainId, e.getMessage());
      return domainId;
    }
  }

  @Override
  public HandlebarsHelperMetadata getMetadata() {
    return new HandlebarsHelperMetadata()
        .withName("resolveDomain")
        .withDescription("Resolve domain UUID to domain name")
        .withCursorOffset(17)
        .withUsages(
            List.of(
                new HandlebarsHelperUsage()
                    .withSyntax("{{resolveDomain }}")
                    .withExample("{{resolveDomain entity.domain.id}}")));
  }
}
