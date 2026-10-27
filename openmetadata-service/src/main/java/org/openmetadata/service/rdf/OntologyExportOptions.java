package org.openmetadata.service.rdf;

/**
 * What a release export adds or removes beyond the captured definitions. Bound assets are current
 * operational metadata rather than release content, so they are opt-in.
 */
public record OntologyExportOptions(boolean includeInverses, boolean includeBoundAssets) {
  public static final OntologyExportOptions DEFAULTS = new OntologyExportOptions(true, false);
}
