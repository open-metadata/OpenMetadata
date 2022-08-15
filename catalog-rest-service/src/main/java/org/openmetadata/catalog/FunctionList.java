package org.openmetadata.catalog;

import java.util.List;
import org.openmetadata.catalog.type.Function;
import org.openmetadata.catalog.util.ResultList;

public class FunctionList extends ResultList<Function> {
  @SuppressWarnings("unused")
  public FunctionList() {}

  public FunctionList(List<Function> data) {
    super(data, null, null, data.size());
  }
}
