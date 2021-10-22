package org.openmetadata.catalog.jdbi3;

import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.common.utils.CipherText;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.List;

/**
 * Interface used for accessing the concrete entity DAOs such as table, dashboard etc.
 * This gives a uniform access so that common boiler plate code can be reduced.
 */
public abstract class EntityRepository<T> {
  private final Class<T> entityClass;
  private final EntityDAO<T> dao;

  EntityRepository(Class<T> entityClass, EntityDAO<T> entityDAO) {
    this.entityClass = entityClass;
    this.dao = entityDAO;
  }

  @Transaction
  public final ResultList<T> listAfter(Fields fields, String fqnPrefix, int limitParam, String after)
          throws GeneralSecurityException, IOException, ParseException {
    // forward scrolling, if after == null then first page is being asked
    List<String> jsons = dao.listAfter(fqnPrefix, limitParam + 1, after == null ? "" :
            CipherText.instance().decrypt(after));

    List<T> entities = new ArrayList<>();
    for (String json : jsons) {
      entities.add(setFields(JsonUtils.readValue(json, entityClass), fields));
    }
    int total = dao.listCount(fqnPrefix);

    String beforeCursor, afterCursor = null;
    beforeCursor = after == null ? null : getFullyQualifiedName(entities.get(0));
    if (entities.size() > limitParam) { // If extra result exists, then next page exists - return after cursor
      entities.remove(limitParam);
      afterCursor = getFullyQualifiedName(entities.get(limitParam - 1));
    }
    return getResultList(entities, beforeCursor, afterCursor, total);
  }

  @Transaction
  public final ResultList<T> listBefore(Fields fields, String fqnPrefix, int limitParam, String before) throws IOException, GeneralSecurityException, ParseException {
    // Reverse scrolling - Get one extra result used for computing before cursor
    List<String> jsons = dao.listBefore(fqnPrefix, limitParam + 1, CipherText.instance().decrypt(before));

    List<T> entities = new ArrayList<>();
    for (String json : jsons) {
      entities.add(setFields(JsonUtils.readValue(json, entityClass), fields));
    }
    int total = dao.listCount(fqnPrefix);

    String beforeCursor = null, afterCursor;
    if (entities.size() > limitParam) { // If extra result exists, then previous page exists - return before cursor
      entities.remove(0);
      beforeCursor = getFullyQualifiedName(entities.get(0));
    }
    afterCursor = getFullyQualifiedName(entities.get(entities.size() - 1));
    return getResultList(entities, beforeCursor, afterCursor, total);
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
