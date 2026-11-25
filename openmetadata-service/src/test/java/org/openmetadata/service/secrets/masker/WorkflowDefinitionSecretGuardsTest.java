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

package org.openmetadata.service.secrets.masker;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;
import static org.openmetadata.service.secrets.masker.WorkflowDefinitionMaskerTest.GIT_NODE;
import static org.openmetadata.service.secrets.masker.WorkflowDefinitionMaskerTest.GIT_TOKEN;
import static org.openmetadata.service.secrets.masker.WorkflowDefinitionMaskerTest.SIGNING_PASSPHRASE;
import static org.openmetadata.service.secrets.masker.WorkflowDefinitionMaskerTest.STORED_CIPHERTEXT;
import static org.openmetadata.service.secrets.masker.WorkflowDefinitionMaskerTest.definitionWithSigningKey;
import static org.openmetadata.service.secrets.masker.WorkflowDefinitionMaskerTest.definitionWithSinks;
import static org.openmetadata.service.secrets.masker.WorkflowDefinitionMaskerTest.gitToken;
import static org.openmetadata.service.secrets.masker.WorkflowDefinitionMaskerTest.sinkNode;

import jakarta.json.Json;
import jakarta.json.JsonPatch;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;

class WorkflowDefinitionSecretGuardsTest {
  private static final String PASTED_CIPHERTEXT = "fernet:copiedFromAnotherWorkflow";
  private static final String ENCRYPTED_REJECTION = "encrypted values cannot be supplied";
  private static final String GIT_TOKEN_PATH = "/nodes/1/config/sinkConfig/credentials/token";
  private static final String SHORT_SECRET = "admin";

  @Test
  void aNewDefinitionSentWithTheMaskIsRejected() {
    WorkflowDefinition created = definitionWithSinks(PASSWORD_MASK);

    BadRequestException rejected =
        assertThrows(
            BadRequestException.class,
            () -> WorkflowDefinitionSecretGuards.requireNoMaskedSecrets(created));

    assertEquals(400, rejected.getResponse().getStatus());
    assertTrue(rejected.getMessage().contains("'%s'".formatted(GIT_NODE)), rejected.getMessage());
    assertTrue(rejected.getMessage().contains("/credentials/token"), rejected.getMessage());
  }

  @Test
  void aMaskOnARenamedNodeCannotBeRestoredAndIsRejected() {
    WorkflowDefinition stored = definitionWithSinks(GIT_TOKEN);
    WorkflowDefinition incoming = WorkflowDefinitionMasker.mask(stored);
    sinkNode(incoming, GIT_NODE).setName("renamedGitSink");

    WorkflowDefinitionMasker.restoreMaskedSecrets(stored, incoming);

    BadRequestException rejected =
        assertThrows(
            BadRequestException.class,
            () -> WorkflowDefinitionSecretGuards.requireNoMaskedSecrets(incoming));
    assertTrue(rejected.getMessage().contains("'renamedGitSink'"), rejected.getMessage());
  }

  @Test
  void aMaskRestoredFromTheStoredNodeIsAccepted() {
    WorkflowDefinition stored = definitionWithSinks(GIT_TOKEN);
    WorkflowDefinition incoming = WorkflowDefinitionMasker.mask(stored);

    WorkflowDefinitionMasker.restoreMaskedSecrets(stored, incoming);

    assertDoesNotThrow(() -> WorkflowDefinitionSecretGuards.requireNoMaskedSecrets(incoming));
    assertEquals(GIT_TOKEN, gitToken(incoming));
  }

  @Test
  void aSigningKeySentWithTheMaskForANewNodeIsRejected() {
    WorkflowDefinition created = definitionWithSigningKey(PASSWORD_MASK, SIGNING_PASSPHRASE);

    BadRequestException rejected =
        assertThrows(
            BadRequestException.class,
            () -> WorkflowDefinitionSecretGuards.requireNoMaskedSecrets(created));

    assertTrue(rejected.getMessage().contains("/signingKey/privateKey"), rejected.getMessage());
  }

