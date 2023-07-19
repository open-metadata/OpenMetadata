package org.openmetadata.service.jdbi3.unitofwork;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;

@Slf4j
public class ManagedHandleInvocationHandler<T> implements InvocationHandler {
  private static final Object[] NO_ARGS = {};
  private final JdbiHandleManager handleManager;
  private final Class<T> underlying;

  public ManagedHandleInvocationHandler(JdbiHandleManager handleManager, Class<T> underlying) {
    this.handleManager = handleManager;
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

  private Object handleInvocation(Method method, Object[] args)
      throws IllegalAccessException, InvocationTargetException {
    Handle handle = handleManager.get();
    LOG.debug(
        "{}.{} [{}] Thread Id [{}] with handle id [{}]",
        method.getDeclaringClass().getSimpleName(),
        method.getName(),
        underlying.getSimpleName(),
        Thread.currentThread().getId(),
        handle.hashCode());

    Object dao = handle.attach(underlying);
    return method.invoke(dao, args);
  }

  @Override
  public String toString() {
    return "Proxy[" + underlying.getSimpleName() + "]";
  }
}
