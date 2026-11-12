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

package org.openmetadata.service.alerting.channel;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.core.JsonPointer;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.rotation.Anchor;
import org.openmetadata.service.fernet.rotation.JsonDocument;
import org.openmetadata.service.secrets.SecretOwner;

class WebhookSecretAnchorsTest {
  private static final WebhookSecretAnchors ANCHORS = new WebhookSecretAnchors();
  private static final UUID DESTINATION = UUID.fromString("0f3b7d4e-2c1a-4b5e-9f6d-8a7c6b5d4e3f");
  private static final UUID HOLDER = UUID.fromString("7a1e2d3c-4b5a-4968-8776-655443322110");
  private static final String DESTINATION_JSON =
      "{\"id\":\""
          + DESTINATION
          + "\",\"category\":\"External\",\"type\":\"Webhook\",\"config\":{\"endpoint\":\"https://example.test/hook\",\"headers\":{\"X-Key\":\"fernet:bound:x\"},\"secretKey\":\"fernet:bound:y\"}}";
  private static final String PROFILE_JSON =
      "{\"subscription\":{\"slack\":{\"endpoint\":\"https://hooks.slack.test/T/B/x\",\"headers\":{\"Auth\":\"fernet:bound:z\"}}}}";

  @Test
  void anAlertRowAnchorsEachDestinationConfigToTheDestination() {
    String alert =
        "{\"id\":\"" + UUID.randomUUID() + "\",\"destinations\":[" + DESTINATION_JSON + "]}";

    List<Anchor> anchors = anchorsIn(alert);

    assertEquals(1, anchors.size());
    Anchor anchor = anchors.getFirst();
    assertEquals(SecretOwner.builder("alertdestination").id(DESTINATION).build(), anchor.owner());
    assertEquals(
        List.of(JsonPointer.compile("/endpoint"), JsonPointer.compile("/headers/X-Key")),
        anchor.fields());
    assertEquals("fernet:bound:x", anchor.config().at("/headers/X-Key").textValue());
  }

  @Test
  void aDestinationWithoutSecretFieldsAnchorsNothing() {
    String email =
        "{\"id\":\""
            + UUID.randomUUID()
            + "\",\"destinations\":[{\"id\":\""
            + DESTINATION
            + "\",\"category\":\"External\",\"type\":\"Email\",\"config\":{\"receivers\":[\"a@example.test\"]}}]}";

    assertEquals(List.of(), anchorsIn(email));
  }

  @Test
  void aDestinationListRecordedAsAStringIsAnchoredThroughTheNestedDocument() {
    String recorded = "[" + DESTINATION_JSON + "]";
    JsonDocument nested = new JsonDocument(JsonUtils.readTree(recorded), Optional.empty());

    List<Anchor> anchors = new ArrayList<>();
    ANCHORS.anchorsIn(nested, anchors::add);

    assertEquals(1, anchors.size());
    assertEquals(
        SecretOwner.builder("alertdestination").id(DESTINATION).build(),
        anchors.getFirst().owner());
  }

  @Test
  void aProfileWebhookIsAnchoredToTheUserAndToTheTeamWithTheDocumentsId() {
    String user = "{\"id\":\"" + HOLDER + "\",\"name\":\"ada\",\"profile\":" + PROFILE_JSON + "}";

    List<Anchor> anchors = anchorsIn(user);

    assertEquals(2, anchors.size());
    assertEquals(
        List.of(
            new ProfileWebhookSecrets.Holder("user", HOLDER).ownerOf("slack"),
            new ProfileWebhookSecrets.Holder("team", HOLDER).ownerOf("slack")),
        anchors.stream().map(Anchor::owner).toList());
    assertEquals(
        List.of(JsonPointer.compile("/endpoint"), JsonPointer.compile("/headers/Auth")),
        anchors.getFirst().fields());
    assertEquals(anchors.getFirst().fields(), anchors.getLast().fields());
  }

  @Test
  void aProfileRecordedInAChangeDescriptionUsesTheEnclosingDocumentsId() {
    JsonDocument recorded = new JsonDocument(JsonUtils.readTree(PROFILE_JSON), Optional.of(HOLDER));

    List<Anchor> anchors = new ArrayList<>();
    ANCHORS.anchorsIn(recorded, anchors::add);

    assertEquals(
        List.of(
            new ProfileWebhookSecrets.Holder("user", HOLDER).ownerOf("slack"),
            new ProfileWebhookSecrets.Holder("team", HOLDER).ownerOf("slack")),
        anchors.stream().map(Anchor::owner).toList());
  }

  @Test
  void aProfileWithoutAnyIdAnchorsNothing() {
    assertEquals(List.of(), anchorsIn(PROFILE_JSON));
  }

  @Test
  void aServiceJsonAndAnObjectThatIsNotADestinationAnchorNothing() {
    String service =
        "{\"id\":\""
            + UUID.randomUUID()
            + "\",\"name\":\"mysql\",\"connection\":{\"config\":{\"password\":\"fernet:gA\"}}}";
    String workflow =
        "{\"id\":\""
            + UUID.randomUUID()
            + "\",\"type\":\"eventBasedEntity\",\"name\":\"approval\",\"config\":{\"storeStageStatus\":true}}";

    assertEquals(List.of(), anchorsIn(service));
    assertEquals(List.of(), anchorsIn(workflow));
  }

  private static List<Anchor> anchorsIn(String json) {
    List<Anchor> anchors = new ArrayList<>();
    for (JsonDocument document : documentsOf(json)) {
      ANCHORS.anchorsIn(document, anchors::add);
    }
    return anchors;
  }

  // The root document with its own id, as the rotation builds it.
  private static List<JsonDocument> documentsOf(String json) {
    var root = JsonUtils.readTree(json);
    Optional<UUID> id =
        root.path("id").isTextual()
            ? Optional.of(UUID.fromString(root.path("id").textValue()))
            : Optional.empty();
    return List.of(new JsonDocument(root, id));
  }
}
