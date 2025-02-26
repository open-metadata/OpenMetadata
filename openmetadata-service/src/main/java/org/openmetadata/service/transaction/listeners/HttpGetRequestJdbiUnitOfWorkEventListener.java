package org.openmetadata.service.transaction.listeners;

import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.server.monitoring.RequestEvent;
import org.glassfish.jersey.server.monitoring.RequestEventListener;
import org.openmetadata.service.transaction.JdbiTransactionAspect;
import org.openmetadata.service.transaction.manager.JdbiHandleManager;

/**
 * This listener binds a transaction aspect to the currently serving GET request without creating
 * any transaction context and is simply responsible for initialising and terminating handles
 * upon successful start and end of request marked by Jersey request monitoring events
 * {@code RESOURCE_METHOD_START} and {@code FINISHED} respectively
 * <br><br>
 * For creating a transaction context, see {@link NonHttpGetRequestJdbiUnitOfWorkEventListener}
 */
@Slf4j
public class HttpGetRequestJdbiUnitOfWorkEventListener implements RequestEventListener {
  private final JdbiTransactionAspect transactionAspect;

  public HttpGetRequestJdbiUnitOfWorkEventListener(JdbiHandleManager handleManager) {
    this.transactionAspect = new JdbiTransactionAspect(handleManager);
  }

  @Override
  public void onEvent(RequestEvent event) {
    RequestEvent.Type type = event.getType();
    LOG.debug("Handling GET Request Event {} {}", type, Thread.currentThread().getId());

    if (type == RequestEvent.Type.FINISHED) {
      transactionAspect.terminateHandle();
    }
  }
}
