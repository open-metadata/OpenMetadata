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
import { CellRenderer } from '../../../../components/common/atoms/shared/types';
import { ColumnGridRowData } from '../ColumnGrid.interface';

interface UseColumnGridRenderersConfig {
  renderColumnNameCell?: (props: { row: ColumnGridRowData }) => React.ReactNode;
  renderPathCell?: (props: { row: ColumnGridRowData }) => React.ReactNode;
  renderDescriptionCell?: (props: {
    row: ColumnGridRowData;
  }) => React.ReactNode;
  renderTagsCell?: (props: { row: ColumnGridRowData }) => React.ReactNode;
  renderGlossaryTermsCell?: (props: {
    row: ColumnGridRowData;
  }) => React.ReactNode;
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

  const renderers: CellRenderer<ColumnGridRowData> = useMemo(
    () => ({
      columnName: renderColumnNameCell || (() => null),
      path: renderPathCell || (() => null),
      description: renderDescriptionCell || (() => null),
      tags: renderTagsCell || (() => null),
      glossaryTerms: renderGlossaryTermsCell || (() => null),
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
