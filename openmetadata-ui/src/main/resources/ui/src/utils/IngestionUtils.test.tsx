/*
 *  Copyright 2024 Collate.
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

import { PipelineType } from '../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { DatabaseServiceType } from '../generated/entity/services/databaseService';
import { MetadataServiceType } from '../generated/entity/services/metadataService';
import { ServicesType } from '../interface/service.interface';
import { getSupportedPipelineTypes } from './IngestionUtils';

describe('getSupportedPipelineTypes', () => {
  it('should return only return metadata pipeline types if config is undefined', () => {
    const serviceDetails = {};
    const result = getSupportedPipelineTypes(serviceDetails as ServicesType);

    expect(result).toEqual([PipelineType.Metadata]);
  });

  it('should return supported pipeline types based on config', () => {
    const serviceDetails: ServicesType = {
      id: '',
      name: '',
      serviceType: DatabaseServiceType.Athena,
      connection: {
        config: {
          supportsMetadataExtraction: true,
          supportsUsageExtraction: true,
          supportsLineageExtraction: true,
          supportsProfiler: true,
          supportsDBTExtraction: true,
          supportsViewLineageExtraction: true,
        },
      },
    };
    const result = getSupportedPipelineTypes(serviceDetails);

    expect(result).toEqual([
      PipelineType.Metadata,
      PipelineType.Usage,
      PipelineType.Lineage,
      PipelineType.Profiler,
      PipelineType.AutoClassification,
      PipelineType.Dbt,
    ]);
  });

  it('should return empty array if no pipeline types are supported', () => {
    const serviceDetails = {
      id: '',
      name: '',
      serviceType: DatabaseServiceType.Athena,
      connection: {
        config: {},
      },
    };
    const result = getSupportedPipelineTypes(serviceDetails);

    expect(result).toEqual([]);
  });

  it('should include DataInsight if supportsDataInsightExtraction is true', () => {
    const serviceDetails: ServicesType = {
      id: '',
      name: '',
      serviceType: MetadataServiceType.Alation,
      connection: {
        config: {
          supportsDataInsightExtraction: true,
        },
      },
    };
    const result = getSupportedPipelineTypes(serviceDetails);

    expect(result).toContain(PipelineType.DataInsight);
  });

  it('should include ElasticSearchReindex if supportsElasticSearchReindexingExtraction is true', () => {
    const serviceDetails = {
      id: '',
      name: '',
      serviceType: MetadataServiceType.AlationSink,
      connection: {
        config: {
          supportsElasticSearchReindexingExtraction: true,
        },
      },
    };
    const result = getSupportedPipelineTypes(serviceDetails);

    expect(result).toContain(PipelineType.ElasticSearchReindex);
  });
});
