package org.openmetadata.service.jdbi3.unitofwork;

import com.google.common.reflect.Reflection;
import java.lang.reflect.Method;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.statement.SqlBatch;
import org.jdbi.v3.sqlobject.statement.SqlCall;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;

@Slf4j
@SuppressWarnings({"UnstableApiUsage", "rawtypes", "unchecked"})
public class JdbiUnitOfWorkProvider {

  private final JdbiHandleManager handleManager;

  private JdbiUnitOfWorkProvider(JdbiHandleManager handleManager) {
    this.handleManager = handleManager;
  }

  public static JdbiUnitOfWorkProvider withDefault(Jdbi dbi) {
    JdbiHandleManager handleManager = new RequestScopedJdbiHandleManager(dbi);
    return new JdbiUnitOfWorkProvider(handleManager);
  }

  public static JdbiUnitOfWorkProvider withLinked(Jdbi dbi) {
    JdbiHandleManager handleManager = new LinkedRequestScopedJdbiHandleManager(dbi);
    return new JdbiUnitOfWorkProvider(handleManager);
  }

  public JdbiHandleManager getHandleManager() {
    return handleManager;
  }

  /**
   * getWrappedInstanceForDaoClass generates a proxy instance of the dao class for which the jdbi unit of work aspect
   * would be wrapped around with. This method however may be used in case the classpath scanning is disabled. If the
   * original class is null or contains no relevant JDBI annotations, this method throws an exception
   *
   * @param daoClass the DAO class for which a proxy needs to be created fo
   * @return the wrapped instance ready to be passed around
   */
  public Object getWrappedInstanceForDaoClass(Class daoClass) {
    if (daoClass == null) {
      throw new IllegalArgumentException("DAO Class cannot be null");
    }
    boolean atLeastOneJdbiMethod = false;
    for (Method method : daoClass.getDeclaredMethods()) {
      if (method.getDeclaringClass() == daoClass) {
        atLeastOneJdbiMethod = method.getAnnotation(SqlQuery.class) != null;
        atLeastOneJdbiMethod = atLeastOneJdbiMethod || method.getAnnotation(SqlUpdate.class) != null;
        atLeastOneJdbiMethod = atLeastOneJdbiMethod || method.getAnnotation(SqlUpdate.class) != null;
        atLeastOneJdbiMethod = atLeastOneJdbiMethod || method.getAnnotation(SqlBatch.class) != null;
        atLeastOneJdbiMethod = atLeastOneJdbiMethod || method.getAnnotation(SqlCall.class) != null;
        atLeastOneJdbiMethod = atLeastOneJdbiMethod || method.getAnnotation(ConnectionAwareSqlQuery.class) != null;
        atLeastOneJdbiMethod = atLeastOneJdbiMethod || method.getAnnotation(ConnectionAwareSqlUpdate.class) != null;
      }
    }
    if (!atLeastOneJdbiMethod) {
      throw new IllegalArgumentException(
          String.format("Class [%s] has no method annotated with a Jdbi SQL Object", daoClass.getSimpleName()));
    }

    LOG.info(
        "Binding class [{}] with proxy handler [{}] ",
        daoClass.getSimpleName(),
        handleManager.getClass().getSimpleName());
    ManagedHandleInvocationHandler handler = new ManagedHandleInvocationHandler<>(handleManager, daoClass);
    Object proxiedInstance = Reflection.newProxy(daoClass, handler);
    return daoClass.cast(proxiedInstance);
  }
}
