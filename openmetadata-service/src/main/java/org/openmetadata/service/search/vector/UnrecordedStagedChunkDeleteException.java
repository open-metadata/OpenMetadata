package org.openmetadata.service.search.vector;

/**
 * This node missed a delete from the run's staged chunk generation and could not record it on the
 * cluster. A partition that ends with it fails for good, without a retry: no node can repair the
 * missed delete, and the failed partition's error, which starts with {@link
 * VectorIndexService#UNRECORDED_STAGED_DELETE}, is what keeps the generation from going live.
 */
public class UnrecordedStagedChunkDeleteException extends IllegalStateException {
  public UnrecordedStagedChunkDeleteException(String generation) {
    super(
        VectorIndexService.UNRECORDED_STAGED_DELETE
            + ": a delete from staged chunk index "
            + generation
            + " failed and the flag that blocks its promotion could not be saved");
  }
}
