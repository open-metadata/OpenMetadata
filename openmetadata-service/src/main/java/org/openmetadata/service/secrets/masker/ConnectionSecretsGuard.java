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

import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.core.SecurityContext;
import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsUtil;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.IngestionPipelineBuilder;

/**
 * Stored connection secrets stay with the endpoint they were entered for. A caller who only ever
 * sees a connection's secrets masked may change its other settings, but once those settings point
 * the connection somewhere else its secrets must be entered again: restoring the stored ones would
 * hand them to whatever the connection now points at.
 *
 * <p>Both connections are masked, which turns every secret into the same placeholder; whatever
 * still differs is a setting that is not secret. Any such change other than an ingestion filter, a
 * capability flag or a description is treated as redirecting the connection, so a connector-specific
 * target field the guard does not recognise fails closed rather than silently restoring the secret.
 * A secret counts as kept when it arrives masked, as the stored value, or as any encoded value.
 * ADR:2026-10-24-a-masked-connection-secret-is-kept-only-while-the-endpoint-is-unchanged
 */
public final class ConnectionSecretsGuard {
  public static final String SECRETS_REQUIRED =
      "The connection now points somewhere else, so enter its secrets again.";

  private ConnectionSecretsGuard() {}

  public static void requireSecretsReenteredOnRetarget(
      Object incomingConfig, Object storedConfig, String connectionType, ServiceType serviceType) {
    if (incomingConfig == null || storedConfig == null) {
      return;
    }
    JsonNode incoming;
    JsonNode stored;
    JsonNode maskedIncoming;
    JsonNode maskedStored;
    try {
      incoming = converted(incomingConfig, connectionType, serviceType);
      stored = converted(storedConfig, connectionType, serviceType);
      maskedIncoming = masked(incomingConfig, connectionType, serviceType);
      maskedStored = masked(storedConfig, connectionType, serviceType);
    } catch (RuntimeException e) {
      // A connection that cannot be read fails where it is unmasked and saved, restoring nothing.
      return;
    }
    if (retargetsWithStoredSecret(incoming, stored, maskedIncoming, maskedStored)) {
      throw new BadRequestException(SECRETS_REQUIRED);
    }
  }

  /**
   * The same guard for an ingestion pipeline, whose secrets live in the source it reads from: a dbt
   * project or a storage manifest. Only that source is compared, so a change to the pipeline's
   * other settings never asks for the secrets again.
   */
  public static void requireSecretsReenteredOnRetarget(
      IngestionPipeline incoming, IngestionPipeline stored) {
    if (hasSourceConfig(incoming)
        && hasSourceConfig(stored)
        && PipelineSources.read(incoming, stored).retargetsAStoredSecret()) {
      throw new BadRequestException(SECRETS_REQUIRED);
    }
  }

  private static boolean hasSourceConfig(IngestionPipeline pipeline) {
    return pipeline != null && pipeline.getSourceConfig() != null;
  }

  /** Both pipelines' source configs, as stored and as masked; empty when one cannot be read. */
  private record PipelineSources(
      JsonNode incoming, JsonNode stored, JsonNode maskedIncoming, JsonNode maskedStored) {
    private static final PipelineSources UNREADABLE = new PipelineSources(null, null, null, null);

    static PipelineSources read(IngestionPipeline incoming, IngestionPipeline stored) {
      try {
        return new PipelineSources(
            pipelineSourceConfig(incoming, false),
            pipelineSourceConfig(stored, false),
            pipelineSourceConfig(incoming, true),
            pipelineSourceConfig(stored, true));
      } catch (RuntimeException e) {
        // A config that cannot be read fails where it is unmasked and saved, restoring nothing.
        return UNREADABLE;
      }
    }

    boolean retargetsAStoredSecret() {
      return this != UNREADABLE
          && PIPELINE_SECRET_SOURCES.stream()
              .anyMatch(
                  source ->
                      retargetsWithStoredSecret(
                          incoming.path(source),
                          stored.path(source),
                          maskedIncoming.path(source),
                          maskedStored.path(source)));
    }
  }

  /** Admins and bots may already read or replace any stored secret, so the guard skips them. */
  public static boolean readsStoredSecrets(SecurityContext securityContext) {
    SubjectContext subject = DefaultAuthorizer.getSubjectContext(securityContext);
    return subject.isAdmin() || subject.isBot();
  }

  private static final List<String> PIPELINE_SECRET_SOURCES =
      List.of("dbtConfigSource", "storageMetadataConfigSource");

