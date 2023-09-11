package org.openmetadata.service.jdbi3.unitofwork;

import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.server.monitoring.RequestEvent;
import org.glassfish.jersey.server.monitoring.RequestEventListener;

@Slf4j
class HttpGetRequestJdbiUnitOfWorkEventListener implements RequestEventListener {

  private final JdbiTransactionAspect transactionAspect;

  HttpGetRequestJdbiUnitOfWorkEventListener(JdbiHandleManager handleManager) {
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
