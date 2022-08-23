package org.openmetadata.catalog.jdbi3;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.type.Column;

public class TableRepositoryUnitTest {

  @Test
  void testWhenUpdatingAColumnDataLengthWhichWasNotSet_issue6868() throws JsonProcessingException {
    TableRepository outerObject = new TableRepository(mock(CollectionDAO.class));
    Table origTable = new Table().withFullyQualifiedName("service.db.table");
    TableRepository.TableUpdater tableUpdater =
        outerObject.new TableUpdater(origTable, new Table(), EntityRepository.Operation.PUT);
    Column origColumn = new Column().withFullyQualifiedName("service.db.table.column");
    Column newColumn = new Column().withFullyQualifiedName("service.db.table.column").withDataLength(100);
    tableUpdater.updateColumnDataLength(origColumn, newColumn);
    assertTrue(tableUpdater.majorVersionChange);
  }
}
