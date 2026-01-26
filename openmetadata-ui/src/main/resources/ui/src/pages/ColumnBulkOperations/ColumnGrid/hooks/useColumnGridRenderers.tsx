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

import { useMemo } from 'react';
import {
  CellRenderer,
  ColumnConfig,
} from '../../../../components/common/atoms/shared/types';
import { ColumnGridRowData } from '../ColumnGrid.interface';

interface UseColumnGridRenderersConfig {
  renderColumnNameCell?: (
    entity: ColumnGridRowData,
    column?: ColumnConfig<ColumnGridRowData>
  ) => React.ReactNode;
  renderPathCell?: (
    entity: ColumnGridRowData,
    column?: ColumnConfig<ColumnGridRowData>
  ) => React.ReactNode;
  renderDescriptionCell?: (
    entity: ColumnGridRowData,
    column?: ColumnConfig<ColumnGridRowData>
  ) => React.ReactNode;
  renderTagsCell?: (
    entity: ColumnGridRowData,
    column?: ColumnConfig<ColumnGridRowData>
  ) => React.ReactNode;
  renderGlossaryTermsCell?: (
    entity: ColumnGridRowData,
    column?: ColumnConfig<ColumnGridRowData>
  ) => React.ReactNode;
}

export const useColumnGridRenderers = (
  config: UseColumnGridRenderersConfig = {}
): { renderers: CellRenderer<ColumnGridRowData> } => {
  const {
    renderColumnNameCell,
    renderPathCell,
    renderDescriptionCell,
    renderTagsCell,
    renderGlossaryTermsCell,
  } = config;

  const defaultRenderer = () => null;

  const renderers: CellRenderer<ColumnGridRowData> = useMemo(
    () => ({
      columnName: renderColumnNameCell ?? defaultRenderer,
      path: renderPathCell ?? defaultRenderer,
      description: renderDescriptionCell ?? defaultRenderer,
      tags: renderTagsCell ?? defaultRenderer,
      glossaryTerms: renderGlossaryTermsCell ?? defaultRenderer,
    }),
    [
      renderColumnNameCell,
      renderPathCell,
      renderDescriptionCell,
      renderTagsCell,
      renderGlossaryTermsCell,
    ]
  );

  return { renderers };
};
