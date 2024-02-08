package org.openmetadata.service.migration.utils.v131;

import java.util.List;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;

public class MigrationUtil {

  private MigrationUtil() {
    /* Cannot create object  util class*/
  }

  public static void migrateCronExpression(Handle handle) {
    CollectionDAO daoCollection = Entity.getCollectionDAO();
    List<String> subscriptions =
        daoCollection
            .eventSubscriptionDAO()
            .listAllEventsSubscriptions(daoCollection.eventSubscriptionDAO().getTableName());
  }
}
