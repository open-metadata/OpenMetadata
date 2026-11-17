package org.openmetadata.service.context.center;

import java.util.UUID;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * Marks a memory its sources took to the Archive, so restoring one of them brings it back. Only the
 * source lifecycle sets it, right after its own delete; any other delete or restore of the memory
 * clears it, so a memory a person deleted stays deleted.
 */
public final class ArchivedWithSources {
  static final String EXTENSION = "contextMemory.archivedWithSources";
  // Not the entity type: history listings read the rows whose jsonSchema is the type as versions.
  private static final String JSON_SCHEMA = "archivedWithSources";
  private static final String MARK = "{}";

  private final CollectionDAO.EntityExtensionDAO extensions;

  public ArchivedWithSources(CollectionDAO.EntityExtensionDAO extensions) {
    this.extensions = extensions;
  }

  public void mark(UUID memoryId) {
    extensions.insert(memoryId, EXTENSION, JSON_SCHEMA, MARK);
  }

  /** Read for update: a delete clearing the mark waits for the caller's transaction to end. */
  public boolean isMarked(UUID memoryId) {
    return extensions.getExtensionForUpdate(memoryId, EXTENSION) != null;
  }

  public void clear(UUID memoryId) {
    extensions.delete(memoryId, EXTENSION);
  }
}
