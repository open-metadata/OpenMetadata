package org.openmetadata.service.jdbi3.unitofwork;

import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.server.monitoring.RequestEvent;
import org.glassfish.jersey.server.monitoring.RequestEventListener;

@Slf4j
class HttpGetRequestJdbiUnitOfWorkEventListener implements RequestEventListener {

  HttpGetRequestJdbiUnitOfWorkEventListener() {}

  @Override
  public void onEvent(RequestEvent event) {
    RequestEvent.Type type = event.getType();
    LOG.debug("Handling GET Request Event {} {}", type, Thread.currentThread().getId());
    if (type == RequestEvent.Type.RESOURCE_METHOD_START) {
      JdbiTransactionManager.getInstance().begin(true);
    } else if (type == RequestEvent.Type.FINISHED) {
      JdbiTransactionManager.getInstance().terminateHandle();
    }
  }
}
