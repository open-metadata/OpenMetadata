package org.openmetadata.service.jdbi3.unitofwork;

import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.server.model.ResourceMethod;
import org.glassfish.jersey.server.monitoring.RequestEvent;
import org.glassfish.jersey.server.monitoring.RequestEventListener;

@Slf4j
class NonHttpGetRequestJdbiUnitOfWorkEventListener implements RequestEventListener {

  private final JdbiTransactionAspect transactionAspect;

  NonHttpGetRequestJdbiUnitOfWorkEventListener(JdbiHandleManager handleManager) {
    this.transactionAspect = new JdbiTransactionAspect(handleManager);
  }

  @Override
  public void onEvent(RequestEvent event) {
    RequestEvent.Type type = event.getType();
    String httpMethod = event.getContainerRequest().getMethod();

    LOG.debug("Handling {} Request Event {} {}", httpMethod, type, Thread.currentThread().getId());
    boolean isTransactional = isTransactional(event);

    if (type == RequestEvent.Type.RESOURCE_METHOD_START) {
      initialise(isTransactional);

    } else if (type == RequestEvent.Type.RESP_FILTERS_START) {
      commit(isTransactional);

    } else if (type == RequestEvent.Type.ON_EXCEPTION) {
      rollback(isTransactional);

    } else if (type == RequestEvent.Type.FINISHED) {
      transactionAspect.terminateHandle();
    }
  }

  private void commit(boolean isTransactional) {
    if (isTransactional) {
      transactionAspect.commit();
    }
  }

  private void rollback(boolean isTransactional) {
    if (isTransactional) {
      transactionAspect.rollback();
    }
  }

  private void initialise(boolean isTransactional) {
    if (isTransactional) {
      transactionAspect.begin();
    }
  }

  private boolean isTransactional(RequestEvent event) {
    ResourceMethod method = event.getUriInfo().getMatchedResourceMethod();
    if (method != null) {
      JdbiUnitOfWork annotation = method.getInvocable().getDefinitionMethod().getAnnotation(JdbiUnitOfWork.class);
      return annotation != null;
    }
    return false;
  }
}
