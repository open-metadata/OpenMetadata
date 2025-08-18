package org.openmetadata.service.rdf.storage;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;

/**
 * Factory for creating RDF storage implementations.
 * Supports multiple remote RDF stores while maintaining OpenMetadata's stateless architecture.
 */
@Slf4j
public class RdfStorageFactory {

  private RdfStorageFactory() {
    // Private constructor for utility class
  }

  /**
   * Create an RDF storage instance based on configuration.
   *
   * Supported storage types:
   * - FUSEKI: Apache Jena Fuseki server
   * - QLEVER: QLever server (not yet implemented)
   */
  public static RdfStorageInterface createStorage(RdfConfiguration config) {
    RdfConfiguration.StorageType storageType = config.getStorageType();

    if (storageType == null) {
      throw new IllegalArgumentException(
          "RDF storage type must be specified. Supported types: FUSEKI");
    }

    LOG.info("Creating RDF storage of type: {}", storageType);

    switch (storageType) {
      case FUSEKI:
        return new JenaFusekiStorage(config);

      case QLEVER:
        throw new UnsupportedOperationException(
            "QLever storage is not yet implemented. Please use FUSEKI.");

      default:
        throw new IllegalArgumentException(
            "Unsupported RDF storage type: '"
                + storageType
                + "'. Supported types: FUSEKI (QLEVER planned for future)");
    }
  }
}
