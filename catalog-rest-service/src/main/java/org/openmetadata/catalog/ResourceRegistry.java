package org.openmetadata.catalog;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import org.openmetadata.catalog.type.ResourceDescriptor;

public class ResourceRegistry {
  private static final ResourceRegistry registry = new ResourceRegistry();
  private static final List<ResourceDescriptor> RESOURCE_DESCRIPTORS = new ArrayList<>();

  private ResourceRegistry() {}

  public static void add(List<ResourceDescriptor> resourceDescriptors) {
    RESOURCE_DESCRIPTORS.addAll(resourceDescriptors);
    RESOURCE_DESCRIPTORS.sort(Comparator.comparing(ResourceDescriptor::getName));
  }

  public static List<ResourceDescriptor> listResourceDescriptors() {
    return Collections.unmodifiableList(RESOURCE_DESCRIPTORS);
  }
}
