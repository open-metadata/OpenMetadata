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

package org.openmetadata.service.secrets.converter;

import java.util.Map;
import lombok.Getter;
import org.openmetadata.schema.auth.SSOAuthMechanism;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.metadataIngestion.DbtPipeline;
import org.openmetadata.schema.metadataIngestion.dbtconfig.DbtGCSConfig;
import org.openmetadata.schema.security.credentials.GCPCredentials;
import org.openmetadata.schema.services.connections.dashboard.LookerConnection;
import org.openmetadata.schema.services.connections.dashboard.SupersetConnection;
import org.openmetadata.schema.services.connections.dashboard.TableauConnection;
import org.openmetadata.schema.services.connections.dashboard.ThoughtSpotConnection;
import org.openmetadata.schema.services.connections.database.BigQueryConnection;
import org.openmetadata.schema.services.connections.database.BigTableConnection;
import org.openmetadata.schema.services.connections.database.CassandraConnection;
import org.openmetadata.schema.services.connections.database.CockroachConnection;
import org.openmetadata.schema.services.connections.database.DatalakeConnection;
import org.openmetadata.schema.services.connections.database.DeltaLakeConnection;
import org.openmetadata.schema.services.connections.database.GreenplumConnection;
import org.openmetadata.schema.services.connections.database.HiveConnection;
import org.openmetadata.schema.services.connections.database.IcebergConnection;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.PostgresConnection;
import org.openmetadata.schema.services.connections.database.RedshiftConnection;
import org.openmetadata.schema.services.connections.database.SalesforceConnection;
import org.openmetadata.schema.services.connections.database.SapHanaConnection;
import org.openmetadata.schema.services.connections.database.TrinoConnection;
import org.openmetadata.schema.services.connections.database.datalake.GCSConfig;
import org.openmetadata.schema.services.connections.database.deltalake.StorageConfig;
import org.openmetadata.schema.services.connections.database.iceberg.IcebergFileSystem;
import org.openmetadata.schema.services.connections.mlmodel.VertexAIConnection;
import org.openmetadata.schema.services.connections.pipeline.AirflowConnection;
import org.openmetadata.schema.services.connections.pipeline.MatillionConnection;
import org.openmetadata.schema.services.connections.pipeline.NifiConnection;
import org.openmetadata.schema.services.connections.pipeline.SSISConnection;
import org.openmetadata.schema.services.connections.search.ElasticSearchConnection;
import org.openmetadata.schema.services.connections.security.RangerConnection;
import org.openmetadata.schema.services.connections.storage.GCSConnection;

/** Factory class to get a `ClassConverter` based on the service class. */
public final class ClassConverterFactory {
  private ClassConverterFactory() {
    /* Final Class */
  }

  @Getter private static final Map<Class<?>, ClassConverter> converterMap;

  static {
    converterMap =
        Map.ofEntries(
            Map.entry(AirflowConnection.class, new AirflowConnectionClassConverter()),
            Map.entry(BigQueryConnection.class, new BigQueryConnectionClassConverter()),
            Map.entry(BigTableConnection.class, new BigTableConnectionClassConverter()),
            Map.entry(DatalakeConnection.class, new DatalakeConnectionClassConverter()),
            Map.entry(DeltaLakeConnection.class, new DeltaLakeConnectionClassConverter()),
            Map.entry(DbtGCSConfig.class, new DbtGCSConfigClassConverter()),
            Map.entry(DbtPipeline.class, new DbtPipelineClassConverter()),
            Map.entry(ElasticSearchConnection.class, new ElasticSearchConnectionClassConverter()),
            Map.entry(GCSConfig.class, new GCPConfigClassConverter()),
            Map.entry(GCPCredentials.class, new GcpCredentialsClassConverter()),
            Map.entry(GCSConnection.class, new GcpConnectionClassConverter()),
            Map.entry(HiveConnection.class, new HiveConnectionClassConverter()),
            Map.entry(IcebergConnection.class, new IcebergConnectionClassConverter()),
            Map.entry(IcebergFileSystem.class, new IcebergFileSystemClassConverter()),
            Map.entry(LookerConnection.class, new LookerConnectionClassConverter()),
            Map.entry(MysqlConnection.class, new MysqlConnectionClassConverter()),
            Map.entry(RedshiftConnection.class, new RedshiftConnectionClassConverter()),
            Map.entry(GreenplumConnection.class, new GreenplumConnectionClassConverter()),
            Map.entry(PostgresConnection.class, new PostgresConnectionClassConverter()),
            Map.entry(SapHanaConnection.class, new SapHanaConnectionClassConverter()),
            Map.entry(StorageConfig.class, new StorageConfigClassConverter()),
            Map.entry(SupersetConnection.class, new SupersetConnectionClassConverter()),
            Map.entry(SSOAuthMechanism.class, new SSOAuthMechanismClassConverter()),
            Map.entry(TableauConnection.class, new TableauConnectionClassConverter()),
            Map.entry(ThoughtSpotConnection.class, new ThoughtSpotConnectionClassConverter()),
            Map.entry(SalesforceConnection.class, new SalesforceConnectorClassConverter()),
            Map.entry(
                TestServiceConnectionRequest.class,
                new TestServiceConnectionRequestClassConverter()),
            Map.entry(TrinoConnection.class, new TrinoConnectionClassConverter()),
            Map.entry(Workflow.class, new WorkflowClassConverter()),
            Map.entry(CockroachConnection.class, new CockroachConnectionClassConverter()),
            Map.entry(NifiConnection.class, new NifiConnectionClassConverter()),
            Map.entry(MatillionConnection.class, new MatillionConnectionClassConverter()),
            Map.entry(VertexAIConnection.class, new VertexAIConnectionClassConverter()),
            Map.entry(RangerConnection.class, new RangerConnectionClassConverter()));
    Map.entry(Workflow.class, new WorkflowClassConverter());
    Map.entry(CassandraConnection.class, new CassandraConnectionClassConverter());
    Map.entry(SSISConnection.class, new SsisConnectionClassConverter());
  }

  public static ClassConverter getConverter(Class<?> clazz) {
    return converterMap.getOrDefault(clazz, new DefaultConnectionClassConverter(clazz));
  }
}
