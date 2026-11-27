package org.openmetadata.service.alerting.content.template.sandbox;

import com.github.jknack.handlebars.ValueResolver;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Resolves {@code list.length}, the one property a list has besides its items. */
final class ListLengthResolver implements ValueResolver {

  static final ValueResolver INSTANCE = new ListLengthResolver();

  private static final String LENGTH = "length";

  private ListLengthResolver() {}

  @Override
  public Object resolve(Object context, String name) {
    return context instanceof List<?> list && LENGTH.equals(name) ? list.size() : UNRESOLVED;
  }

  @Override
  public Object resolve(Object context) {
    return UNRESOLVED;
  }

  @Override
  public Set<Map.Entry<String, Object>> propertySet(Object context) {
    return Set.of();
  }
}
