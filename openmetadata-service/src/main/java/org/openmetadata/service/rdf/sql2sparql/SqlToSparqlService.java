package org.openmetadata.service.rdf.sql2sparql;

import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.service.rdf.storage.RdfStorageFactory;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;

@Slf4j
@Singleton
public class SqlToSparqlService {

  @Getter private SqlToSparqlTranslator translator;

  private RdfStorageInterface rdfStorage;

  private boolean initialized = false;

  public void initialize(RdfConfiguration config) {
    if (initialized) {
      return;
    }

    try {
      // Initialize RDF storage
      this.rdfStorage = RdfStorageFactory.createStorage(config);

      // Create mapping context with OpenMetadata schema mappings
      SqlMappingContext mappingContext = SqlMappingContext.createDefault();

      // Determine SQL dialect based on configuration
      SqlToSparqlTranslator.SqlDialect dialect = determineDialect();

      // Initialize translator
      this.translator = new SqlToSparqlTranslator(mappingContext, dialect);

      this.initialized = true;
      LOG.info("SQL-to-SPARQL service initialized successfully");

    } catch (Exception e) {
      LOG.error("Failed to initialize SQL-to-SPARQL service", e);
      throw new RuntimeException("SQL-to-SPARQL initialization failed", e);
    }
  }

  public String executeQuery(String sqlQuery) {
    return executeQuery(sqlQuery, "application/sparql-results+json");
  }

  public String executeQuery(String sqlQuery, String acceptFormat) {
    if (!initialized) {
      throw new IllegalStateException("SQL-to-SPARQL service not initialized");
    }

    try {
      // Translate SQL to SPARQL
      String sparqlQuery = translator.translate(sqlQuery);

      // Execute SPARQL query
      return rdfStorage.executeSparqlQuery(sparqlQuery, acceptFormat);

    } catch (Exception e) {
      LOG.error("Failed to execute SQL query over RDF", e);
      throw new RuntimeException("SQL query execution failed: " + e.getMessage(), e);
    }
  }

  public String translateOnly(String sqlQuery) {
    if (!initialized) {
      throw new IllegalStateException("SQL-to-SPARQL service not initialized");
    }

    return translator.translate(sqlQuery);
  }

  private SqlToSparqlTranslator.SqlDialect determineDialect() {
    // In a real implementation, this would check the database configuration
    // For now, default to standard SQL
    return SqlToSparqlTranslator.SqlDialect.STANDARD;
  }

  public void shutdown() {
    if (translator != null) {
      translator.clearCache();
    }
    initialized = false;
  }
}
