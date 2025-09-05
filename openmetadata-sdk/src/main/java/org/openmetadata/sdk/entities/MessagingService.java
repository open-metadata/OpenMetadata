package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class MessagingService extends org.openmetadata.schema.entity.services.MessagingService {

  public static MessagingService create(
      org.openmetadata.schema.entity.services.MessagingService entity)
      throws OpenMetadataException {
    return (MessagingService) OpenMetadata.client().messagingServices().create(entity);
  }

  public static MessagingService retrieve(String id) throws OpenMetadataException {
    return (MessagingService) OpenMetadata.client().messagingServices().get(id);
  }

  public static MessagingService retrieve(UUID id) throws OpenMetadataException {
    return retrieve(id.toString());
  }

  public static MessagingService retrieveByName(String name) throws OpenMetadataException {
    return (MessagingService) OpenMetadata.client().messagingServices().getByName(name);
  }

  public static MessagingService update(
      String id, org.openmetadata.schema.entity.services.MessagingService patch)
      throws OpenMetadataException {
    return (MessagingService) OpenMetadata.client().messagingServices().patch(id, patch);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete)
      throws OpenMetadataException {
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    OpenMetadata.client().messagingServices().delete(id, params);
  }

  public static ListResponse<org.openmetadata.schema.entity.services.MessagingService> list()
      throws OpenMetadataException {
    return OpenMetadata.client().messagingServices().list();
  }

  public static ListResponse<org.openmetadata.schema.entity.services.MessagingService> list(
      ListParams params) throws OpenMetadataException {
    return OpenMetadata.client().messagingServices().list(params);
  }
}
