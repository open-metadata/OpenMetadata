package org.openmetadata.it.util;

public final class SharedResourceLocks {
  public static final String GLOSSARY_TERM_RELATION_SETTINGS = "glossaryTermRelationSettings";
  public static final String OPEN_LINEAGE_SETTINGS = "openLineageSettings";
  public static final String SEARCH_SETTINGS = "searchSettings";
  public static final String TABLE_COLUMN_CUSTOM_PROPERTIES = "customProperties:tableColumn";

  /** The 2.1.0 custom-property reference migration scans the whole shared database. */
  public static final String CUSTOM_PROPERTY_REFERENCE_MIGRATION =
      "migration:customPropertyReferences";

  private SharedResourceLocks() {}
}
