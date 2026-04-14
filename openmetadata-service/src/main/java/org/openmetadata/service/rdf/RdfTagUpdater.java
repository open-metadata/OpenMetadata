package org.openmetadata.service.rdf;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Handles RDF updates for tag and glossary term relationships.
 * These are stored differently than entity relationships in OpenMetadata.
 */
@Slf4j
public class RdfTagUpdater {

  private RdfTagUpdater() {
    // Private constructor for utility class
  }

  /**
   * Escape a string value for use in SPARQL queries
   */
  private static String escapeSparqlString(String value) {
    if (value == null) {
      return "\"\"";
    }
    // Escape backslashes first, then quotes
    String escaped = value.replace("\\", "\\\\").replace("\"", "\\\"");
    return "\"" + escaped + "\"";
  }

  /**
   * Update RDF when a tag is applied to an entity or column
   */
  public static void applyTag(TagLabel tagLabel, String targetFQN) {
    applyTag(tagLabel, targetFQN, null, null);
  }

  public static void applyTag(
      TagLabel tagLabel, String targetFQN, String targetType, UUID targetId) {
    if (!RdfUpdater.isEnabled()) {
      return;
    }

    try {
      RdfRepository repository = RdfRepository.getInstance();
      String baseUri = repository.getBaseUri();

      // Convert FQNs to URIs
      String targetUri = toTargetUri(baseUri, targetFQN, targetType, targetId);
      TagInfo tagInfo = resolveTagInfo(baseUri, tagLabel);

      // Check if this is a glossary term or classification tag
      boolean isGlossaryTerm = tagInfo.isGlossaryTerm;
      String predicate = isGlossaryTerm ? "om:hasGlossaryTerm" : "om:hasTag";
      String type = isGlossaryTerm ? "skos:Concept" : "om:Tag";
      String labelPredicate = isGlossaryTerm ? "skos:prefLabel" : "rdfs:label";

      // Build SPARQL update with properly escaped string literals
      String sparqlUpdate =
          String.format(
              "PREFIX om: <%sontology/> "
                  + "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> "
                  + "PREFIX skos: <http://www.w3.org/2004/02/skos/core#> "
                  + "INSERT DATA { "
                  + "  <%s> %s <%s> . "
                  + "  <%s> a %s ; "
                  + "       om:labelType %s ; "
                  + "       om:tagState %s ; "
                  + "       %s %s . "
                  + "}",
              baseUri,
              targetUri,
              predicate,
              tagInfo.tagUri,
              tagInfo.tagUri,
              type,
              escapeSparqlString(tagLabel.getLabelType().value()),
              escapeSparqlString(tagLabel.getState().value()),
              labelPredicate,
              escapeSparqlString(tagLabel.getTagFQN()));

      repository.executeSparqlUpdate(sparqlUpdate);
      LOG.debug(
          "Applied {} {} to {} in RDF",
          isGlossaryTerm ? "glossary term" : "tag",
          tagLabel.getTagFQN(),
          targetFQN);

    } catch (Exception e) {
      LOG.error("Failed to apply tag {} to {} in RDF", tagLabel.getTagFQN(), targetFQN, e);
    }
  }

  /**
   * Remove tag from RDF
   */
  public static void removeTag(TagLabel tagLabel, String targetFQN) {
    removeTag(tagLabel, targetFQN, null, null);
  }

  public static void removeTag(
      TagLabel tagLabel, String targetFQN, String targetType, UUID targetId) {
    if (!RdfUpdater.isEnabled()) {
      return;
    }

    try {
      RdfRepository repository = RdfRepository.getInstance();
      String baseUri = repository.getBaseUri();

      String targetUri = toTargetUri(baseUri, targetFQN, targetType, targetId);
      TagInfo tagInfo = resolveTagInfo(baseUri, tagLabel);
      String predicate = tagInfo.isGlossaryTerm ? "om:hasGlossaryTerm" : "om:hasTag";

      String sparqlUpdate =
          String.format(
              "PREFIX om: <%sontology/> " + "DELETE WHERE { <%s> %s <%s> }",
              baseUri, targetUri, predicate, tagInfo.tagUri);

      repository.executeSparqlUpdate(sparqlUpdate);
      LOG.debug("Removed tag {} from {} in RDF", tagLabel.getTagFQN(), targetFQN);

    } catch (Exception e) {
      LOG.error("Failed to remove tag {} from {} in RDF", tagLabel.getTagFQN(), targetFQN, e);
    }
  }

