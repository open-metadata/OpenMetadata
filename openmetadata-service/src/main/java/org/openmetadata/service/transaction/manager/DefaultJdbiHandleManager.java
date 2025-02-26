package org.openmetadata.service.transaction.manager;

import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;

/**
 * This implementation gets a new handle each time it is invoked. It simulates the default
 * behaviour of creating new handles each time the dao method is invoked.
 * <br><br>
 * It can be used to service requests which interact with only a single method in a single handle.
 * This is a lightweight implementation suitable for testing, such as with embedded databases.
 * Any serious application should not be using this as it may quickly leak / run out of handles
 *
 * @apiNote Not suitable for requests spanning multiple Dbi as the handle returned is different
 * This implementation, therefore, does not support thread factory creation.
 */
@Slf4j
public class DefaultJdbiHandleManager implements JdbiHandleManager {
  private final Jdbi jdbi;

  public DefaultJdbiHandleManager(Jdbi jdbi) {
    this.jdbi = jdbi;
  }

  @Override
  @SneakyThrows
  public Handle get() {
    Handle handle = jdbi.open();
    LOG.debug("handle [{}] : Thread Id [{}]", handle.hashCode(), Thread.currentThread().getId());
    return handle;
  }

  @Override
  public void clear() {
    LOG.debug("No Op");
  }
}
