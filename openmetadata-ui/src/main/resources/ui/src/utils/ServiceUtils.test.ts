/*
 *  Copyright 2025 Collate.
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
import { render, screen } from '@testing-library/react';
import { SearchIndex } from '../enums/search.enum';
import { ServiceCategory } from '../enums/service.enum';
import {
  MlmodelService,
  MlModelServiceType,
} from '../generated/entity/services/mlmodelService';
import {
  getActiveFieldNameForAppDocs,
  getSearchIndexFromService,
} from './ServicePureUtils';
import { getOptionalFields } from './ServiceUtils';

describe('getSearchIndexFromService', () => {
  it.each([
    [ServiceCategory.DATABASE_SERVICES, SearchIndex.DATABASE_SERVICE],
    [ServiceCategory.DASHBOARD_SERVICES, SearchIndex.DASHBOARD_SERVICE],
    [ServiceCategory.MESSAGING_SERVICES, SearchIndex.MESSAGING_SERVICE],
    [ServiceCategory.PIPELINE_SERVICES, SearchIndex.PIPELINE_SERVICE],
    [ServiceCategory.ML_MODEL_SERVICES, SearchIndex.ML_MODEL_SERVICE],
    [ServiceCategory.STORAGE_SERVICES, SearchIndex.STORAGE_SERVICE],
    [ServiceCategory.SEARCH_SERVICES, SearchIndex.SEARCH_SERVICE],
    [ServiceCategory.API_SERVICES, SearchIndex.API_SERVICE],
    [ServiceCategory.DRIVE_SERVICES, SearchIndex.DRIVE_SERVICE],
    [ServiceCategory.METADATA_SERVICES, SearchIndex.METADATA_SERVICE],
  ])(
    'should map %s to the correct search index',
    (serviceCategory, expectedIndex) => {
      expect(getSearchIndexFromService(serviceCategory)).toBe(expectedIndex);
    }
  );

  it('should return DATABASE_SERVICE as default for unknown service category', () => {
    expect(getSearchIndexFromService('unknownService')).toBe(
      SearchIndex.DATABASE_SERVICE
    );
  });
});

describe('Service Utils', () => {
  describe('getActiveFieldNameForAppDocs', () => {
    it('should handle various cases correctly', () => {
      expect(getActiveFieldNameForAppDocs()).toBeUndefined();
      expect(getActiveFieldNameForAppDocs('root/field1/field2')).toBe(
        'field1.field2'
      );
      expect(getActiveFieldNameForAppDocs('root')).toBe('');
      expect(getActiveFieldNameForAppDocs('root/1/2/3')).toBe('');
      expect(getActiveFieldNameForAppDocs('field1/field2')).toBe('field2');
      expect(getActiveFieldNameForAppDocs('root/field1/@special/field2')).toBe(
        'field1.@special.field2'
      );
    });
  });
});

describe('MLflow service card fields', () => {
  it.each(['*********', 'http://localhost:5001', undefined])(
    'shows tracking without displaying the registry value %s',
    (registryUri) => {
      const service: MlmodelService = {
        id: 'mlflow-service',
        name: 'demo_mlflow',
        serviceType: MlModelServiceType.Mlflow,
        connection: {
          config: { trackingUri: 'http://localhost:5000', registryUri },
        },
      };

      render(getOptionalFields(service, ServiceCategory.ML_MODEL_SERVICES));

      expect(screen.getByText('http://localhost:5000')).toBeInTheDocument();
      expect(screen.getAllByTestId('additional-field')).toHaveLength(1);

      if (registryUri) {
        expect(screen.queryByText(registryUri)).not.toBeInTheDocument();
      }
    }
  );
});
