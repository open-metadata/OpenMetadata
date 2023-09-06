package org.openmetadata.service.jdbi3.unitofwork;

import static org.openmetadata.service.jdbi3.unitofwork.JdbiUnitOfWorkProvider.getWrappedInstanceForDaoClass;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.openmetadata.service.jdbi3.CollectionDAO;

@Slf4j
public class ManagedHandleInvocationHandler<T> implements InvocationHandler {
  private static final Object[] NO_ARGS = {};
  private final Class<T> underlying;
  private final JdbiUnitOfWorkProvider jdbiUnitOfWorkProvider;

  public ManagedHandleInvocationHandler(JdbiUnitOfWorkProvider jdbiUnitOfWorkProvider, Class<T> underlying) {
    this.jdbiUnitOfWorkProvider = jdbiUnitOfWorkProvider;
    this.underlying = underlying;
  }

  /**
   * {@inheritDoc}
   *
   * <ul>
   *   <li>{@code proxy.toString()} delegates to {@link ManagedHandleInvocationHandler#toString}
   *   <li>other method calls are dispatched to {@link ManagedHandleInvocationHandler#handleInvocation}.
   * </ul>
   */
  @Override
  public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
    if (args == null) {
      args = NO_ARGS;
    }
    if (args.length == 0 && method.getName().equals("toString")) {
      return toString();
    }
    return handleInvocation(method, args);
  }

  private Object handleInvocation(Method method, Object[] args) throws Throwable {
    Handle handle = jdbiUnitOfWorkProvider.getHandleManager().get();
    LOG.debug(
        "{}.{} [{}] Thread Id [{}] with handle id [{}]",
        method.getDeclaringClass().getSimpleName(),
        method.getName(),
        underlying.getSimpleName(),
        Thread.currentThread().getId(),
        handle.hashCode());

    if (CollectionDAO.class.isAssignableFrom(underlying) && method.isAnnotationPresent(CreateSqlObject.class)) {
      return getWrappedInstanceForDaoClass(jdbiUnitOfWorkProvider, method.getReturnType());
    } else {
      Object dao = handle.attach(underlying);
      try {
        return method.invoke(dao, args);
      } catch (Exception ex) {
        throw ex.getCause();
      }
    }
  }

  @Override
  public String toString() {
    return "Proxy[" + underlying.getSimpleName() + "]";
  }
}
