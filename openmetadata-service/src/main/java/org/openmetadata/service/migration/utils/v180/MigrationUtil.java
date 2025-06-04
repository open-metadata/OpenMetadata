package org.openmetadata.service.migration.utils.v180;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.jdbi3.CollectionDAO;

import java.util.List;

import static org.openmetadata.service.migration.utils.v160.MigrationUtil.addOperationsToPolicyRule;

@Slf4j
public class MigrationUtil {

  public static void addCertificationOperationsToPolicy(CollectionDAO collectionDAO) {

    addOperationsToPolicyRule(
        "DataConsumerPolicy",
        "DataConsumerPolicy-EditRule",
        List.of(MetadataOperation.EDIT_CERTIFICATION),
        collectionDAO);

    addOperationsToPolicyRule(
        "DataStewardPolicy",
        "DataStewardPolicy-EditRule",
        List.of(MetadataOperation.EDIT_CERTIFICATION),
        collectionDAO);
  }
}
