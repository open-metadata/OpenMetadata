package org.openmetadata.service.jdbi3;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import org.openmetadata.schema.type.Include;

@Getter
public abstract class Filter<T extends Filter<T>> {
  protected Include include;
  protected final Map<String, String> queryParams = new HashMap<>();

  public T addQueryParam(String name, String value) {
    queryParams.put(name, value);
    return (T) this;
  }

  public T addQueryParam(String name, Boolean value) {
    queryParams.put(name, String.valueOf(value));
    return (T) this;
  }

  public void removeQueryParam(String name) {
    queryParams.remove(name);
  }

  public String getQueryParam(String name) {
    return name.equals("include") ? include.value() : queryParams.get(name);
  }

  public String getCondition() {
    return getCondition(null);
  }

  public abstract String getCondition(String alias);

  protected abstract String addCondition(List<String> conditions);
}
