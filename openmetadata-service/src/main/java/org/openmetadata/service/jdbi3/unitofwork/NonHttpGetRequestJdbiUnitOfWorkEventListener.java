package org.openmetadata.service.jdbi3.unitofwork;

import javax.ws.rs.HttpMethod;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.server.monitoring.RequestEvent;
import org.glassfish.jersey.server.monitoring.RequestEventListener;

@Slf4j
class NonHttpGetRequestJdbiUnitOfWorkEventListener implements RequestEventListener {

  NonHttpGetRequestJdbiUnitOfWorkEventListener() {}

  @Override
  public void onEvent(RequestEvent event) {
    RequestEvent.Type type = event.getType();
    String httpMethod = event.getContainerRequest().getMethod();

    LOG.debug("Handling {} Request Event {} {}", httpMethod, type, Thread.currentThread().getId());
    boolean isTransactional = isTransactional(event);
    if (isTransactional) {
      if (type == RequestEvent.Type.RESOURCE_METHOD_START) {
        JdbiTransactionManager.getInstance().begin(false);
      } else if (type == RequestEvent.Type.RESP_FILTERS_START) {
        JdbiTransactionManager.getInstance().commit();
      } else if (type == RequestEvent.Type.ON_EXCEPTION) {
        JdbiTransactionManager.getInstance().rollback();
      } else if (type == RequestEvent.Type.FINISHED) {
        JdbiTransactionManager.getInstance().terminateHandle();
      }
    }
  }

  private boolean isTransactional(RequestEvent event) {
    String httpMethod = event.getContainerRequest().getMethod();
    return httpMethod.equals(HttpMethod.POST)
        || httpMethod.equals(HttpMethod.PUT)
        || httpMethod.equals(HttpMethod.PATCH)
        || httpMethod.equals(HttpMethod.DELETE);
  }
}
