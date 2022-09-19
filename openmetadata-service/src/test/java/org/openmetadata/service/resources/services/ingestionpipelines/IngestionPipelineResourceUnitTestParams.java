/*
 *  Copyright 2022 Collate
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

import java.util.LinkedHashMap;
import java.util.stream.Stream;
import org.junit.jupiter.params.provider.Arguments;
import org.openmetadata.schema.api.services.CreateDashboardService;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.CreateMessagingService;
import org.openmetadata.schema.api.services.CreateMlModelService;
import org.openmetadata.schema.api.services.CreatePipelineService;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.DashboardServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceProfilerPipeline;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceQueryLineagePipeline;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceQueryUsagePipeline;
import org.openmetadata.schema.metadataIngestion.MessagingServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.MlmodelServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.PipelineServiceMetadataPipeline;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

public class IngestionPipelineResourceUnitTestParams {

  public static final EntityReference DATABASE_SERVICE_ENTITY =
      new DatabaseService()
          .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
          .getEntityReference()
          .withType(Entity.DATABASE_SERVICE)
          .withName("Database-service");

  public static final EntityReference PIPELINE_SERVICE_ENTITY =
      new PipelineService()
          .withServiceType(CreatePipelineService.PipelineServiceType.Airbyte)
          .getEntityReference()
          .withType(Entity.PIPELINE_SERVICE)
          .withName("Pipeline-service");

  public static final EntityReference MESSAGING_SERVICE_ENTITY =
      new MessagingService()
          .withServiceType(CreateMessagingService.MessagingServiceType.Kafka)
          .getEntityReference()
          .withType(Entity.MESSAGING_SERVICE)
          .withName("Messaging-service");

  public static final EntityReference DASHBOARD_SERVICE_ENTITY =
      new DashboardService()
          .withServiceType(CreateDashboardService.DashboardServiceType.Looker)
          .getEntityReference()
          .withType(Entity.DASHBOARD_SERVICE)
          .withName("Dashboard-service");

  public static final EntityReference MLMODEL_SERVICE_ENTITY =
      new MlModelService()
          .withServiceType(CreateMlModelService.MlModelServiceType.Mlflow)
          .getEntityReference()
          .withType(Entity.MLMODEL_SERVICE)
          .withName("Mlmodel-service");

  public static Stream<Arguments> params() {
    return Stream.of(
        Arguments.of(
            new DatabaseServiceMetadataPipeline().withDbtConfigSource(new LinkedHashMap<>()),
            DATABASE_SERVICE_ENTITY,
            DatabaseService.class,
            PipelineType.METADATA,
            true),
        Arguments.of(
            new DatabaseServiceQueryUsagePipeline(),
            DATABASE_SERVICE_ENTITY,
            DatabaseService.class,
            PipelineType.USAGE,
            false),
        Arguments.of(
            new DatabaseServiceQueryLineagePipeline(),
            DATABASE_SERVICE_ENTITY,
            DatabaseService.class,
            PipelineType.LINEAGE,
            false),
        Arguments.of(
            new DashboardServiceMetadataPipeline(),
            DASHBOARD_SERVICE_ENTITY,
            DatabaseService.class,
            PipelineType.METADATA,
            false),
        Arguments.of(
            new MessagingServiceMetadataPipeline(),
            MESSAGING_SERVICE_ENTITY,
            DatabaseService.class,
            PipelineType.METADATA,
            false),
        Arguments.of(
            new DatabaseServiceProfilerPipeline(),
            DATABASE_SERVICE_ENTITY,
            DatabaseService.class,
            PipelineType.PROFILER,
            false),
        Arguments.of(
            new PipelineServiceMetadataPipeline(),
            PIPELINE_SERVICE_ENTITY,
            DatabaseService.class,
            PipelineType.METADATA,
            false),
        Arguments.of(
            new MlmodelServiceMetadataPipeline(),
            MLMODEL_SERVICE_ENTITY,
            DatabaseService.class,
            PipelineType.METADATA,
            false));
  }
}
