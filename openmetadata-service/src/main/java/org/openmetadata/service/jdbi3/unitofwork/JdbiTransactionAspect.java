package org.openmetadata.service.jdbi3.unitofwork;

import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Handles;

@Slf4j
public class JdbiTransactionAspect {
  private final JdbiHandleManager handleManager;

  public JdbiTransactionAspect(JdbiHandleManager handleManager) {
    this.handleManager = handleManager;
  }

  public void begin(boolean autoCommit) {
    try {
      Handle handle = handleManager.get();
      handle.getConnection().setAutoCommit(autoCommit);
      handle.getConfig(Handles.class).setForceEndTransactions(false);
      // handle.setTransactionIsolationLevel(TransactionIsolationLevel.READ_COMMITTED);
      handle.begin();
      LOG.debug(
          "Begin Transaction Thread Id [{}] has handle id [{}] Transaction {} Level {}",
          Thread.currentThread().getId(),
          handle.hashCode(),
          handle.isInTransaction(),
          handle.getTransactionIsolationLevel());
    } catch (Exception ex) {
      handleManager.clear();
      throw new RuntimeException(ex.getMessage());
    }
  }

  public void commit() {
    Handle handle = handleManager.get();
    if (handle == null) {
      LOG.debug(
          "Handle was found to be null during commit for Thread Id [{}]. It might have already been closed",
          Thread.currentThread().getId());
      return;
    }
    try {
      handle.getConnection().commit();
      // handle.commit();
      LOG.debug(
          "Performing commit Thread Id [{}] has handle id [{}] Transaction {} Level {}",
          Thread.currentThread().getId(),
          handle.hashCode(),
          handle.isInTransaction(),
          handle.getTransactionIsolationLevel());
    } catch (Exception ex) {
      handle.rollback();
    } finally {
      terminateHandle();
    }
  }

  public void rollback() {
    Handle handle = handleManager.get();
    if (handle == null) {
      LOG.debug("Handle was found to be null during rollback for [{}]", Thread.currentThread().getId());
      return;
    }
    try {
      handle.getConnection().rollback();
      // handle.rollback();
      LOG.debug(
          "Performed rollback on Thread Id [{}] has handle id [{}] Transaction {} Level {}",
          Thread.currentThread().getId(),
          handle.hashCode(),
          handle.isInTransaction(),
          handle.getTransactionIsolationLevel());
    } catch (Exception e) {
      LOG.debug("Failed to rollback transaction due to {}", e);
    } finally {
      terminateHandle();
    }
  }

  public void terminateHandle() {
    handleManager.clear();
  }
}
