/*
 *  Copyright 2026 Collate
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

package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.events.CreateNotificationTemplate;
import org.openmetadata.schema.api.events.NotificationTemplateRenderRequest;
import org.openmetadata.schema.api.events.NotificationTemplateRenderResponse;
import org.openmetadata.schema.api.events.NotificationTemplateValidationRequest;
import org.openmetadata.schema.api.events.NotificationTemplateValidationResponse;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

/** Templates written by users are checked and rendered by the template sandbox on every path. */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class NotificationTemplateSandboxIT {

  private static final String VALIDATE_PATH = "/v1/notificationTemplates/validate";
  private static final String RENDER_PATH = "/v1/notificationTemplates/render";
  private static final String UNSUPPORTED_BODY = "<p>{{> fragment}}</p>";
  private static final String UNSUPPORTED_REASON = "Partials are not supported";

  @Test
  void createRefusesAnUnsupportedConstruct(TestNamespace ns) {
    assertBadRequest(
        () ->
            SdkClients.adminClient()
                .notificationTemplates()
                .create(request(ns.prefix("create"), UNSUPPORTED_BODY)));
  }

  @Test
  void putRefusesAnUnsupportedConstruct(TestNamespace ns) {
    assertBadRequest(
        () ->
            SdkClients.adminClient()
                .notificationTemplates()
                .createOrUpdate(request(ns.prefix("put"), UNSUPPORTED_BODY)));
  }

  @Test
  void patchRefusesAnUnsupportedConstruct(TestNamespace ns) throws Exception {
    NotificationTemplate template =
        SdkClients.adminClient()
            .notificationTemplates()
            .create(request(ns.prefix("patch"), "<p>{{entity.name}}</p>"));
    template.setTemplateBody("<p>{{log \"note\"}}</p>");

    assertBadRequest(
        () ->
            SdkClients.adminClient()
                .notificationTemplates()
                .update(template.getId().toString(), template));
  }

  @Test
  void validateExplainsAnUnsupportedConstruct() throws Exception {
    NotificationTemplateValidationResponse validation =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.POST,
                VALIDATE_PATH,
                new NotificationTemplateValidationRequest()
                    .withTemplateSubject("A subject")
                    .withTemplateBody(UNSUPPORTED_BODY),
                NotificationTemplateValidationResponse.class);

    assertFalse(validation.getIsValid());
    assertTrue(validation.getBodyError().contains(UNSUPPORTED_REASON), validation.getBodyError());
  }

  @Test
  void renderExplainsAnUnsupportedConstruct() throws Exception {
    NotificationTemplateRenderResponse response = render(UNSUPPORTED_BODY);

    assertFalse(response.getValidation().getIsValid());
    assertTrue(response.getValidation().getBodyError().contains(UNSUPPORTED_REASON));
    assertNull(response.getRender());
  }

  @Test
  void renderReadsTemplateDataOnly() throws Exception {
    NotificationTemplateRenderResponse response =
        render("<p>name:{{entity.name}} start{{entity.size}}{{entity.name.length}}end</p>");

    assertTrue(response.getValidation().getIsValid());
    String body = response.getRender().getBody();
    assertTrue(body.contains("name:sample_table"), body);
    assertTrue(body.contains("startend"), body);
  }

  private static NotificationTemplateRenderResponse render(String body) throws Exception {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            RENDER_PATH,
            new NotificationTemplateRenderRequest()
                .withTemplateSubject("A subject")
                .withTemplateBody(body)
                .withResource(Entity.TABLE),
            NotificationTemplateRenderResponse.class);
  }

  private static CreateNotificationTemplate request(String name, String body) {
    return new CreateNotificationTemplate()
        .withName(name)
        .withTemplateSubject("A subject")
        .withTemplateBody(body);
  }

  private interface ThrowingRequest {
    void run() throws Exception;
  }

  private static void assertBadRequest(ThrowingRequest request) {
    OpenMetadataException rejected = assertThrows(OpenMetadataException.class, request::run);
    int status =
        rejected.getCause() instanceof InvalidRequestException cause
            ? cause.getStatusCode()
            : rejected.getStatusCode();
    assertEquals(400, status, rejected.getMessage());
  }
}
