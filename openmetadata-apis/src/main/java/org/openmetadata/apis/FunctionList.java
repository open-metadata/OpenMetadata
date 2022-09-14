package org.openmetadata.apis;

import java.util.List;
import org.openmetadata.apis.util.ResultList;
import org.openmetadata.schema.type.Function;

public class FunctionList extends ResultList<Function> {
  @SuppressWarnings("unused")
  public FunctionList() {}

  public FunctionList(List<Function> data) {
    super(data, null, null, data.size());
  }
}
