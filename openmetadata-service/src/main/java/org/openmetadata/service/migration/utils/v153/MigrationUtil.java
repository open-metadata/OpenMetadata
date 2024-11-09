package org.openmetadata.service.migration.utils.v153;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.CollectionDAO;

@Slf4j
public class MigrationUtil {

  public static void updateEmailTemplates(CollectionDAO collectionDAO) {
    CollectionDAO.DocStoreDAO dao = collectionDAO.docStoreDAO();
    // delete emailTemplates, it will be loaded from initSeedData.
    dao.deleteEmailTemplates();
  }
}
