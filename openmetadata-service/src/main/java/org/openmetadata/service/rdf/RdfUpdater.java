package org.openmetadata.service.rdf;

import io.micrometer.core.instrument.Timer;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityRelationship;
import org.openmetadata.service.monitoring.RequestLatencyContext;

@Slf4j
public class RdfUpdater {

  private static RdfRepository rdfRepository;

  private RdfUpdater() {}

  public static void initialize(RdfConfiguration config) {
    if (config.getEnabled() != null && config.getEnabled()) {
      RdfRepository.initialize(config);
      rdfRepository = RdfRepository.getInstance();
      LOG.info("RDF updater initialized");
    } else {
      LOG.info("RDF updater disabled");
    }
  }

  public static void updateEntity(EntityInterface entity) {
    if (rdfRepository != null && rdfRepository.isEnabled()) {
      Timer.Sample sample = RequestLatencyContext.startRdfOperation();
      try {
        rdfRepository.createOrUpdate(entity);
      } catch (Exception e) {
        LOG.error("Failed to update entity {} in RDF", entity.getId(), e);
      } finally {
        RequestLatencyContext.endRdfOperation(sample);
      }
    }
  }

  public static void deleteEntity(EntityReference entityReference) {
    if (rdfRepository != null && rdfRepository.isEnabled()) {
      Timer.Sample sample = RequestLatencyContext.startRdfOperation();
      try {
        rdfRepository.delete(entityReference);
      } catch (Exception e) {
        LOG.error("Failed to delete entity {} in RDF", entityReference.getId(), e);
      } finally {
        RequestLatencyContext.endRdfOperation(sample);
      }
    }
  }

  public static void addRelationship(EntityRelationship relationship) {
    if (rdfRepository != null && rdfRepository.isEnabled()) {
      Timer.Sample sample = RequestLatencyContext.startRdfOperation();
      try {
        rdfRepository.addRelationship(relationship);
      } catch (Exception e) {
        LOG.error("Failed to add relationship in RDF", e);
      } finally {
        RequestLatencyContext.endRdfOperation(sample);
      }
    }
  }

  public static void removeRelationship(EntityRelationship relationship) {
    if (rdfRepository != null && rdfRepository.isEnabled()) {
      Timer.Sample sample = RequestLatencyContext.startRdfOperation();
      try {
        rdfRepository.removeRelationship(relationship);
      } catch (Exception e) {
        LOG.error("Failed to remove relationship in RDF", e);
      } finally {
        RequestLatencyContext.endRdfOperation(sample);
      }
    }
  }

  public static boolean isEnabled() {
    return rdfRepository != null && rdfRepository.isEnabled();
  }

  public static void disable() {
    rdfRepository = null;
    RdfRepository.reset();
    LOG.info("RDF updater disabled");
  }
}
