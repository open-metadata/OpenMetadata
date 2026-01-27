/*
 *  Copyright 2022 Collate.
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

import { GlobalSettingOptions } from '../constants/GlobalSettings.constants';
import { EntityType } from '../enums/entity.enum';
import { getSettingOptionByEntityType } from './GlobalSettingsUtils';

describe('GlobalSettingsUtils', () => {
  describe('getSettingOptionByEntityType', () => {
    it('should return TABLES for EntityType.TABLE', () => {
      expect(getSettingOptionByEntityType(EntityType.TABLE)).toBe(
        GlobalSettingOptions.TABLES
      );
    });

    it('should return TOPICS for EntityType.TOPIC', () => {
      expect(getSettingOptionByEntityType(EntityType.TOPIC)).toBe(
        GlobalSettingOptions.TOPICS
      );
    });

    it('should return DASHBOARDS for EntityType.DASHBOARD', () => {
      expect(getSettingOptionByEntityType(EntityType.DASHBOARD)).toBe(
        GlobalSettingOptions.DASHBOARDS
      );
    });

    it('should return PIPELINES for EntityType.PIPELINE', () => {
      expect(getSettingOptionByEntityType(EntityType.PIPELINE)).toBe(
        GlobalSettingOptions.PIPELINES
      );
    });

    it('should return MLMODELS for EntityType.MLMODEL', () => {
      expect(getSettingOptionByEntityType(EntityType.MLMODEL)).toBe(
        GlobalSettingOptions.MLMODELS
      );
    });

    it('should return CONTAINERS for EntityType.CONTAINER', () => {
      expect(getSettingOptionByEntityType(EntityType.CONTAINER)).toBe(
        GlobalSettingOptions.CONTAINERS
      );
    });

    it('should return DATABASE for EntityType.DATABASE', () => {
      expect(getSettingOptionByEntityType(EntityType.DATABASE)).toBe(
        GlobalSettingOptions.DATABASES
      );
    });

    it('should return DATABASE_SCHEMA for EntityType.DATABASE_SCHEMA', () => {
      expect(getSettingOptionByEntityType(EntityType.DATABASE_SCHEMA)).toBe(
        GlobalSettingOptions.DATABASE_SCHEMA
      );
    });

    it('should return GLOSSARY_TERM for EntityType.GLOSSARY_TERM', () => {
      expect(getSettingOptionByEntityType(EntityType.GLOSSARY_TERM)).toBe(
        GlobalSettingOptions.GLOSSARY_TERM
      );
    });

    it('should return CHARTS for EntityType.CHART', () => {
      expect(getSettingOptionByEntityType(EntityType.CHART)).toBe(
        GlobalSettingOptions.CHARTS
      );
    });

    it('should return DOMAINS for EntityType.DOMAIN', () => {
      expect(getSettingOptionByEntityType(EntityType.DOMAIN)).toBe(
        GlobalSettingOptions.DOMAINS
      );
    });

    it('should return STORED_PROCEDURES for EntityType.STORED_PROCEDURE', () => {
      expect(getSettingOptionByEntityType(EntityType.STORED_PROCEDURE)).toBe(
        GlobalSettingOptions.STORED_PROCEDURES
      );
    });

    it('should return SEARCH_INDEXES for EntityType.SEARCH_INDEX', () => {
      expect(getSettingOptionByEntityType(EntityType.SEARCH_INDEX)).toBe(
        GlobalSettingOptions.SEARCH_INDEXES
      );
    });

    it('should return DASHBOARD_DATA_MODEL for EntityType.DASHBOARD_DATA_MODEL', () => {
      expect(
        getSettingOptionByEntityType(EntityType.DASHBOARD_DATA_MODEL)
      ).toBe(GlobalSettingOptions.DASHBOARD_DATA_MODEL);
    });

    it('should return API_ENDPOINTS for EntityType.API_ENDPOINT', () => {
      expect(getSettingOptionByEntityType(EntityType.API_ENDPOINT)).toBe(
        GlobalSettingOptions.API_ENDPOINTS
      );
    });

    it('should return API_COLLECTIONS for EntityType.API_COLLECTION', () => {
      expect(getSettingOptionByEntityType(EntityType.API_COLLECTION)).toBe(
        GlobalSettingOptions.API_COLLECTIONS
      );
    });

    it('should return DATA_PRODUCT for EntityType.DATA_PRODUCT', () => {
      expect(getSettingOptionByEntityType(EntityType.DATA_PRODUCT)).toBe(
        GlobalSettingOptions.DATA_PRODUCT
      );
    });

    it('should return METRICS for EntityType.METRIC', () => {
      expect(getSettingOptionByEntityType(EntityType.METRIC)).toBe(
        GlobalSettingOptions.METRICS
      );
    });

    it('should return TABLES as default for unknown entity types', () => {
      expect(
        getSettingOptionByEntityType('unknownEntityType' as EntityType)
      ).toBe(GlobalSettingOptions.TABLES);
    });

    describe('edge cases', () => {
      it('should handle undefined gracefully and return TABLES', () => {
        expect(
          getSettingOptionByEntityType(undefined as unknown as EntityType)
        ).toBe(GlobalSettingOptions.TABLES);
      });

      it('should handle null gracefully and return TABLES', () => {
        expect(
          getSettingOptionByEntityType(null as unknown as EntityType)
        ).toBe(GlobalSettingOptions.TABLES);
      });

      it('should handle empty string and return TABLES', () => {
        expect(getSettingOptionByEntityType('' as EntityType)).toBe(
          GlobalSettingOptions.TABLES
        );
      });
    });

    describe('all supported custom property entities', () => {
      const supportedEntities = [
        { entity: EntityType.TABLE, option: GlobalSettingOptions.TABLES },
        { entity: EntityType.TOPIC, option: GlobalSettingOptions.TOPICS },
        {
          entity: EntityType.DASHBOARD,
          option: GlobalSettingOptions.DASHBOARDS,
        },
        {
          entity: EntityType.PIPELINE,
          option: GlobalSettingOptions.PIPELINES,
        },
        { entity: EntityType.MLMODEL, option: GlobalSettingOptions.MLMODELS },
        {
          entity: EntityType.CONTAINER,
          option: GlobalSettingOptions.CONTAINERS,
        },
        {
          entity: EntityType.DATABASE,
          option: GlobalSettingOptions.DATABASES,
        },
        {
          entity: EntityType.DATABASE_SCHEMA,
          option: GlobalSettingOptions.DATABASE_SCHEMA,
        },
        {
          entity: EntityType.GLOSSARY_TERM,
          option: GlobalSettingOptions.GLOSSARY_TERM,
        },
        { entity: EntityType.CHART, option: GlobalSettingOptions.CHARTS },
        { entity: EntityType.DOMAIN, option: GlobalSettingOptions.DOMAINS },
        {
          entity: EntityType.STORED_PROCEDURE,
          option: GlobalSettingOptions.STORED_PROCEDURES,
        },
        {
          entity: EntityType.SEARCH_INDEX,
          option: GlobalSettingOptions.SEARCH_INDEXES,
        },
        {
          entity: EntityType.DASHBOARD_DATA_MODEL,
          option: GlobalSettingOptions.DASHBOARD_DATA_MODEL,
        },
        {
          entity: EntityType.API_ENDPOINT,
          option: GlobalSettingOptions.API_ENDPOINTS,
        },
        {
          entity: EntityType.API_COLLECTION,
          option: GlobalSettingOptions.API_COLLECTIONS,
        },
        {
          entity: EntityType.DATA_PRODUCT,
          option: GlobalSettingOptions.DATA_PRODUCT,
        },
        { entity: EntityType.METRIC, option: GlobalSettingOptions.METRICS },
      ];

      it.each(supportedEntities)(
        'should map $entity to $option correctly',
        ({ entity, option }) => {
          expect(getSettingOptionByEntityType(entity)).toBe(option);
        }
      );

      it('should have all entities that support custom properties covered', () => {
        expect(supportedEntities).toHaveLength(18);
      });
    });
  });
});
