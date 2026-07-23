/*
 *  Copyright 2023 Collate.
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
import {
  hasCustomPropertiesTab,
  hasLineageTab,
  hasSchemaTab,
} from './EntityPermissionUtils';

describe('EntityPermissionUtils unit tests', () => {
  describe('hasSchemaTab', () => {
    it('should return true for all entity types in SCHEMA_TABS_SET', () => {
      const {
        SCHEMA_TABS_SET,
      } = require('../components/Entity/EntityRightPanel/EntityRightPanelVerticalNav.constants');

      SCHEMA_TABS_SET.forEach((entityType: EntityType) => {
        expect(hasSchemaTab(entityType)).toBe(true);
      });
    });

    it('should return false for entity types not in SCHEMA_TABS_SET', () => {
      const {
        SCHEMA_TABS_SET,
      } = require('../components/Entity/EntityRightPanel/EntityRightPanelVerticalNav.constants');
      const allEntityTypes = Object.values(EntityType);
      const entitiesWithoutSchema = allEntityTypes.filter(
        (type) => !SCHEMA_TABS_SET.has(type)
      );

      entitiesWithoutSchema.forEach((entityType) => {
        expect(hasSchemaTab(entityType)).toBe(false);
      });
    });
  });

  describe('hasLineageTab', () => {
    it('should return true for all entity types in LINEAGE_TABS_SET', () => {
      const {
        LINEAGE_TABS_SET,
      } = require('../components/Entity/EntityRightPanel/EntityRightPanelVerticalNav.constants');

      LINEAGE_TABS_SET.forEach((entityType: EntityType) => {
        expect(hasLineageTab(entityType)).toBe(true);
      });
    });

    it('should return false for entity types not in LINEAGE_TABS_SET', () => {
      const {
        LINEAGE_TABS_SET,
      } = require('../components/Entity/EntityRightPanel/EntityRightPanelVerticalNav.constants');
      const allEntityTypes = Object.values(EntityType);
      const entitiesWithoutLineage = allEntityTypes.filter(
        (type) => !LINEAGE_TABS_SET.has(type)
      );

      entitiesWithoutLineage.forEach((entityType) => {
        expect(hasLineageTab(entityType)).toBe(false);
      });
    });
  });

  describe('hasCustomPropertiesTab', () => {
    it('should return true for all entity types in CUSTOM_PROPERTIES_TABS_SET', () => {
      const {
        CUSTOM_PROPERTIES_TABS_SET,
      } = require('../components/Entity/EntityRightPanel/EntityRightPanelVerticalNav.constants');

      CUSTOM_PROPERTIES_TABS_SET.forEach((entityType: EntityType) => {
        expect(hasCustomPropertiesTab(entityType)).toBe(true);
      });
    });

    it('should return false for entity types not in CUSTOM_PROPERTIES_TABS_SET', () => {
      const {
        CUSTOM_PROPERTIES_TABS_SET,
      } = require('../components/Entity/EntityRightPanel/EntityRightPanelVerticalNav.constants');
      const allEntityTypes = Object.values(EntityType);
      const entitiesWithoutCustomProperties = allEntityTypes.filter(
        (type) => !CUSTOM_PROPERTIES_TABS_SET.has(type)
      );

      entitiesWithoutCustomProperties.forEach((entityType) => {
        expect(hasCustomPropertiesTab(entityType)).toBe(false);
      });
    });
  });
});
