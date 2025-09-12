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

import { ReactNode, useMemo } from 'react';
import { EntityName } from '../../../common/EntityName/EntityName.component';
import { OwnerLabel } from '../../../common/OwnerLabel/OwnerLabel.component';
import { TagsViewer } from '../../../Tag/TagsViewer/TagsViewer';
import { CellRenderer, ColumnConfig } from '../types';

interface UseCellRendererProps<T> {
  columns: ColumnConfig<T>[];
  renderers?: CellRenderer<T>;
}

export const useCellRenderer = <
  T extends { id: string; name?: string; displayName?: string }
>(
  props: UseCellRendererProps<T>
) => {
  const { columns, renderers = {} } = props;

  const defaultRenderers: CellRenderer<T> = useMemo(
    () => ({
      entityName: (entity: T) => (
        <EntityName
          displayName={entity.displayName}
          name={entity.displayName || entity.name || ''}
        />
      ),
      owners: (entity: T) => {
        const owners = (entity as any).owners || [];

        return <OwnerLabel owners={owners} />;
      },
      tags: (entity: T, column?: ColumnConfig<T>) => {
        const tags = column?.getValue
          ? column.getValue(entity)
          : (entity as any).tags || [];

        return <TagsViewer tags={tags} />;
      },
      text: (entity: T, column?: ColumnConfig<T>) => {
        const value = column?.getValue
          ? column.getValue(entity)
          : (entity as any)[column?.key || ''];

        return <span>{value || '-'}</span>;
      },
      custom: (entity: T, column?: ColumnConfig<T>) => {
        if (column?.customRenderer && renderers[column.customRenderer]) {
          return renderers[column.customRenderer](entity);
        }

        return <span>-</span>;
      },
    }),
    [renderers]
  );

  const renderCell = useMemo(
    () =>
      (entity: T, column: ColumnConfig<T>): ReactNode => {
        const allRenderers = { ...defaultRenderers, ...renderers };
        const renderer = allRenderers[column.render];

        if (renderer) {
          return renderer(entity, column);
        }

        return <span>-</span>;
      },
    [defaultRenderers, renderers]
  );

  return {
    renderCell,
    defaultRenderers,
    allRenderers: { ...defaultRenderers, ...renderers },
  };
};
