package org.openmetadata.service.jobs;

/**
 * The background job types OpenMetadata writes. {@code background_jobs.jobType} is an open set: a
 * distribution writes its own types alongside these and registers their handlers in {@link
 * JobHandlerRegistry}, without changing openmetadata-spec.
 */
public final class BackgroundJobTypes {
  public static final String CUSTOM_PROPERTY_ENUM_CLEANUP = "CUSTOM_PROPERTY_ENUM_CLEANUP";
  public static final String CSV_IMPORT = "CSV_IMPORT";
  public static final String CSV_EXPORT = "CSV_EXPORT";
  public static final String AUDIT_EXPORT = "AUDIT_EXPORT";
  public static final String ONTOLOGY_BULK = "ONTOLOGY_BULK";
  public static final String ONTOLOGY_PACK_INSTALL = "ONTOLOGY_PACK_INSTALL";
  public static final String CONTEXT_MEMORY_EXTRACTION = "CONTEXT_MEMORY_EXTRACTION";
  public static final String MEMORY_GLOSSARY_DERIVATION = "MEMORY_GLOSSARY_DERIVATION";

  private BackgroundJobTypes() {}
}
