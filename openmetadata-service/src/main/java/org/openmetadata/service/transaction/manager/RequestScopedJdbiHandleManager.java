package org.openmetadata.service.transaction.manager;

import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;

/**
 * This implementation gets a new handle which is scoped to the thread requesting the handle.
 * <br><br>
 * It can be used to service requests which interact with multiple SQL objects as part of a common
 * transaction. All such SQL objects will be attached to the common handle.
 *
 * @apiNote Not suitable for requests which spawn new threads from the requesting thread as the scoped
 * handle is not preserved. This implementation, therefore, does not support thread factory creation
 */
@Slf4j
public class RequestScopedJdbiHandleManager implements JdbiHandleManager {

  private final Jdbi jdbi;

  @SuppressWarnings("ThreadLocalUsage")
  private final ThreadLocal<Handle> threadLocal = new ThreadLocal<>();

  public RequestScopedJdbiHandleManager(Jdbi dbi) {
    this.jdbi = dbi;
  }

  @Override
  @SneakyThrows
  public Handle get() {
    if (threadLocal.get() == null) {
      threadLocal.set(jdbi.open());
    }
    Handle handle = threadLocal.get();
    LOG.debug("handle [{}] : Thread Id [{}]", handle.hashCode(), Thread.currentThread().getId());
    return handle;
  }

  @Override
  public void clear() {
    Handle handle = threadLocal.get();
    if (handle != null) {
      handle.close();
      LOG.debug(
          "Closed handle Thread Id [{}] has handle id [{}]",
          Thread.currentThread().getId(),
          handle.hashCode());

      threadLocal.remove();
      LOG.debug("Clearing handle member for thread [{}] ", Thread.currentThread().getId());
    }
  }
}
