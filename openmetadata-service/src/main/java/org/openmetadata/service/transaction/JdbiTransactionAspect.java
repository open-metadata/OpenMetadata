package org.openmetadata.service.transaction;

import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.transaction.manager.JdbiHandleManager;

/**
 * An aspect providing low level operations around a {@link Handle}
 * This is inspired from Dropwizard's Unit of work aspect used to manage handles for hibernate.
 *
 * @see <a href="https://github.com/dropwizard/dropwizard/blob/master/dropwizard-hibernate/src/main/java/io/dropwizard/hibernate/UnitOfWorkAspect.java">
 * Unit Of Work Aspect</a>
 */
@Slf4j
public class JdbiTransactionAspect {

  private final JdbiHandleManager handleManager;

  public JdbiTransactionAspect(JdbiHandleManager handleManager) {
    this.handleManager = handleManager;
  }

  public void begin() {
    try {
      Handle handle = handleManager.get();
      handle.begin();
      LOG.debug(
          "Begin Transaction Thread Id [{}] has handle id [{}] Transaction {} Level {}",
          Thread.currentThread().getId(),
          handle.hashCode(),
          handle.isInTransaction(),
          handle.getTransactionIsolationLevel());

    } catch (Exception ex) {
      handleManager.clear();
      throw ex;
    }
  }

  @SneakyThrows
  public void commit() {
    Handle handle = handleManager.get();
    if (handle == null) {
      LOG.debug(
          "Handle was found to be null during commit for Thread Id [{}]. It might have already been closed",
          Thread.currentThread().getId());
      return;
    }

    if (handle.getConnection().getAutoCommit()) {
      LOG.debug("Connection is in auto commit mode. Skipping commit");
      return;
    }

    try {
      handle.commit();
      LOG.debug(
          "Performing commit Thread Id [{}] has handle id [{}] Transaction {} Level {}",
          Thread.currentThread().getId(),
          handle.hashCode(),
          handle.isInTransaction(),
          handle.getTransactionIsolationLevel());

    } catch (Exception ex) {
      LOG.debug(
          "Performing commit Thread Id [{}] has handle id [{}] Transaction {} Level {} Encountered Exception",
          Thread.currentThread().getId(),
          handle.hashCode(),
          handle.isInTransaction(),
          handle.getTransactionIsolationLevel(),
          ex);
      handle.rollback();
      throw ex;
    }
  }

  public void rollback() {
    Handle handle = handleManager.get();
    if (handle == null) {
      LOG.info(
          "Handle was found to be null during rollback for [{}]", Thread.currentThread().getId());
      return;
    }
    try {
      handle.rollback();
      LOG.info(
          "Performed rollback on Thread Id [{}] has handle id [{}] Transaction {} Level {}",
          Thread.currentThread().getId(),
          handle.hashCode(),
          handle.isInTransaction(),
          handle.getTransactionIsolationLevel());
    } finally {
      terminateHandle();
    }
  }

  public void terminateHandle() {
    handleManager.clear();
  }
}