  private static boolean retargetsWithStoredSecret(
      JsonNode incoming, JsonNode stored, JsonNode maskedIncoming, JsonNode maskedStored) {
    return nonExemptFieldChanged(maskedIncoming, maskedStored)
        && keepsStoredSecret(maskedIncoming, incoming, stored);
  }

  private static JsonNode pipelineSourceConfig(IngestionPipeline pipeline, boolean masked) {
    IngestionPipeline copy = JsonUtils.deepCopy(pipeline, IngestionPipeline.class);
    copy.setOpenMetadataServerConnection(null);
    if (masked) {
      EntityMaskerFactory.getEntityMasker().maskIngestionPipeline(copy);
    } else {
      IngestionPipelineBuilder.addDefinedConfig(copy);
    }
    return JsonUtils.valueToTree(copy.getSourceConfig().getConfig());
  }

  // Fields that cannot change where a connection points, so a change to one must not force the
  // secret to be re-entered: ingestion filter patterns (names ending "filterPattern"), capability
  // flags (names starting "supports") and free-text descriptions. Every other field is assumed able
  // to redirect the connection. Matching known-safe fields rather than known-endpoint ones fails
  // closed: a connector-specific target the list does not name (an Oracle TNS descriptor, a host in
  // connectionArguments, Domo's instanceDomain) is still treated as a redirect, not silently kept.
  private static final Set<String> EXEMPT_FIELD_SUFFIXES = Set.of("filterpattern", "description");

  private static boolean isExemptField(String key) {
    String lower = key.toLowerCase(Locale.ROOT);
    return lower.startsWith("supports") || EXEMPT_FIELD_SUFFIXES.stream().anyMatch(lower::endsWith);
  }

  /**
   * Whether any field other than a known-safe one differs between the two masked configs, in either
   * direction. A key or array entry the incoming config drops counts as much as one it adds:
   * removing an override such as a host in {@code connectionArguments} moves the connection too.
   */
  private static boolean nonExemptFieldChanged(JsonNode incoming, JsonNode stored) {
    if (incoming.isObject() || stored.isObject()) {
      Set<String> names = new LinkedHashSet<>();
      incoming.fieldNames().forEachRemaining(names::add);
      stored.fieldNames().forEachRemaining(names::add);
      for (String name : names) {
        if (!isExemptField(name) && nonExemptFieldChanged(incoming.path(name), stored.path(name))) {
          return true;
        }
      }
      return false;
    }
    if (incoming.isArray() || stored.isArray()) {
      for (int i = 0; i < Math.max(incoming.size(), stored.size()); i++) {
        if (nonExemptFieldChanged(incoming.path(i), stored.path(i))) {
          return true;
        }
      }
      return false;
    }
    return !incoming.equals(stored);
  }

  private static boolean keepsStoredSecret(JsonNode masked, JsonNode incoming, JsonNode stored) {
    if (masked.isObject()) {
      for (Iterator<Map.Entry<String, JsonNode>> fields = masked.fields(); fields.hasNext(); ) {
        Map.Entry<String, JsonNode> field = fields.next();
        if (keepsStoredSecret(
            field.getValue(), incoming.path(field.getKey()), stored.path(field.getKey()))) {
          return true;
        }
      }
      return false;
    }
    if (masked.isArray()) {
      for (int i = 0; i < masked.size(); i++) {
        if (keepsStoredSecret(masked.get(i), incoming.path(i), stored.path(i))) {
          return true;
        }
      }
      return false;
    }
    if (!PASSWORD_MASK.equals(masked.asText())) {
      return false;
    }
    String value = incoming.asText();
    return PASSWORD_MASK.equals(value)
        || Fernet.isTokenized(value)
        || value.startsWith(SecretsManager.SECRET_FIELD_PREFIX)
        || (!stored.isMissingNode() && value.equals(stored.asText()));
  }

  private static JsonNode converted(Object config, String connectionType, ServiceType serviceType) {
    return JsonUtils.valueToTree(
        SecretsUtil.convert(copyOf(config), connectionType, null, serviceType));
  }

  private static JsonNode masked(Object config, String connectionType, ServiceType serviceType) {
    return JsonUtils.valueToTree(
        EntityMaskerFactory.getEntityMasker()
            .maskServiceConnectionConfig(copyOf(config), connectionType, serviceType));
  }

  /** Masking and conversion may work on the object they are given, so they get a copy. */
  private static Object copyOf(Object config) {
    return JsonUtils.readValue(JsonUtils.pojoToJson(config), Object.class);
  }
}
