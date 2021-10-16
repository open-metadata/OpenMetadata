package org.openmetadata.catalog.jdbi3;

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
public interface EntityRepository<T> {
  /**
   * DAO related operations
   */
  List<String> listAfter(String fqnPrefix, int limitParam, String after);
  List<String> listBefore(String fqnPrefix, int limitParam, String before);
  int listCount(String fqnPrefix);


  /**
   * Entity related operations
   */
  String getFullyQualifiedName(T entity);
  T setFields(T entity, Fields fields) throws IOException, ParseException;

  ResultList<T> getResultList(List<T> entities, String beforeCursor, String afterCursor,
                              int total) throws GeneralSecurityException, UnsupportedEncodingException;
}
