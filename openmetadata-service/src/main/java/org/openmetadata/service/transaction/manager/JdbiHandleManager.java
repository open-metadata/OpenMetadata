package org.openmetadata.service.transaction.manager;

import java.util.concurrent.ThreadFactory;
import org.jdbi.v3.core.Handle;

/**
 * A {@link JdbiHandleManager} is used to provide the lifecycle of a {@link Handle} with respect
 * to a given scope. A scope may be session based, request based or may be invoked on every run.
 */
public interface JdbiHandleManager {

  /**
   * Provide a way to get a Jdbi handle, a wrapped connection to the underlying database
   *
   * @return a valid handle tied with a specific scope
   */
  Handle get();

  /**
   * Provide a way to clear the handle rendering it useless for the other methods
   */
  void clear();

  /**
   * Provide a thread factory for the caller with some identity represented by the
   * {@link #getConversationId()}. This can be used by the caller to create multiple threads,
   * say, using {@link java.util.concurrent.ExecutorService}. The {@link JdbiHandleManager} can
   * then use the thread factory to identify and manage handle use across multiple threads.
   *
   * @return a thread factory used to safely create multiple threads
   * @throws UnsupportedOperationException by default. Implementations overriding this method
   *                                       must ensure that the conversation id is unique
   */
  default ThreadFactory createThreadFactory() {
    throw new UnsupportedOperationException("Thread factory creation is not supported");
  }

  /**
   * Provide a unique identifier for the conversation with a handle. No two identifiers
   * should co exist at once during the application lifecycle or else handle corruption
   * or misuse might occur.
   * <br><br>
   * This can be relied upon by the {@link #createThreadFactory()} to reuse handles across
   * multiple threads spawned off a request thread.
   *
   * @return a unique identifier applicable to a scope
   * @implNote hashcode can not be relied upon for providing a unique identifier due to the
   * possibility of collision. Instead opt for a monotonically increasing counter, such as
   * the thread id.
   */
  default String getConversationId() {
    return String.valueOf(Thread.currentThread().getId());
  }
}