  @Test
  void aNewDefinitionWithAnEncryptedSecretIsRejected() {
    WorkflowDefinition created = definitionWithSinks(PASTED_CIPHERTEXT);

    BadRequestException rejected =
        assertThrows(
            BadRequestException.class,
            () -> WorkflowDefinitionSecretGuards.requireNoEncryptedSecrets(created));

    assertEquals(400, rejected.getResponse().getStatus());
    assertTrue(rejected.getMessage().contains(ENCRYPTED_REJECTION), rejected.getMessage());
    assertTrue(rejected.getMessage().contains("'%s'".formatted(GIT_NODE)), rejected.getMessage());
    assertTrue(rejected.getMessage().contains("/credentials/token"), rejected.getMessage());
  }

  @Test
  void aNewDefinitionWithPlaintextSecretsAndSecretReferencesIsAccepted() {
    assertDoesNotThrow(
        () ->
            WorkflowDefinitionSecretGuards.requireNoEncryptedSecrets(
                definitionWithSinks(GIT_TOKEN)));
    assertDoesNotThrow(
        () ->
            WorkflowDefinitionSecretGuards.requireNoEncryptedSecrets(
                definitionWithSinks("secret:/workflows/git/token")));
  }

  @Test
  void theStoredCiphertextOfTheSameNodeIsAccepted() {
    WorkflowDefinition stored = definitionWithSinks(STORED_CIPHERTEXT);
    WorkflowDefinition maskedUpdate = WorkflowDefinitionMasker.mask(stored);
    WorkflowDefinitionMasker.restoreMaskedSecrets(stored, maskedUpdate);
    WorkflowDefinition unchangedCopy = definitionWithSinks(STORED_CIPHERTEXT);

    assertDoesNotThrow(
        () -> WorkflowDefinitionSecretGuards.requireStoredEncryptedSecrets(stored, maskedUpdate));
    assertDoesNotThrow(
        () -> WorkflowDefinitionSecretGuards.requireStoredEncryptedSecrets(stored, unchangedCopy));
  }

  @Test
  void ciphertextCopiedFromAnotherWorkflowIsRejected() {
    WorkflowDefinition stored = definitionWithSinks(STORED_CIPHERTEXT);
    WorkflowDefinition incoming = definitionWithSinks(PASTED_CIPHERTEXT);

    BadRequestException rejected =
        assertThrows(
            BadRequestException.class,
            () -> WorkflowDefinitionSecretGuards.requireStoredEncryptedSecrets(stored, incoming));

    assertTrue(rejected.getMessage().contains(ENCRYPTED_REJECTION), rejected.getMessage());
  }

  @Test
  void theStoredCiphertextUnderARenamedNodeIsRejected() {
    WorkflowDefinition stored = definitionWithSinks(STORED_CIPHERTEXT);
    WorkflowDefinition incoming = definitionWithSinks(STORED_CIPHERTEXT);
    sinkNode(incoming, GIT_NODE).setName("renamedGitSink");

    BadRequestException rejected =
        assertThrows(
            BadRequestException.class,
            () -> WorkflowDefinitionSecretGuards.requireStoredEncryptedSecrets(stored, incoming));

    assertTrue(rejected.getMessage().contains("'renamedGitSink'"), rejected.getMessage());
  }

  @Test
  void ciphertextAtTheSecretFieldOfAnotherSinkTypeIsRejected() {
    WorkflowDefinition stored = definitionWithSinks(GIT_TOKEN);
    WorkflowDefinition incoming = definitionWithSinks(GIT_TOKEN);
    sinkNode(incoming, GIT_NODE)
        .getConfig()
        .getSinkConfig()
        .setAdditionalProperty("authentication", Map.of("token", PASTED_CIPHERTEXT));

    BadRequestException rejected =
        assertThrows(
            BadRequestException.class,
            () -> WorkflowDefinitionSecretGuards.requireStoredEncryptedSecrets(stored, incoming));

    assertTrue(rejected.getMessage().contains("/authentication/token"), rejected.getMessage());
  }

  @Test
  void aPatchCopyingTheTokenToTheDescriptionIsRejected() {
    assertSecretOutsideItsFieldRejected(
        definitionWithSinks(STORED_CIPHERTEXT),
        Json.createPatchBuilder().copy("/description", GIT_TOKEN_PATH).build(),
        "'/description'");
  }

  @Test
  void aPatchMovingTheTokenToTheDescriptionIsRejected() {
    assertSecretOutsideItsFieldRejected(
        definitionWithSinks(STORED_CIPHERTEXT),
        Json.createPatchBuilder().move("/description", GIT_TOKEN_PATH).build(),
        "'/description'");
  }

