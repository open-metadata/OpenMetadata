package org.openmetadata.service.transaction.listeners;

import org.glassfish.jersey.server.model.ResourceMethod;
import org.glassfish.jersey.server.monitoring.RequestEvent;
import org.glassfish.jersey.server.monitoring.RequestEventListener;
import org.openmetadata.service.transaction.JdbiTransactionAspect;
import org.openmetadata.service.transaction.JdbiUnitOfWork;
import org.openmetadata.service.transaction.manager.JdbiHandleManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * This listener binds a transaction aspect to the currently serving GET request by creating
 * a transaction context if and only if the resource method is annotated with {@link JdbiUnitOfWork}
 * <br><br>
 * It is responsible for initialising and terminating handles as well as calling appropriate
 * transaction methods based on theJersey request monitoring events
 * {@code RESOURCE_METHOD_START}, {@code RESP_FILTERS_START}, {@code ON_EXCEPTION} and {@code FINISHED}
 * <br><br>
 * For creating a access context without transactions, see {@link HttpGetRequestJdbiUnitOfWorkEventListener}
 */
public class NonHttpGetRequestJdbiUnitOfWorkEventListener implements RequestEventListener {

  private final Logger log =
      LoggerFactory.getLogger(NonHttpGetRequestJdbiUnitOfWorkEventListener.class);
  private final JdbiTransactionAspect transactionAspect;

  public NonHttpGetRequestJdbiUnitOfWorkEventListener(JdbiHandleManager handleManager) {
    this.transactionAspect = new JdbiTransactionAspect(handleManager);
  }

  @Override
  public void onEvent(RequestEvent event) {
    RequestEvent.Type type = event.getType();
    String httpMethod = event.getContainerRequest().getMethod();

    log.debug("Handling {} Request Event {} {}", httpMethod, type, Thread.currentThread().getId());
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
      JdbiUnitOfWork annotation =
          method.getInvocable().getDefinitionMethod().getAnnotation(JdbiUnitOfWork.class);
      return annotation != null;
    }
    return false;
  }
}
