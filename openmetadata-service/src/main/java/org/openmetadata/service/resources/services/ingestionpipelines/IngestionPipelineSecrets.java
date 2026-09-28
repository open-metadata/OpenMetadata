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

package org.openmetadata.service.resources.services.ingestionpipelines;

import jakarta.ws.rs.core.SecurityContext;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;

/**
 * Prepares an ingestion pipeline's secrets for a caller. Shared so that every code path which hands
 * a pipeline to the pipeline service client resolves secrets identically - a second implementation
 * would be free to drift from this one on the details that matter for security.
 */
public final class IngestionPipelineSecrets {

  private IngestionPipelineSecrets() {}

  /**
   * @param forceNotMask true for deploy/run operations, which need the bot's OpenMetadata
   *     connection. API responses pass false so the JWT token is never serialized back to a client.
   */
  public static void decryptOrNullify(
      Authorizer authorizer,
      SecurityContext securityContext,
      OpenMetadataApplicationConfig config,
      IngestionPipeline ingestionPipeline,
      boolean forceNotMask) {
    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
    try {
      authorizer.authorize(
          securityContext,
          new OperationContext(Entity.INGESTION_PIPELINE, MetadataOperation.VIEW_ALL),
          new ResourceContext<>(Entity.INGESTION_PIPELINE, ingestionPipeline.getId(), null));
    } catch (AuthorizationException e) {
      ingestionPipeline.getSourceConfig().setConfig(null);
    }
    secretsManager.decryptIngestionPipeline(ingestionPipeline);
    setOpenMetadataServerConnection(config, ingestionPipeline, forceNotMask, secretsManager);

    if (authorizer.shouldMaskPasswords(securityContext) && !forceNotMask) {
      EntityMaskerFactory.getEntityMasker().maskIngestionPipeline(ingestionPipeline);
    }
  }

  private static void setOpenMetadataServerConnection(
      OpenMetadataApplicationConfig config,
      IngestionPipeline ingestionPipeline,
      boolean forceNotMask,
      SecretsManager secretsManager) {
    if (!forceNotMask) {
      ingestionPipeline.setOpenMetadataServerConnection(null);
      return;
    }
    OpenMetadataConnection openMetadataServerConnection =
        new OpenMetadataConnectionBuilder(config, ingestionPipeline).build();
    ingestionPipeline.setOpenMetadataServerConnection(
        secretsManager.encryptOpenMetadataConnection(openMetadataServerConnection, false));
  }
}
