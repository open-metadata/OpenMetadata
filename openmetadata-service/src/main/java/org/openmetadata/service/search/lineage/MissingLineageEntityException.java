package org.openmetadata.service.search.lineage;

import org.openmetadata.sdk.exception.SearchException;

/** Only the root loader may turn a missing indexed entity into an HTTP 404. */
public final class MissingLineageEntityException extends SearchException {
  public MissingLineageEntityException(final String fqn) {
    super(String.format("Lineage entity [%s] is not indexed.", fqn));
  }
}
