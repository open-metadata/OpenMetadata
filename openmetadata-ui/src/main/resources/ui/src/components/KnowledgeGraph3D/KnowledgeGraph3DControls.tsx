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

import {
  Button,
  ButtonGroup,
  ButtonGroupItem,
  Checkbox,
  Select,
} from '@openmetadata/ui-core-components';
import { Download01, RefreshCw01 } from '@untitledui/icons';
import { FC, useCallback } from 'react';
import type { Key, Selection } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { KnowledgeGraph3DControlsProps } from './KnowledgeGraph3D.interface';
import { Lens, Level } from './types';

const DEPTH_OPTIONS = [1, 2, 3, 4, 5];

const firstKey = (keys: Selection): Key | undefined => {
  let value: Key | undefined;
  if (keys !== 'all') {
    value = [...keys][0];
  }

  return value;
};

const KnowledgeGraph3DControls: FC<KnowledgeGraph3DControlsProps> = ({
  level,
  lens,
  gaps,
  showColumns,
  columnsToggleLabel,
  depth,
  hasGraph,
  onLevelChange,
  onLensChange,
  onGapsChange,
  onShowColumnsChange,
  onDepthChange,
  onResetView,
  onExport,
}) => {
  const { t } = useTranslation();

  const handleLevel = useCallback(
    (keys: Selection) => {
      const next = firstKey(keys);
      if (next) {
        onLevelChange(next as Level);
      }
    },
    [onLevelChange]
  );

  const handleLens = useCallback(
    (keys: Selection) => {
      const next = firstKey(keys);
      if (next) {
        onLensChange(next as Lens);
      }
    },
    [onLensChange]
  );

  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-4 tw:px-6 tw:py-3.5">
      <div className="tw:flex tw:items-center tw:gap-2.5">
        <span className="tw:text-sm tw:font-medium tw:text-tertiary">
          {t('label.level')}
        </span>
        <ButtonGroup
          disallowEmptySelection
          aria-label={t('label.level')}
          selectedKeys={new Set([level])}
          size="sm"
          onSelectionChange={handleLevel}>
          <ButtonGroupItem id="asset">{t('label.data-asset')}</ButtonGroupItem>
          <ButtonGroupItem id="product">
            {t('label.data-product')}
          </ButtonGroupItem>
          <ButtonGroupItem id="domain">{t('label.domain')}</ButtonGroupItem>
        </ButtonGroup>
      </div>

      <div className="tw:flex tw:items-center tw:gap-2.5">
        <span className="tw:text-sm tw:font-medium tw:text-tertiary">
          {t('label.relationship-plural')}
        </span>
        <ButtonGroup
          disallowEmptySelection
          aria-label={t('label.relationship-plural')}
          selectedKeys={new Set([lens])}
          size="sm"
          onSelectionChange={handleLens}>
          <ButtonGroupItem id="all">{t('label.all')}</ButtonGroupItem>
          <ButtonGroupItem id="technical">
            {t('label.knowledge-graph')}
          </ButtonGroupItem>
          <ButtonGroupItem id="ontology">{t('label.ontology')}</ButtonGroupItem>
        </ButtonGroup>
      </div>

      <div className="tw:flex tw:items-center tw:gap-2.5">
        <span className="tw:text-sm tw:font-medium tw:text-tertiary">
          {t('label.depth')}
        </span>
        <Select
          aria-label={t('label.depth')}
          className="tw:w-20"
          selectedKey={String(depth)}
          size="sm"
          onSelectionChange={(key) => onDepthChange(Number(key))}>
          {DEPTH_OPTIONS.map((value) => (
            <Select.Item id={String(value)} key={value} label={String(value)} />
          ))}
        </Select>
      </div>

      <Checkbox
        isSelected={showColumns}
        label={columnsToggleLabel}
        size="sm"
        onChange={onShowColumnsChange}
      />

      <Checkbox
        isSelected={gaps}
        label={t('label.highlight-coverage-gap-plural')}
        size="sm"
        onChange={onGapsChange}
      />

      <div className="tw:ml-auto tw:flex tw:items-center tw:gap-2">
        <Button
          color="secondary"
          iconLeading={RefreshCw01}
          isDisabled={!hasGraph}
          size="sm"
          onPress={onResetView}>
          {t('label.reset-view')}
        </Button>
        <Button
          color="secondary"
          iconLeading={Download01}
          isDisabled={!hasGraph}
          size="sm"
          onPress={onExport}>
          {t('label.export')}
        </Button>
      </div>
    </div>
  );
};

export default KnowledgeGraph3DControls;
