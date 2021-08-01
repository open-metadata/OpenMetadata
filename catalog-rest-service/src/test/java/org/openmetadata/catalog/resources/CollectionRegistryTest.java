package org.openmetadata.catalog.resources;

import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.type.CollectionDescriptor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertNotEquals;

public class CollectionRegistryTest {
  private static final Logger LOG = LoggerFactory.getLogger(CollectionRegistryTest.class);

  @Test
  public void testCollections() {
    CollectionRegistry.getInstance();
    Map<String, CollectionRegistry.CollectionDetails> descriptors = CollectionRegistry.getInstance().getCollectionMap();
    String path = "/v1";
    CollectionRegistry.CollectionDetails parent = descriptors.get(path);
    CollectionDescriptor[] children = parent.getChildCollections();
    assertNotEquals(0, children.length);

    path = "/v1/services";
    parent = descriptors.get(path);
    children = parent.getChildCollections();
    assertNotEquals(0, children.length);
  }
}
