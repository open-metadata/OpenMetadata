package org.openmetadata.service.jdbi3.unitofwork;

import java.util.Collections;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Handles;

@Slf4j
public class JdbiTransactionAspect {
  private final JdbiHandleManager handleManager;
  private final Set<Integer> IN_TRANSACTION_HANDLES = Collections.newSetFromMap(new ConcurrentHashMap<>());

  public JdbiTransactionAspect(JdbiHandleManager handleManager) {
    this.handleManager = handleManager;
  }

  public void begin(boolean autoCommit) {
    try {
      Handle handle = handleManager.get();
      handle.getConnection().setAutoCommit(autoCommit);
      handle.getConfig(Handles.class).setForceEndTransactions(false);
      handle.begin();
      IN_TRANSACTION_HANDLES.add(handle.hashCode());
      LOG.debug(
          "Begin Transaction Thread Id [{}] has handle id [{}] Transaction {} Level {}",
          Thread.currentThread().getId(),
          handle.hashCode(),
          handle.isInTransaction(),
          handle.getTransactionIsolationLevel());
    } catch (Exception ex) {
      terminateHandle();
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
      LOG.debug(
          "Performing commit Thread Id [{}] has handle id [{}] Transaction {} Level {}",
          Thread.currentThread().getId(),
          handle.hashCode(),
          handle.isInTransaction(),
          handle.getTransactionIsolationLevel());
    } catch (Exception ex) {
      rollback();
    }
  }

  public void rollback() {
    if (IN_TRANSACTION_HANDLES.contains(handleManager.get().hashCode())) {
      Handle handle = handleManager.get();
      if (handle == null) {
        LOG.debug("Handle was found to be null during rollback for [{}]", Thread.currentThread().getId());
        return;
      }
      try {
        handle.getConnection().rollback();
        LOG.debug(
            "Performed rollback on Thread Id [{}] has handle id [{}] Transaction {} Level {}",
            Thread.currentThread().getId(),
            handle.hashCode(),
            handle.isInTransaction(),
            handle.getTransactionIsolationLevel());
      } catch (Exception e) {
        LOG.debug("Failed to rollback transaction due to", e);
      } finally {
        terminateHandle();
      }
    }
  }

  public void terminateHandle() {
    IN_TRANSACTION_HANDLES.remove(handleManager.get().hashCode());
    handleManager.clear();
  }
}
