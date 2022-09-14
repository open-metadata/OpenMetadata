package org.openmetadata.service;

import java.util.List;
import org.openmetadata.schema.type.Function;
import org.openmetadata.service.util.ResultList;

public class FunctionList extends ResultList<Function> {
  @SuppressWarnings("unused")
  public FunctionList() {}

  public FunctionList(List<Function> data) {
    super(data, null, null, data.size());
  }
}
