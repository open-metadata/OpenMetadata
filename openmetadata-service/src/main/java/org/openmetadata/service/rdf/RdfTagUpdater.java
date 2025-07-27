package org.openmetadata.service.rdf;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.TagLabel;
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
    if (!RdfUpdater.isEnabled()) {
      return;
    }

    try {
      RdfRepository repository = RdfRepository.getInstance();

      // Convert FQNs to URIs
      String targetUri = fqnToUri(targetFQN);
      String tagUri = fqnToUri(tagLabel.getTagFQN());

      // Check if this is a glossary term or classification tag
      boolean isGlossaryTerm = tagLabel.getSource() == TagLabel.TagSource.GLOSSARY;
      String predicate = isGlossaryTerm ? "om:hasGlossaryTerm" : "om:hasTag";
      String type = isGlossaryTerm ? "skos:Concept" : "om:Tag";

      // Build SPARQL update with properly escaped string literals
      String sparqlUpdate =
          String.format(
              "PREFIX om: <https://open-metadata.org/ontology/> "
                  + "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> "
                  + "PREFIX skos: <http://www.w3.org/2004/02/skos/core#> "
                  + "INSERT DATA { "
                  + "  <%s> %s <%s> . "
                  + "  <%s> a %s ; "
                  + "       om:labelType %s ; "
                  + "       om:tagState %s ; "
                  + "       %s %s . "
                  + "}",
              targetUri,
              predicate,
              tagUri,
              tagUri,
              type,
              escapeSparqlString(tagLabel.getLabelType().value()),
              escapeSparqlString(tagLabel.getState().value()),
              isGlossaryTerm ? "skos:prefLabel" : "rdfs:label",
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
  public static void removeTag(String tagFQN, String targetFQN) {
    if (!RdfUpdater.isEnabled()) {
      return;
    }

    try {
      RdfRepository repository = RdfRepository.getInstance();

      String targetUri = fqnToUri(targetFQN);
      String tagUri = fqnToUri(tagFQN);

      String sparqlUpdate =
          String.format(
              "PREFIX om: <https://open-metadata.org/ontology/> "
                  + "DELETE WHERE { <%s> om:hasTag <%s> }",
              targetUri, tagUri);

      repository.executeSparqlUpdate(sparqlUpdate);
      LOG.debug("Removed tag {} from {} in RDF", tagFQN, targetFQN);

    } catch (Exception e) {
      LOG.error("Failed to remove tag {} from {} in RDF", tagFQN, targetFQN, e);
    }
  }

  /**
   * Convert FQN to URI
   */
  private static String fqnToUri(String fqn) {
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
        "https://open-metadata.org/%s/%s",
        entityType, URLEncoder.encode(hash, StandardCharsets.UTF_8));
  }

  private static String inferEntityType(String[] fqnParts) {
    // Simple heuristic based on FQN structure
    if (fqnParts[0].startsWith("tag:") || fqnParts[0].contains(".Tag.")) {
      return "tag";
    } else if (fqnParts[0].contains(".Glossary.")) {
      return "glossaryTerm";
    } else if (fqnParts.length >= 3) {
      // database.schema.table.column pattern
      return fqnParts.length == 4 ? "column" : "table";
    }
    return "entity";
  }
}
