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
import { EntityType } from '../enums/entity.enum';
import entityPatchClassBase from './EntityPatchUtils';

describe('EntityPatchUtils', () => {
  describe('getEntityPatchAPI', () => {
    it('should return patch API for TABLE entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(EntityType.TABLE);

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for DASHBOARD entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.DASHBOARD
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for TOPIC entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(EntityType.TOPIC);

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for PIPELINE entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.PIPELINE
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for MLMODEL entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.MLMODEL
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for CHART entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(EntityType.CHART);

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for API_COLLECTION entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.API_COLLECTION
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for API_ENDPOINT entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.API_ENDPOINT
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for DATABASE entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.DATABASE
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for DATABASE_SCHEMA entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.DATABASE_SCHEMA
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for STORED_PROCEDURE entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.STORED_PROCEDURE
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for CONTAINER entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.CONTAINER
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for DASHBOARD_DATA_MODEL entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.DASHBOARD_DATA_MODEL
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for SEARCH_INDEX entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.SEARCH_INDEX
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for DATA_PRODUCT entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.DATA_PRODUCT
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for METRIC entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.METRIC
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for GLOSSARY entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.GLOSSARY
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for GLOSSARY_TERM entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.GLOSSARY_TERM
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for DOMAIN entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.DOMAIN
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for TAG entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(EntityType.TAG);

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for CLASSIFICATION entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.CLASSIFICATION
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for DIRECTORY entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.DIRECTORY
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for FILE entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(EntityType.FILE);

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for SPREADSHEET entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.SPREADSHEET
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for WORKSHEET entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.WORKSHEET
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for DATABASE_SERVICE entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.DATABASE_SERVICE
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for DASHBOARD_SERVICE entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.DASHBOARD_SERVICE
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for MESSAGING_SERVICE entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.MESSAGING_SERVICE
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for PIPELINE_SERVICE entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.PIPELINE_SERVICE
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for MLMODEL_SERVICE entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.MLMODEL_SERVICE
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for METADATA_SERVICE entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.METADATA_SERVICE
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for STORAGE_SERVICE entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.STORAGE_SERVICE
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for SEARCH_SERVICE entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.SEARCH_SERVICE
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for API_SERVICE entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.API_SERVICE
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for SECURITY_SERVICE entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.SECURITY_SERVICE
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for DRIVE_SERVICE entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.DRIVE_SERVICE
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for KPI entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(EntityType.KPI);

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for APPLICATION entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.APPLICATION
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for QUERY entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(EntityType.QUERY);

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for ROLE entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(EntityType.ROLE);

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for POLICY entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.POLICY
      );

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should return patch API for TEAM entity type', () => {
      const patchAPI = entityPatchClassBase.getEntityPatchAPI(EntityType.TEAM);

      expect(patchAPI).toBeDefined();
      expect(typeof patchAPI).toBe('function');
    });

    it('should throw error when entity type is undefined', () => {
      expect(() => entityPatchClassBase.getEntityPatchAPI(undefined)).toThrow(
        'Entity type is required'
      );
    });

    it('should throw error for unsupported entity type', () => {
      const unsupportedType = 'UNSUPPORTED_TYPE' as EntityType;

      expect(() =>
        entityPatchClassBase.getEntityPatchAPI(unsupportedType)
      ).toThrow(`No patch API available for entity type: ${unsupportedType}`);
    });

    it('should return same function reference for same entity type', () => {
      const api1 = entityPatchClassBase.getEntityPatchAPI(EntityType.TABLE);
      const api2 = entityPatchClassBase.getEntityPatchAPI(EntityType.TABLE);

      expect(api1).toBe(api2);
    });

    it('should return different functions for different entity types', () => {
      const tableAPI = entityPatchClassBase.getEntityPatchAPI(EntityType.TABLE);
      const dashboardAPI = entityPatchClassBase.getEntityPatchAPI(
        EntityType.DASHBOARD
      );

      expect(tableAPI).not.toBe(dashboardAPI);
    });
  });
});
