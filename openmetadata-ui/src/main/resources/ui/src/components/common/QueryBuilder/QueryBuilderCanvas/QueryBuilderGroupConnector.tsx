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
import { Box, Divider, Select } from '@openmetadata/ui-core-components';
import { FC, useMemo } from 'react';
import type { QueryBuilderGroupConnectorProps } from './QueryBuilderCanvas.types';

// The vertical run between two cards.
const LINE_CLASS = 'tw:ml-6 tw:h-8 tw:self-auto';

// How two sibling cards combine.
const QueryBuilderGroupConnector: FC<QueryBuilderGroupConnectorProps> = ({
  conjunction,
  conjunctions,
  readonly,
  onChange,
}) => {
  const items = useMemo(
    () => conjunctions.map((key) => ({ id: key, label: key })),
    [conjunctions]
  );

  return (
    <Box
      align="start"
      data-testid="query-builder-group-connector"
      direction="col">
      <Divider className={LINE_CLASS} orientation="vertical" />

      <Select
        aria-label={conjunction}
        className="tw:ml-2.5 tw:[&_button]:bg-secondary tw:[&_button]:py-1 tw:[&_button]:outline-secondary"
        data-testid="advanced-search-group-conjunction"
        isDisabled={readonly || conjunctions.length < 2}
        items={items}
        selectedKey={conjunction}
        size="sm"
        onSelectionChange={(key) => key != null && onChange(String(key))}>
        {(item) => (
          <Select.Item id={String(item.id)} key={String(item.id)}>
            {String(item.label ?? item.id)}
          </Select.Item>
        )}
      </Select>

      <Divider className={LINE_CLASS} orientation="vertical" />
    </Box>
  );
};

export default QueryBuilderGroupConnector;
