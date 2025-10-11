/*
 *  Copyright 2025 Collate
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

import {
  DATABASE_DEFAULT,
  DASHBOARD_DEFAULT,
  PIPELINE_DEFAULT,
  TOPIC_DEFAULT,
  ML_MODEL_DEFAULT,
  CUSTOM_STORAGE_DEFAULT,
  CUSTOM_SEARCH_DEFAULT,
  CUSTOM_DRIVE_DEFAULT,
  DEFAULT_SERVICE,
} from '../../constants/Services.constant';
import serviceUtilClassBase from './ServiceUtilClassBase';

describe('ServiceUtilClassBase', () => {
  describe('getServiceLogo', () => {
    const validLogoUrl = 'https://example.com/logo.png';
    const validSvgLogoUrl = 'https://example.com/logo.svg';

    describe('Custom logo URL priority', () => {
      it('should return custom logoUrl when provided', () => {
        const serviceEntity = {
          logoUrl: validLogoUrl,
          serviceType: 'CustomDatabase',
        };

        const result = serviceUtilClassBase.getServiceLogo('CustomDatabase', serviceEntity);

        expect(result).toBe(validLogoUrl);
      });

      it('should return custom logoUrl for SVG format', () => {
        const serviceEntity = {
          logoUrl: validSvgLogoUrl,
          serviceType: 'CustomPipeline',
        };

        const result = serviceUtilClassBase.getServiceLogo('CustomPipeline', serviceEntity);

        expect(result).toBe(validSvgLogoUrl);
      });

      it('should prioritize custom logoUrl over hardcoded mappings', () => {
        const serviceEntity = {
          logoUrl: validLogoUrl,
          serviceType: 'CustomDatabase',
        };

        const result = serviceUtilClassBase.getServiceLogo('CustomDatabase', serviceEntity);

        expect(result).toBe(validLogoUrl);
        expect(result).not.toBe(DATABASE_DEFAULT);
      });
    });

    describe('Hardcoded service type mappings', () => {
      it('should return hardcoded logo for CustomDatabase when no custom logoUrl', () => {
        const serviceEntity = {
          serviceType: 'CustomDatabase',
        };

        const result = serviceUtilClassBase.getServiceLogo('CustomDatabase', serviceEntity);

        expect(result).toBe(DATABASE_DEFAULT);
      });

      it('should return hardcoded logo for CustomPipeline when no custom logoUrl', () => {
        const serviceEntity = {
          serviceType: 'CustomPipeline',
        };

        const result = serviceUtilClassBase.getServiceLogo('CustomPipeline', serviceEntity);

        expect(result).toBe(PIPELINE_DEFAULT);
      });

      it('should return hardcoded logo for CustomDashboard when no custom logoUrl', () => {
        const serviceEntity = {
          serviceType: 'CustomDashboard',
        };

        const result = serviceUtilClassBase.getServiceLogo('CustomDashboard', serviceEntity);

        expect(result).toBe(DASHBOARD_DEFAULT);
      });
    });

    describe('Generic service type fallback', () => {
      it('should return messaging service default for unknown messaging service', () => {
        const serviceEntity = {
          serviceType: 'CustomKafka',
        };

        const result = serviceUtilClassBase.getServiceLogo('CustomKafka', serviceEntity);

        expect(result).toBe(TOPIC_DEFAULT);
      });

      it('should return database service default for unknown database service', () => {
        const serviceEntity = {
          serviceType: 'CustomPostgres',
        };

        const result = serviceUtilClassBase.getServiceLogo('CustomPostgres', serviceEntity);

        expect(result).toBe(DATABASE_DEFAULT);
      });

      it('should return pipeline service default for unknown pipeline service', () => {
        const serviceEntity = {
          serviceType: 'CustomAirflow',
        };

        const result = serviceUtilClassBase.getServiceLogo('CustomAirflow', serviceEntity);

        expect(result).toBe(PIPELINE_DEFAULT);
      });

      it('should return dashboard service default for unknown dashboard service', () => {
        const serviceEntity = {
          serviceType: 'CustomGrafana',
        };

        const result = serviceUtilClassBase.getServiceLogo('CustomGrafana', serviceEntity);

        expect(result).toBe(DASHBOARD_DEFAULT);
      });

      it('should return ML model service default for unknown ML model service', () => {
        const serviceEntity = {
          serviceType: 'CustomMLflow',
        };

        const result = serviceUtilClassBase.getServiceLogo('CustomMLflow', serviceEntity);

        expect(result).toBe(ML_MODEL_DEFAULT);
      });

      it('should return storage service default for unknown storage service', () => {
        const serviceEntity = {
          serviceType: 'CustomS3',
        };

        const result = serviceUtilClassBase.getServiceLogo('CustomS3', serviceEntity);

        expect(result).toBe(CUSTOM_STORAGE_DEFAULT);
      });

      it('should return search service default for unknown search service', () => {
        const serviceEntity = {
          serviceType: 'CustomElasticsearch',
        };

        const result = serviceUtilClassBase.getServiceLogo('CustomElasticsearch', serviceEntity);

        expect(result).toBe(CUSTOM_SEARCH_DEFAULT);
      });

      it('should return drive service default for unknown drive service', () => {
        const serviceEntity = {
          serviceType: 'CustomDropbox',
        };

        const result = serviceUtilClassBase.getServiceLogo('CustomDropbox', serviceEntity);

        expect(result).toBe(CUSTOM_DRIVE_DEFAULT);
      });

      it('should return default service for completely unknown service type', () => {
        const serviceEntity = {
          serviceType: 'UnknownService',
        };

        const result = serviceUtilClassBase.getServiceLogo('UnknownService', serviceEntity);

        expect(result).toBe(DEFAULT_SERVICE);
      });
    });

    describe('Backward compatibility', () => {
      it('should work without serviceEntity parameter (legacy behavior)', () => {
        const result = serviceUtilClassBase.getServiceLogo('CustomDatabase');

        expect(result).toBe(DATABASE_DEFAULT);
      });

      it('should work with empty serviceEntity', () => {
        const serviceEntity = {};

        const result = serviceUtilClassBase.getServiceLogo('CustomDatabase', serviceEntity);

        expect(result).toBe(DATABASE_DEFAULT);
      });

      it('should work with serviceEntity without logoUrl', () => {
        const serviceEntity = {
          serviceType: 'CustomDatabase',
          name: 'test-service',
        };

        const result = serviceUtilClassBase.getServiceLogo('CustomDatabase', serviceEntity);

        expect(result).toBe(DATABASE_DEFAULT);
      });
    });

    describe('Edge cases', () => {
      it('should handle null logoUrl', () => {
        const serviceEntity = {
          logoUrl: null,
          serviceType: 'CustomDatabase',
        };

        const result = serviceUtilClassBase.getServiceLogo('CustomDatabase', serviceEntity);

        expect(result).toBe(DATABASE_DEFAULT);
      });

      it('should handle undefined logoUrl', () => {
        const serviceEntity = {
          logoUrl: undefined,
          serviceType: 'CustomDatabase',
        };

        const result = serviceUtilClassBase.getServiceLogo('CustomDatabase', serviceEntity);

        expect(result).toBe(DATABASE_DEFAULT);
      });

      it('should handle empty string logoUrl', () => {
        const serviceEntity = {
          logoUrl: '',
          serviceType: 'CustomDatabase',
        };

        const result = serviceUtilClassBase.getServiceLogo('CustomDatabase', serviceEntity);

        expect(result).toBe(DATABASE_DEFAULT);
      });

      it('should handle whitespace-only logoUrl', () => {
        const serviceEntity = {
          logoUrl: '   ',
          serviceType: 'CustomDatabase',
        };

        const result = serviceUtilClassBase.getServiceLogo('CustomDatabase', serviceEntity);

        expect(result).toBe(DATABASE_DEFAULT);
      });
    });

    describe('All service types coverage', () => {
      const serviceTypeTestCases = [
        // Database services
        { type: 'CustomDatabase', expected: DATABASE_DEFAULT },
        { type: 'CustomMysql', expected: DATABASE_DEFAULT },
        { type: 'CustomPostgres', expected: DATABASE_DEFAULT },
        
        // Pipeline services
        { type: 'CustomPipeline', expected: PIPELINE_DEFAULT },
        { type: 'CustomAirflow', expected: PIPELINE_DEFAULT },
        { type: 'CustomPrefect', expected: PIPELINE_DEFAULT },
        
        // Dashboard services
        { type: 'CustomDashboard', expected: DASHBOARD_DEFAULT },
        { type: 'CustomLooker', expected: DASHBOARD_DEFAULT },
        { type: 'CustomGrafana', expected: DASHBOARD_DEFAULT },
        
        // Messaging services
        { type: 'CustomMessaging', expected: TOPIC_DEFAULT },
        { type: 'CustomKafka', expected: TOPIC_DEFAULT },
        { type: 'CustomPulsar', expected: TOPIC_DEFAULT },
        
        // ML Model services
        { type: 'CustomMlModel', expected: ML_MODEL_DEFAULT },
        { type: 'CustomMLflow', expected: ML_MODEL_DEFAULT },
        { type: 'CustomSageMaker', expected: ML_MODEL_DEFAULT },
        
        // Storage services
        { type: 'CustomStorage', expected: CUSTOM_STORAGE_DEFAULT },
        { type: 'CustomS3', expected: CUSTOM_STORAGE_DEFAULT },
        { type: 'CustomGCS', expected: CUSTOM_STORAGE_DEFAULT },
        
        // Search services
        { type: 'CustomSearch', expected: CUSTOM_SEARCH_DEFAULT },
        { type: 'CustomElasticsearch', expected: CUSTOM_SEARCH_DEFAULT },
        { type: 'CustomOpenSearch', expected: CUSTOM_SEARCH_DEFAULT },
        
        // Drive services
        { type: 'CustomDrive', expected: CUSTOM_DRIVE_DEFAULT },
        { type: 'CustomGoogleDrive', expected: CUSTOM_DRIVE_DEFAULT },
        { type: 'CustomDropbox', expected: CUSTOM_DRIVE_DEFAULT },
      ];

      serviceTypeTestCases.forEach(({ type, expected }) => {
        it(`should return correct default for ${type}`, () => {
          const serviceEntity = { serviceType: type };
          const result = serviceUtilClassBase.getServiceLogo(type, serviceEntity);
          expect(result).toBe(expected);
        });
      });
    });
  });
});
