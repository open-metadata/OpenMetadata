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

import { render } from '@testing-library/react';
import { ServiceCategory } from '../enums/service.enum';
import { PipelineType } from '../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { UIThemePreference } from '../generated/configuration/uiThemePreference';
import { DatabaseServiceType } from '../generated/entity/services/databaseService';
import { IngestionPipeline } from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { MetadataServiceType } from '../generated/entity/services/metadataService';
import { PipelineServiceType } from '../generated/entity/services/pipelineService';
import { StorageServiceType } from '../generated/entity/services/storageService';
import { ServicesType } from '../interface/service.interface';
import {
  getIngestionTypes,
  getSupportedPipelineTypes,
} from './IngestionConfigUtils';
import { getErrorPlaceHolder } from './IngestionUtils';

const mockTheme = {
  primaryColor: '#000000',
} as UIThemePreference['customTheme'];

const AGENTS_CARD_CLASSNAME =
  'tw:bg-primary tw:border tw:border-secondary tw:rounded-xl';
const INGESTION_TABLE_CLASSNAME = 'tw:relative tw:py-8';

describe('getSupportedPipelineTypes', () => {
  it('should return metadata pipeline type for a connectionless non-Spark service', () => {
    const serviceDetails = {
      id: '',
      name: 'airflow_service',
      serviceType: PipelineServiceType.Airflow,
    };
    const result = getSupportedPipelineTypes(serviceDetails as ServicesType);

    expect(result).toEqual([PipelineType.Metadata]);
  });

  it('should not return pull ingestion types for a connectionless Spark service', () => {
    const serviceDetails = {
      id: '',
      name: 'spark_openlineage',
      serviceType: PipelineServiceType.Spark,
    };
    const result = getSupportedPipelineTypes(serviceDetails as ServicesType);

    expect(result).toEqual([]);
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

  it('should return only AutoClassification for storage services with supportsProfiler', () => {
    const serviceDetails: ServicesType = {
      id: '',
      name: '',
      serviceType: StorageServiceType.S3,
      connection: {
        config: {
          supportsMetadataExtraction: true,
          supportsProfiler: true,
        },
      },
    };
    const result = getSupportedPipelineTypes(
      serviceDetails,
      ServiceCategory.STORAGE_SERVICES
    );

    expect(result).toEqual([
      PipelineType.Metadata,
      PipelineType.AutoClassification,
    ]);
    expect(result).not.toContain(PipelineType.Profiler);
  });
});

describe('getIngestionTypes', () => {
  it('should return all supported pipeline types when no pipeline type is specified', () => {
    const supportedPipelineTypes = [
      PipelineType.Metadata,
      PipelineType.Usage,
      PipelineType.Lineage,
    ];
    const ingestionList: IngestionPipeline[] = [];
    const result = getIngestionTypes(supportedPipelineTypes, ingestionList);

    expect(result).toEqual(supportedPipelineTypes);
  });

  it('should return only specified pipeline type when pipeline type is provided', () => {
    const supportedPipelineTypes = [
      PipelineType.Metadata,
      PipelineType.Usage,
      PipelineType.Lineage,
    ];
    const ingestionList: IngestionPipeline[] = [];
    const result = getIngestionTypes(
      supportedPipelineTypes,
      ingestionList,
      PipelineType.Metadata
    );

    expect(result).toEqual([PipelineType.Metadata]);
  });

  it('should exclude Usage pipeline type if it already exists in ingestion list', () => {
    const supportedPipelineTypes = [
      PipelineType.Metadata,
      PipelineType.Usage,
      PipelineType.Lineage,
    ];
    const ingestionList: IngestionPipeline[] = [
      {
        pipelineType: PipelineType.Usage,
      } as IngestionPipeline,
    ];
    const result = getIngestionTypes(supportedPipelineTypes, ingestionList);

    expect(result).toEqual([PipelineType.Metadata, PipelineType.Lineage]);
  });

  it('should include Usage pipeline type if it does not exist in ingestion list', () => {
    const supportedPipelineTypes = [
      PipelineType.Metadata,
      PipelineType.Usage,
      PipelineType.Lineage,
    ];
    const ingestionList: IngestionPipeline[] = [
      {
        pipelineType: PipelineType.Metadata,
      } as IngestionPipeline,
    ];
    const result = getIngestionTypes(supportedPipelineTypes, ingestionList);

    expect(result).toEqual(supportedPipelineTypes);
  });

  it('should return empty array when supported pipeline types is empty', () => {
    const supportedPipelineTypes: PipelineType[] = [];
    const ingestionList: IngestionPipeline[] = [];
    const result = getIngestionTypes(supportedPipelineTypes, ingestionList);

    expect(result).toEqual([]);
  });
});

describe('getErrorPlaceHolder', () => {
  it('should return null when ingestion data exists', () => {
    const result = getErrorPlaceHolder(1, false, mockTheme);

    expect(result).toBeNull();
  });

  it('should render the empty placeholder when there is no ingestion data', () => {
    const { getByTestId } = render(
      <>{getErrorPlaceHolder(0, false, mockTheme)}</>
    );

    expect(getByTestId('empty-placeholder')).toBeInTheDocument();
  });

  it('should forward the caller provided className to the placeholder', () => {
    const { getByTestId } = render(
      <>
        {getErrorPlaceHolder(
          0,
          false,
          mockTheme,
          undefined,
          INGESTION_TABLE_CLASSNAME
        )}
      </>
    );
    const placeholder = getByTestId('empty-placeholder');

    expect(placeholder).toHaveClass('tw:relative', 'tw:py-8');
    // Guards the visual regression: the agents card styling must never
    // leak onto a caller that did not ask for it (e.g. the ingestion table).
    expect(placeholder).not.toHaveClass(
      'tw:bg-primary',
      'tw:border-secondary',
      'tw:rounded-xl'
    );
  });

  it('should apply the agents card styling only when that className is passed', () => {
    const { getByTestId } = render(
      <>
        {getErrorPlaceHolder(
          0,
          false,
          mockTheme,
          undefined,
          AGENTS_CARD_CLASSNAME
        )}
      </>
    );

    expect(getByTestId('empty-placeholder')).toHaveClass(
      'tw:bg-primary',
      'tw:border-secondary',
      'tw:rounded-xl'
    );
  });

  it('should not apply any card styling when no className is provided', () => {
    const { getByTestId } = render(
      <>{getErrorPlaceHolder(0, false, mockTheme)}</>
    );

    expect(getByTestId('empty-placeholder')).not.toHaveClass(
      'tw:bg-primary',
      'tw:border-secondary',
      'tw:rounded-xl'
    );
  });
});
