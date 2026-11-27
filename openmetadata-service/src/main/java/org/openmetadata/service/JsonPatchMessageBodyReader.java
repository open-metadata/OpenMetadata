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

package org.openmetadata.service;

import jakarta.json.JsonPatch;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.MessageBodyReader;
import jakarta.ws.rs.ext.Provider;
import java.io.InputStream;
import java.lang.annotation.Annotation;
import java.lang.reflect.Type;
import org.openmetadata.service.util.BoundedJsonPatch;

@Provider
@Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
public class JsonPatchMessageBodyReader implements MessageBodyReader<JsonPatch> {

  @Override
  public boolean isReadable(
      Class<?> type, Type genericType, Annotation[] annotations, MediaType mediaType) {
    return JsonPatch.class.isAssignableFrom(type);
  }

  @Override
  public JsonPatch readFrom(
      Class<JsonPatch> type,
      Type genericType,
      Annotation[] annotations,
      MediaType mediaType,
      MultivaluedMap<String, String> httpHeaders,
      InputStream entityStream)
      throws WebApplicationException {
    try {
      return BoundedJsonPatch.read(entityStream);
    } catch (BoundedJsonPatch.PatchTooLargeException e) {
      throw new ClientErrorException(e.getMessage(), Response.Status.REQUEST_ENTITY_TOO_LARGE);
    } catch (BoundedJsonPatch.InvalidPatchException e) {
      throw new BadRequestException(e.getMessage());
    }
  }
}
