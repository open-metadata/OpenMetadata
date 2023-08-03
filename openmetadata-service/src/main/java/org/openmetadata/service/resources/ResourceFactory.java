package org.openmetadata.service.resources;

import java.lang.reflect.Field;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class ResourceFactory {
  private static Object getResourceByCollectionPath(String collectionPath) {
    if (!collectionPath.startsWith("/")) {
      collectionPath = "/" + collectionPath;
    }

    if (collectionPath.endsWith("/")) {
      collectionPath = collectionPath.substring(0, collectionPath.length() - 1);
    }

    return CollectionRegistry.getInstance().getCollectionMap().get(collectionPath).getResource();
  }

  public static <T extends EntityResource<?, ?>> T getResource(Class<?> clz) {
    try {
      Field field = clz.getDeclaredField("COLLECTION_PATH");
      field.setAccessible(true);
      Object value = field.get(null);
      return (T) getResourceByCollectionPath((String) value);
    } catch (NoSuchFieldException | IllegalAccessException e) {
      LOG.error("Unable to fetch resource class.");
      return null;
    }
  }
}
