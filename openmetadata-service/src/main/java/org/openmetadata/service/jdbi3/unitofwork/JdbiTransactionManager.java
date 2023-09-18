package org.openmetadata.service.jdbi3.unitofwork;

import java.util.Collections;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Handles;

@Slf4j
public class JdbiTransactionManager {
  private static JdbiTransactionManager instance;
  private static volatile boolean initialized = false;
  private final JdbiHandleManager handleManager;
  private final Set<Integer> IN_TRANSACTION_HANDLES = Collections.newSetFromMap(new ConcurrentHashMap<>());

  private JdbiTransactionManager(JdbiHandleManager handleManager) {
    this.handleManager = handleManager;
  }

  public static void initialize(JdbiHandleManager handleManager) {
    if (!initialized) {
      instance = new JdbiTransactionManager(handleManager);
      initialized = true;
    } else {
      LOG.info("Jdbi Transaction Manager is already initialized");
    }
  }

  public static JdbiTransactionManager getInstance() {
    return instance;
  }

  public void begin(boolean autoCommit) {
    try {
      Handle handle = handleManager.get();
      if (!autoCommit) {
        handle.getConnection().setAutoCommit(false);
        handle.getConfig(Handles.class).setForceEndTransactions(false);
        handle.begin();
        IN_TRANSACTION_HANDLES.add(handle.hashCode());
        LOG.debug(
            "Begin Transaction Thread Id [{}] has handle id [{}] Transaction {} Level {}",
            Thread.currentThread().getId(),
            handle.hashCode(),
            handle.isInTransaction(),
            handle.getTransactionIsolationLevel());
      }
    } catch (Exception ex) {
      terminateHandle();
    }
  }

  public void commit() {
    if (handleManager.handleExists()) {
      Handle handle = handleManager.get();
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
  }

  public void rollback() {
    if (handleManager.handleExists()) {
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
    if (handleManager.handleExists()) {
      IN_TRANSACTION_HANDLES.remove(handleManager.get().hashCode());
      handleManager.clear();
    }
  }
}
