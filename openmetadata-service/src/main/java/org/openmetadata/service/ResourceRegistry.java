package org.openmetadata.service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import org.openmetadata.schema.type.ResourceDescriptor;
import org.openmetadata.service.exception.CatalogExceptionMessage;

public class ResourceRegistry {
  private static final List<ResourceDescriptor> RESOURCE_DESCRIPTORS = new ArrayList<>();

  private ResourceRegistry() {}

  public static void add(List<ResourceDescriptor> resourceDescriptors) {
    RESOURCE_DESCRIPTORS.addAll(resourceDescriptors);
    RESOURCE_DESCRIPTORS.sort(Comparator.comparing(ResourceDescriptor::getName));
  }

  public static List<ResourceDescriptor> listResourceDescriptors() {
    return Collections.unmodifiableList(RESOURCE_DESCRIPTORS);
  }

  public static ResourceDescriptor getResourceDescriptor(String resourceType) {
    ResourceDescriptor rd =
        RESOURCE_DESCRIPTORS.stream().filter(r -> r.getName().equalsIgnoreCase(resourceType)).findAny().orElse(null);
    if (rd == null) {
      throw new IllegalArgumentException(CatalogExceptionMessage.resourceTypeNotFound(resourceType));
    }
    return rd;
  }
}
