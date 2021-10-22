package org.openmetadata.catalog.jdbi3;

import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.ResultList;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.List;

/**
 * Interface used for accessing the concrete entity DAOs such as table, dashboard etc.
 * This gives a uniform access so that common boiler plate code can be reduced.
 */
public abstract class EntityRepository<T> {
  private final EntityDAO<T> dao;

  EntityRepository(EntityDAO<T> entityDAO) {
    this.dao = entityDAO;
  }

  /**
   * DAO related operations
   */
  @Transaction
  public final List<String> listAfter(String fqnPrefix, int limitParam, String after) {
    return dao.listAfter(fqnPrefix, limitParam, after);
  }

  @Transaction
  public final List<String> listBefore(String fqnPrefix, int limitParam, String before) {
    return dao.listBefore(fqnPrefix, limitParam, before);
  }

  @Transaction
  public final int listCount(String fqnPrefix) {
    return dao.listCount(fqnPrefix);
  }

  @Transaction
  public final T get(String id, Fields fields) throws IOException, ParseException {
    return setFields(dao.findEntityById(id), fields);
  }

  @Transaction
  public final T getByName(String fqn, Fields fields) throws IOException, ParseException {
    return setFields(dao.findEntityByName(fqn), fields);
  }

  /**
   * Entity related operations
   */
  public abstract String getFullyQualifiedName(T entity);

  public abstract T setFields(T entity, Fields fields) throws IOException, ParseException;

  public abstract ResultList<T> getResultList(List<T> entities, String beforeCursor, String afterCursor,
                                     int total) throws GeneralSecurityException, UnsupportedEncodingException;
}
