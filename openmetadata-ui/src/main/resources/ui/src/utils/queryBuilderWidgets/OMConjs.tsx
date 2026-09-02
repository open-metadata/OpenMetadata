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
import { ButtonGroup, ButtonGroupItem } from '@openmetadata/ui-core-components';
import type { ConjsProps } from '@react-awesome-query-builder/ui';
import type { FC } from 'react';
import type { Key } from 'react-aria-components';

const OMConjs: FC<ConjsProps> = ({
  selectedConjunction,
  setConjunction,
  conjunctionOptions,
  readonly,
}) => {
  const options = Object.entries(conjunctionOptions ?? {});

  return (
    <ButtonGroup
      data-testid="advanced-search-conjunction"
      isDisabled={readonly}
      selectedKeys={
        selectedConjunction ? new Set([selectedConjunction]) : new Set<Key>()
      }
      selectionMode="single"
      onSelectionChange={(keys: Set<Key>) => {
        const key = keys.values().next().value;
        if (key !== undefined) {
          setConjunction(String(key));
        }
      }}>
      {options.map(([key, opt]) => (
        <ButtonGroupItem
          // AND/OR read as logical operators, so they are uppercased for
          // display. The transform is CSS rather than a rewritten string so the
          // label stays whatever the config (and any translation of it) says.
          className="tw:uppercase"
          data-testid={`advanced-search-conjunction-${key.toLowerCase()}`}
          id={key}
          key={key}>
          {opt.label}
        </ButtonGroupItem>
      ))}
    </ButtonGroup>
  );
};

export default OMConjs;
