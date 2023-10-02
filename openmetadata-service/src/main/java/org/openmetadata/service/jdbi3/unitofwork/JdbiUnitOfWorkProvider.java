package org.openmetadata.service.jdbi3.unitofwork;

import com.google.common.reflect.Reflection;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;

@Slf4j
@SuppressWarnings({"UnstableApiUsage", "rawtypes", "unchecked"})
public class JdbiUnitOfWorkProvider {
  private static JdbiUnitOfWorkProvider instance;
  private static volatile boolean initialized = false;
  private final JdbiHandleManager handleManager;

  private JdbiUnitOfWorkProvider(JdbiHandleManager handleManager) {
    this.handleManager = handleManager;
  }

  public static JdbiUnitOfWorkProvider withDefault(Jdbi dbi) {
    return initialize(new RequestScopedJdbiHandleManager(dbi));
  }

  public static JdbiUnitOfWorkProvider withLinked(Jdbi dbi) {
    return initialize(new LinkedRequestScopedJdbiHandleManager(dbi));
  }

  public static JdbiUnitOfWorkProvider getInstance() {
    return instance;
  }

  private static JdbiUnitOfWorkProvider initialize(JdbiHandleManager handleManager) {
    if (!initialized) {
      instance = new JdbiUnitOfWorkProvider(handleManager);
      initialized = true;
    } else {
      LOG.info("JdbiUnitOfWorkProvider is already initialized");
    }
    return instance;
  }

  public JdbiHandleManager getHandleManager() {
    return handleManager;
  }

  public Handle getHandle() {
    return handleManager.get();
  }

  /**
   * getWrappedInstanceForDaoClass generates a proxy instance of the dao class for which the jdbi unit of work aspect
   * would be wrapped around with. This method however may be used in case the classpath scanning is disabled. If the
   * original class is null or contains no relevant JDBI annotations, this method throws an exception
   *
   * @param daoClass the DAO class for which a proxy needs to be created fo
   * @return the wrapped instance ready to be passed around
   */
  public static Object getWrappedInstanceForDaoClass(Class daoClass) {
    if (daoClass == null) {
      throw new IllegalArgumentException("DAO Class cannot be null");
    }
    LOG.debug(
        "Binding class [{}] with proxy handler [{}] ",
        daoClass.getSimpleName(),
        JdbiUnitOfWorkProvider.getInstance().getHandleManager().getClass().getSimpleName());
    ManagedHandleInvocationHandler handler = new ManagedHandleInvocationHandler<>(daoClass);
    Object proxiedInstance = Reflection.newProxy(daoClass, handler);
    return daoClass.cast(proxiedInstance);
  }
}
