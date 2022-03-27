/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.util;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.lang.reflect.Field;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.text.DateFormat;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.TimeZone;
import java.util.UUID;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.ResponseBuilder;
import javax.ws.rs.core.Response.Status;
import javax.ws.rs.core.UriInfo;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.common.utils.CommonUtil;
import org.reflections.ReflectionUtils;

public final class RestUtil {
  public static final String CHANGE_CUSTOM_HEADER = "X-OpenMetadata-Change";
  public static final String ENTITY_CREATED = "entityCreated";
  public static final String ENTITY_UPDATED = "entityUpdated";
  public static final String ENTITY_FIELDS_CHANGED = "entityFieldsChanged";
  public static final String ENTITY_NO_CHANGE = "entityNoChange";
  public static final String ENTITY_SOFT_DELETED = "entitySoftDeleted";
  public static final String ENTITY_DELETED = "entityDeleted";
  public static final String SIGNATURE_HEADER = "X-OM-Signature";

  public static final DateFormat DATE_TIME_FORMAT;
  public static final DateFormat DATE_FORMAT;

  static {
    // Quoted "Z" to indicate UTC, no timezone offset
    DATE_TIME_FORMAT = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSSSS'Z'");
    DATE_TIME_FORMAT.setTimeZone(TimeZone.getTimeZone("UTC"));

    DATE_FORMAT = new SimpleDateFormat("yyyy-MM-dd");
    DATE_FORMAT.setTimeZone(TimeZone.getTimeZone("UTC"));
  }

  private RestUtil() {}

  /** Remove leading and trailing slashes */
  public static String removeSlashes(String s) {
    s = s.startsWith("/") ? s.substring(1) : s;
    s = s.endsWith("/") ? s.substring(0, s.length() - 1) : s;
    return s;
  }

  public static URI getHref(UriInfo uriInfo, String collectionPath, UUID id) {
    collectionPath = removeSlashes(collectionPath);
    try {
      String uriPath = uriInfo.getBaseUri() + collectionPath + "/" + id;
      return URI.create(uriPath);
    } catch (Exception e) {
      throw new IllegalArgumentException(e);
    }
  }

  public static URI getHref(UriInfo uriInfo, String collectionPath) {
    collectionPath = removeSlashes(collectionPath);
    String uriPath = uriInfo.getBaseUri() + collectionPath;
    return URI.create(uriPath);
  }

  public static URI getHref(UriInfo uriInfo, String collectionPath, String resourcePath) {
    collectionPath = removeSlashes(collectionPath);
    resourcePath = removeSlashes(resourcePath);
    try {
      String uriPath = uriInfo.getBaseUri() + collectionPath + "/" + resourcePath;
      return URI.create(uriPath);
    } catch (Exception e) {
      throw new IllegalArgumentException(e);
    }
  }

  public static URI getHref(URI parent, String child) {
    return URI.create(parent.toString() + "/" + child);
  }

  /** Get list of attributes for an entity based on JsonProperty annotation */
  public static <T> List<String> getAttributes(Class<T> clz) {
    List<String> attributes = new ArrayList<>();
    for (Field field : ReflectionUtils.getFields(clz, ReflectionUtils.withAnnotation(JsonProperty.class))) {
      // Attributes are fields that are not of entity type
      if (!field.getType().getName().contains(".entity.")) {
        attributes.add(field.getName());
      }
    }
    return attributes;
  }

  /** Get list of relationships for an entity based on JsonProperty annotation */
  public static <T> List<String> getRelationships(Class<T> clz) {
    List<String> relationships = new ArrayList<>();
    for (Field field : ReflectionUtils.getFields(clz, ReflectionUtils.withAnnotation(JsonProperty.class))) {
      // Relationships are fields that are of entity type
      if (field.getType().getName().contains(".entity.")) {
        relationships.add(field.getName());
      }
    }
    return relationships;
  }

  public static int compareDates(String date1, String date2) throws ParseException {
    return DATE_FORMAT.parse(date1).compareTo(DATE_FORMAT.parse(date2));
  }

  public static String today(int offsetDays) throws ParseException {
    Date date = CommonUtil.getDateByOffset(new Date(), offsetDays);
    return DATE_FORMAT.format(date);
  }

  public static void validateCursors(String before, String after) {
    if (before != null && after != null) {
      throw new IllegalArgumentException("Only one of before or after query parameter allowed");
    }
  }

  public static String encodeCursor(String cursor) {
    return cursor == null ? null : Base64.getUrlEncoder().encodeToString(cursor.getBytes(StandardCharsets.UTF_8));
  }

  public static String decodeCursor(String cursor) {
    return cursor == null ? null : new String(Base64.getUrlDecoder().decode(cursor));
  }

  public static class PutResponse<T> {
    private T entity;
    private ChangeEvent changeEvent;
    private final Response.Status status;
    private final String changeType;

    /**
     * Response.Status.CREATED when PUT operation creates a new entity or Response.Status.OK when PUT operation updates
     * a new entity
     */
    public PutResponse(Response.Status status, T entity, String changeType) {
      this.entity = entity;
      this.status = status;
      this.changeType = changeType;
    }

    /** When PUT response updates an entity */
    public PutResponse(Response.Status status, ChangeEvent changeEvent, String changeType) {
      this.changeEvent = changeEvent;
      this.status = status;
      this.changeType = changeType;
    }

    public T getEntity() {
      return entity;
    }

    public Response toResponse() {
      ResponseBuilder responseBuilder = Response.status(status).header(CHANGE_CUSTOM_HEADER, changeType);
      if (changeType.equals(RestUtil.ENTITY_CREATED)
          || changeType.equals(RestUtil.ENTITY_UPDATED)
          || changeType.equals(RestUtil.ENTITY_NO_CHANGE)) {
        return responseBuilder.entity(entity).build();
      } else {
        return responseBuilder.entity(changeEvent).build();
      }
    }
  }

  public static class PatchResponse<T> {
    private final T entity;
    private final Response.Status status;
    private final String changeType;

    /**
     * Response.Status.CREATED when PUT operation creates a new entity or Response.Status.OK when PUT operation updates
     * a new entity
     */
    public PatchResponse(Response.Status status, T entity, String changeType) {
      this.entity = entity;
      this.status = status;
      this.changeType = changeType;
    }

    public T getEntity() {
      return entity;
    }

    public Response toResponse() {
      return Response.status(status).header(CHANGE_CUSTOM_HEADER, changeType).entity(entity).build();
    }
  }

  public static class DeleteResponse<T> {
    private final T entity;
    private final String changeType;

    public DeleteResponse(T entity, String changeType) {
      this.entity = entity;
      this.changeType = changeType;
    }

    public T getEntity() {
      return entity;
    }

    public Response toResponse() {
      ResponseBuilder responseBuilder = Response.status(Status.OK).header(CHANGE_CUSTOM_HEADER, changeType);
      return responseBuilder.entity(entity).build();
    }
  }
}
