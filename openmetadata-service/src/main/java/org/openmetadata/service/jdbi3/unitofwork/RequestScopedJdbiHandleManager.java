package org.openmetadata.service.jdbi3.unitofwork;

import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;

@Slf4j
class RequestScopedJdbiHandleManager implements JdbiHandleManager {
  private final Jdbi dbi;

  @SuppressWarnings("ThreadLocalUsage")
  private final ThreadLocal<Handle> threadLocal = new ThreadLocal<>();

  public RequestScopedJdbiHandleManager(Jdbi dbi) {
    this.dbi = dbi;
  }

  @Override
  public Jdbi getJdbi() {
    return dbi;
  }

  @Override
  public Handle get() {
    if (threadLocal.get() == null) {
      threadLocal.set(dbi.open());
    }
    Handle handle = threadLocal.get();
    LOG.debug("handle [{}] : Thread Id [{}]", handle.hashCode(), Thread.currentThread().getId());
    return handle;
  }

  @Override
  public boolean handleExists() {
    return threadLocal.get() != null;
  }

  @Override
  public void clear() {
    Handle handle = threadLocal.get();
    if (handle != null) {
      handle.close();
      LOG.debug("Closed handle Thread Id [{}] has handle id [{}]", Thread.currentThread().getId(), handle.hashCode());

      threadLocal.remove();
      LOG.debug("Clearing handle member for thread [{}] ", Thread.currentThread().getId());
    }
  }
}
