package org.openmetadata.service.transaction;

import com.google.common.reflect.Reflection;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.transaction.manager.JdbiHandleManager;
import org.openmetadata.service.transaction.manager.LinkedRequestScopedJdbiHandleManager;
import org.openmetadata.service.transaction.manager.RequestScopedJdbiHandleManager;

@Getter
@SuppressWarnings({"UnstableApiUsage", "rawtypes", "unchecked"})
@Slf4j
public class JdbiUnitOfWorkProvider {
  private final JdbiHandleManager handleManager;

  private JdbiUnitOfWorkProvider(JdbiHandleManager handleManager) {
    this.handleManager = handleManager;
  }

  public static JdbiUnitOfWorkProvider withDefault(Jdbi jdbi) {
    JdbiHandleManager handleManager = new RequestScopedJdbiHandleManager(jdbi);
    return new JdbiUnitOfWorkProvider(handleManager);
  }

  public static JdbiUnitOfWorkProvider withLinked(Jdbi dbi) {
    JdbiHandleManager handleManager = new LinkedRequestScopedJdbiHandleManager(dbi);
    return new JdbiUnitOfWorkProvider(handleManager);
  }

  /**
   * getWrappedInstanceForDaoClass generates a proxy instance of the dao class for which
   * the jdbi unit of work aspect would be wrapped around with.
   * This method however may be used in case the classpath scanning is disabled.
   *
   * @param daoClass the DAO class for which a proxy needs to be created fo
   * @return the wrapped instance ready to be passed around
   */
  public Object getWrappedInstanceForDaoClass(Class daoClass) {
    LOG.info(
        "Binding class [{}] with proxy handler [{}] ",
        daoClass.getSimpleName(),
        handleManager.getClass().getSimpleName());
    ManagedHandleInvocationHandler handler =
        new ManagedHandleInvocationHandler<>(handleManager, daoClass);
    Object proxiedInstance = Reflection.newProxy(daoClass, handler);
    return daoClass.cast(proxiedInstance);
  }
}