  /**
   * Convert FQN to URI
   */
  private static String fqnToUri(String baseUri, String fqn) {
    // For tags and columns, we need to create a stable URI
    // Since we don't have entity IDs here, we'll use a hash of the FQN
    String hash = Integer.toHexString(fqn.hashCode());

    // Extract entity type and ID from FQN
    String[] parts = FullyQualifiedName.split(fqn);
    if (parts.length == 0) {
      return "https://open-metadata.org/entity/unknown/"
          + URLEncoder.encode(hash, StandardCharsets.UTF_8);
    }

    // Determine entity type from FQN structure
    String entityType = inferEntityType(parts);

    // Use hash as a stable identifier for the entity
    return String.format(
        "%sentity/%s/%s", baseUri, entityType, URLEncoder.encode(hash, StandardCharsets.UTF_8));
  }

  private static String toTargetUri(
      String baseUri, String targetFQN, String targetType, UUID targetId) {
    if (targetType != null && targetId != null) {
      return String.format("%sentity/%s/%s", baseUri, targetType, targetId);
    }
    return fqnToUri(baseUri, targetFQN);
  }

  private static TagInfo resolveTagInfo(String baseUri, TagLabel tagLabel) {
    boolean isGlossaryTerm = tagLabel.getSource() == TagLabel.TagSource.GLOSSARY;
    if (!isGlossaryTerm) {
      return new TagInfo(
          false, String.format("%stag/%s", baseUri, tagLabel.getTagFQN().replace(".", "/")));
    }

    UUID termId = resolveGlossaryTermId(tagLabel);
    if (termId != null) {
      return new TagInfo(true, String.format("%sentity/glossaryTerm/%s", baseUri, termId));
    }

    return new TagInfo(
        true, String.format("%stag/%s", baseUri, tagLabel.getTagFQN().replace(".", "/")));
  }

  private static UUID resolveGlossaryTermId(TagLabel tagLabel) {
    if (tagLabel == null || tagLabel.getTagFQN() == null) {
      return null;
    }
    try {
      if (tagLabel.getHref() != null) {
        java.net.URI uri = tagLabel.getHref();
        String path = uri.getPath();
        if (path != null) {
          String[] parts = path.split("/");
          String last = parts[parts.length - 1];
          if (!last.isBlank()) {
            return UUID.fromString(last);
          }
        }
      }
    } catch (Exception ignored) {
      // Fall back to lookup by FQN.
    }

    try {
      GlossaryTerm term =
          Entity.getEntityByName(
              Entity.GLOSSARY_TERM, tagLabel.getTagFQN(), "id", Include.NON_DELETED, false);
      return term != null ? term.getId() : null;
    } catch (Exception ignored) {
      return null;
    }
  }

  private static class TagInfo {
    private final boolean isGlossaryTerm;
    private final String tagUri;

    private TagInfo(boolean isGlossaryTerm, String tagUri) {
      this.isGlossaryTerm = isGlossaryTerm;
      this.tagUri = tagUri;
    }
  }

  private static String inferEntityType(String[] fqnParts) {
    // Simple heuristic based on FQN structure
    if (fqnParts[0].startsWith("tag:") || fqnParts[0].contains(".Tag.")) {
      return "tag";
    } else if (fqnParts[0].contains(".Glossary.")) {
      return "glossaryTerm";
    } else if (fqnParts.length >= 4) {
      // service.database.schema.table pattern = 4 parts
      // service.database.schema.table.column pattern = 5 parts
      return fqnParts.length == 5 ? "column" : "table";
    }
    return "entity";
  }
}
