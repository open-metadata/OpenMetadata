package org.openmetadata.service.rdf;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityRelationship;

/**
 * Utility class to handle RDF updates during entity lifecycle operations.
 * This follows the same pattern as SearchRepository integration.
 */
@Slf4j
public class RdfUpdater {

  private static RdfRepository rdfRepository;

  private RdfUpdater() {
    // Private constructor for utility class
  }

  public static void initialize(RdfConfiguration config) {
    if (config.getEnabled() != null && config.getEnabled()) {
      RdfRepository.initialize(config);
      rdfRepository = RdfRepository.getInstance();
      LOG.info("RDF updater initialized");
    } else {
      LOG.info("RDF updater disabled");
    }
  }

  /**
   * Update RDF when entity is created or updated
   */
  public static void updateEntity(EntityInterface entity) {
    if (rdfRepository != null && rdfRepository.isEnabled()) {
      try {
        rdfRepository.createOrUpdate(entity);
      } catch (Exception e) {
        LOG.error("Failed to update entity {} in RDF", entity.getId(), e);
      }
    }
  }

  /**
   * Remove entity from RDF when deleted
   */
  public static void deleteEntity(EntityReference entityReference) {
    if (rdfRepository != null && rdfRepository.isEnabled()) {
      try {
        rdfRepository.delete(entityReference);
      } catch (Exception e) {
        LOG.error("Failed to delete entity {} from RDF", entityReference.getId(), e);
      }
    }
  }

  /**
   * Add relationship to RDF
   */
  public static void addRelationship(EntityRelationship relationship) {
    if (rdfRepository != null && rdfRepository.isEnabled()) {
      try {
        rdfRepository.addRelationship(relationship);
      } catch (Exception e) {
        LOG.error("Failed to add relationship to RDF", e);
      }
    }
  }

  /**
   * Remove relationship from RDF
   */
  public static void removeRelationship(EntityRelationship relationship) {
    if (rdfRepository != null && rdfRepository.isEnabled()) {
      try {
        rdfRepository.removeRelationship(relationship);
      } catch (Exception e) {
        LOG.error("Failed to remove relationship from RDF", e);
      }
    }
  }

  /**
   * Check if RDF is enabled
   */
  public static boolean isEnabled() {
    return rdfRepository != null && rdfRepository.isEnabled();
  }
}
