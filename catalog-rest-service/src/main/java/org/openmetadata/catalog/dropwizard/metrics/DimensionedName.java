package org.openmetadata.catalog.dropwizard.metrics;

import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import software.amazon.awssdk.services.cloudwatch.model.Dimension;

public class DimensionedName {
  private static final Pattern dimensionPattern = Pattern.compile("([\\w.-]+)\\[([\\w\\W]+)]");
  private final String name;
  private final Map<String, Dimension> dimensions;

  private String encoded;

  DimensionedName(final String name, final Map<String, Dimension> dimensions) {
    this.name = name;
    this.dimensions = Collections.unmodifiableMap(dimensions);
  }

  public static DimensionedName decode(final String encodedDimensionedName) {
    final Matcher matcher = dimensionPattern.matcher(encodedDimensionedName);
    if (matcher.find() && matcher.groupCount() == 2) {
      final DimensionedNameBuilder builder = new DimensionedNameBuilder(matcher.group(1).trim());
      for (String t : matcher.group(2).split(",")) {
        final String[] keyAndValue = t.split(":");
        builder.withDimension(keyAndValue[0].trim(), keyAndValue[1].trim());
      }
      return builder.build();
    } else {
      return new DimensionedNameBuilder(encodedDimensionedName).build();
    }
  }

  public static DimensionedNameBuilder withName(String name) {
    return new DimensionedNameBuilder(name);
  }

  public DimensionedNameBuilder withDimension(final String name, final String value) {
    return new DimensionedNameBuilder(this.name, new HashMap<>(this.dimensions)).withDimension(name, value);
  }

  public String getName() {
    return name;
  }

  public Set<Dimension> getDimensions() {
    return new HashSet<>(dimensions.values());
  }

  public synchronized String encode() {
    if (this.encoded == null) {
      if (!dimensions.isEmpty()) {
        final StringBuilder sb = new StringBuilder(this.name);
        sb.append('[');
        sb.append(
            this.dimensions.values().stream()
                .map(dimension -> dimension.name() + ":" + dimension.value())
                .collect(Collectors.joining(",")));
        sb.append(']');

        this.encoded = sb.toString();
      } else {
        this.encoded = this.name;
      }
    }
    return this.encoded;
  }

  @Override
  public String toString() {
    return this.encode();
  }

  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (o == null || getClass() != o.getClass()) {
      return false;
    }
    final DimensionedName that = (DimensionedName) o;
    return Objects.equals(name, that.name) && Objects.equals(dimensions, that.dimensions);
  }

  @Override
  public int hashCode() {
    return Objects.hash(name, dimensions);
  }
}
