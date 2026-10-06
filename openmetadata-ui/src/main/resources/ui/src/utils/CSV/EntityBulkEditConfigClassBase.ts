/*
 *  Copyright 2026 Collate.
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
import { DefaultOptionType } from 'antd/lib/select';
import type { Column } from 'react-data-grid';
import { EntityType } from '../../enums/entity.enum';
import {
  EntityStatus,
  MetricGranularity,
  MetricType,
  UnitOfMeasurement,
} from '../../generated/entity/data/metric';
import { CsvHeaderDocumentation } from '../../rest/csvAPI';

export interface BulkEditListingFilters {
  searchText?: string;
  statusFilter?: string;
}

export type BulkEditListingScope =
  | {
      mode: 'selected';
      ids: string[];
      names: string[];
      filters: BulkEditListingFilters;
    }
  | {
      mode: 'filtered';
      filters: BulkEditListingFilters;
    };

export interface BulkEditListingGridArgs {
  scope: BulkEditListingScope;
  headers: CsvHeaderDocumentation[];
  multipleOwner: { user: boolean; team: boolean };
  isBulkEdit: boolean;
  signal: AbortSignal;
  onProgress?: (loadedCount: number, matchedCount: number) => void;
}

export interface BulkEditListingGrid {
  columns: Column<Record<string, string>>[];
  dataSource: Record<string, string>[];
  loadedCount: number;
  matchedCount: number;
}

export interface BulkEditImportUploadConfig {
  /** Upload-zone style for the import wizard. */
  variant: 'compact' | 'default';
  /** i18n key for the upload step heading. */
  headingKey: string;
  /** i18n key for the upload step description. */
  descriptionKey: string;
  /** Hide the inline required-columns chips (covered by the description). */
  hideRequiredHeaders?: boolean;
}

export interface BulkEditNewRowConfig {
  /** Column defaults applied to a freshly added row. */
  defaults: Record<string, string>;
  /** i18n key for the entity label on the Add button ("Add <entity>"). */
  entityLabelKey: string;
  /** i18n key for the helper text next to the Add button. */
  hintMessageKey: string;
}

/**
 * Per-entity behavior of the bulk edit / import grid. Adding an entry here is
 * all it takes to give another entity the rich bulk-edit experience (locked
 * identity columns, enum dropdowns, add-row, inline editors) — the shared grid
 * code reads this config instead of hardcoding entity checks.
 */
export interface BulkEntityEditConfig {
  /** Rich inline editors + select affordances in the grid. */
  richGrid: boolean;
  /** Identity columns that can't be edited on existing rows in bulk edit. */
  lockedColumns: string[];
  /** Columns hidden in both import and bulk edit. */
  hiddenColumns: string[];
  /** Columns hidden only in bulk edit. */
  bulkEditHiddenColumns: string[];
  /** Columns rendered as single-select dropdowns, with their options. */
  enumColumns: Record<string, DefaultOptionType[]>;
  /** Present when the grid supports adding brand-new rows inline. */
  newRow?: BulkEditNewRowConfig;
  /** Import-wizard upload step copy/variant overrides. */
  importUpload?: BulkEditImportUploadConfig;
  /**
   * Hydrates the bulk edit grid straight from the entity listing (no CSV
   * round-trip) for the "edit selected/filtered rows" entry point. Loaded
   * lazily so the registry stays import-cycle free.
   */
  fetchBulkEditGridFromListing?: (
    args: BulkEditListingGridArgs
  ) => Promise<BulkEditListingGrid>;
}

const toSelectOptions = (values: string[]): DefaultOptionType[] =>
  values.map((value) => ({ label: value, value }));

const toTierSelectOptions = (): DefaultOptionType[] =>
  ['Tier1', 'Tier2', 'Tier3', 'Tier4', 'Tier5'].map((tier) => ({
    label: tier,
    value: `Tier.${tier}`,
  }));

const METRIC_BULK_EDIT_CONFIG: BulkEntityEditConfig = {
  richGrid: true,
  lockedColumns: ['name'],
  // The expression language is set from the language tabs inside the unified
  // Expression code cell, so a separate column would be redundant. The value
  // still round-trips in the CSV.
  hiddenColumns: ['expressionLanguage'],
  bulkEditHiddenColumns: ['relatedMetrics', 'entityStatus'],
  enumColumns: {
    metricType: toSelectOptions(Object.values(MetricType)),
    unitOfMeasurement: toSelectOptions(Object.values(UnitOfMeasurement)),
    granularity: toSelectOptions(Object.values(MetricGranularity)),
    entityStatus: toSelectOptions(Object.values(EntityStatus)),
    tiers: toTierSelectOptions(),
  },
  newRow: {
    defaults: {
      metricType: 'COUNT',
      unitOfMeasurement: 'COUNT',
      granularity: 'DAY',
      expressionLanguage: 'SQL',
    },
    entityLabelKey: 'label.metric',
    hintMessageKey: 'message.bulk-edit-add-metric-hint',
  },
  importUpload: {
    variant: 'compact',
    headingKey: 'message.import-metrics-upload-heading',
    descriptionKey: 'message.import-metrics-upload-description',
    hideRequiredHeaders: true,
  },
  fetchBulkEditGridFromListing: async (args) => {
    const { fetchMetricBulkEditGrid } = await import('./MetricBulkEditListing');

    return fetchMetricBulkEditGrid(args);
  },
};

class EntityBulkEditConfigClassBase {
  public getConfig(entityType?: EntityType): BulkEntityEditConfig | undefined {
    switch (entityType) {
      case EntityType.METRIC:
        return METRIC_BULK_EDIT_CONFIG;
      default:
        return undefined;
    }
  }

  public getEnumColumnOptions(
    entityType?: EntityType
  ): Record<string, DefaultOptionType[]> {
    return this.getConfig(entityType)?.enumColumns ?? {};
  }
}

const entityBulkEditConfigClassBase = new EntityBulkEditConfigClassBase();

export default entityBulkEditConfigClassBase;
export { EntityBulkEditConfigClassBase };