  @Test
  void aPatchCopyingTheCredentialsObjectIntoTheSinkConfigIsRejected() {
    assertSecretOutsideItsFieldRejected(
        definitionWithSinks(STORED_CIPHERTEXT),
        Json.createPatchBuilder()
            .copy("/nodes/1/config/sinkConfig/backup", "/nodes/1/config/sinkConfig/credentials")
            .build(),
        "'/nodes/1/config/sinkConfig/backup/token'");
  }

  @Test
  void aPatchCopyingAShortPlaintextSecretIsRejected() {
    assertSecretOutsideItsFieldRejected(
        definitionWithSinks(SHORT_SECRET),
        Json.createPatchBuilder().copy("/description", GIT_TOKEN_PATH).build(),
        "'/description'");
  }

  @Test
  void aPatchCopyingANonSecretFieldOrAWholeSinkNodeIsAccepted() {
    WorkflowDefinition stored = definitionWithSinks(STORED_CIPHERTEXT);
    JsonPatch patch =
        Json.createPatchBuilder()
            .copy("/description", "/nodes/1/config/sinkConfig/repositoryUrl")
            .copy("/nodes/-", "/nodes/1")
            .build();
    WorkflowDefinition patched = applyPatch(stored, patch);

    assertDoesNotThrow(
        () ->
            WorkflowDefinitionSecretGuards.requireSecretsOnlyInSecretFields(
                stored, patched, patch));
    assertEquals("https://github.com/org/repo.git", patched.getDescription());
  }

  @Test
  void aSecretRecordedInAnEarlierChangeDescriptionDoesNotBlockACopyPatch() {
    WorkflowDefinition stored = definitionWithSinks(STORED_CIPHERTEXT);
    stored.setChangeDescription(
        new ChangeDescription()
            .withFieldsAdded(List.of())
            .withFieldsUpdated(
                List.of(new FieldChange().withName("description").withNewValue(STORED_CIPHERTEXT)))
            .withFieldsDeleted(List.of()));
    JsonPatch patch =
        Json.createPatchBuilder()
            .add("/description", "cleaned up")
            .copy("/displayName", "/name")
            .build();

    assertDoesNotThrow(
        () ->
            WorkflowDefinitionSecretGuards.requireSecretsOnlyInSecretFields(
                stored, applyPatch(stored, patch), patch));
  }

  /**
   * A short plaintext secret, stored before encryption at rest or without a Fernet key, also
   * appears in unrelated text such as the name of the user who last edited the definition.
   */
  @Test
  void aPatchWithoutCopyOrMoveIsAcceptedWhateverTheTextHolds() {
    WorkflowDefinition stored = definitionWithSinks(SHORT_SECRET).withUpdatedBy(SHORT_SECRET);
    JsonPatch patch =
        Json.createPatchBuilder()
            .replace("/description", "edited by %s".formatted(SHORT_SECRET))
            .build();

    assertDoesNotThrow(
        () ->
            WorkflowDefinitionSecretGuards.requireSecretsOnlyInSecretFields(
                stored, applyPatch(stored, patch), patch));
  }

  @Test
  void aCopyPatchIgnoresTheUpdatedByTheServerWritesAfterThePatch() {
    WorkflowDefinition stored = definitionWithSinks(SHORT_SECRET).withUpdatedBy(SHORT_SECRET);
    JsonPatch patch = Json.createPatchBuilder().copy("/displayName", "/name").build();

    assertDoesNotThrow(
        () ->
            WorkflowDefinitionSecretGuards.requireSecretsOnlyInSecretFields(
                stored, applyPatch(stored, patch), patch));
  }

  private static WorkflowDefinition applyPatch(WorkflowDefinition stored, JsonPatch patch) {
    return JsonUtils.applyPatch(stored, patch, WorkflowDefinition.class);
  }

  private static void assertSecretOutsideItsFieldRejected(
      WorkflowDefinition stored, JsonPatch patch, String location) {
    WorkflowDefinition patched = applyPatch(stored, patch);
    BadRequestException rejected =
        assertThrows(
            BadRequestException.class,
            () ->
                WorkflowDefinitionSecretGuards.requireSecretsOnlyInSecretFields(
                    stored, patched, patch));
    assertTrue(rejected.getMessage().contains(location), rejected.getMessage());
  }
}
