package org.openmetadata.catalog.dropwizard.metrics;

import java.util.HashMap;
import java.util.Map;
import software.amazon.awssdk.services.cloudwatch.model.Dimension;

public class DimensionedNameBuilder {
  private final String name;
  private Map<String, Dimension> dimensions;

  DimensionedNameBuilder(final String name) {
    this(name, new HashMap<>());
  }

  DimensionedNameBuilder(final String name, final Map<String, Dimension> dimensions) {
    this.name = name;
    this.dimensions = dimensions;
  }

  public DimensionedName build() {
    return new DimensionedName(this.name, this.dimensions);
  }

  public DimensionedNameBuilder withDimension(final String name, final String value) {
    this.dimensions.put(name, Dimension.builder().name(name).value(value).build());
    return this;
  }
}
