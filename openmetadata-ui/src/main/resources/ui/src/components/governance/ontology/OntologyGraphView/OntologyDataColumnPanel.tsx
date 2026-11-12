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
  Box,
  Button,
  ButtonUtility,
  Typography,
} from '@openmetadata/ui-core-components';
import { XClose } from '@openmetadata/ui-core-components/icons';
import { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BoundColumn,
  OntologyNode,
} from '../../../OntologyExplorer/OntologyExplorer.interface';

const PANEL_CLASS = [
  'tw:absolute tw:top-16 tw:right-3.5 tw:bottom-3.5 tw:z-20 tw:flex tw:w-80 tw:flex-col tw:gap-4',
  'tw:overflow-y-auto tw:rounded-xl tw:border tw:border-secondary tw:bg-surface tw:p-4 tw:shadow-lg',
].join(' ');

interface OntologyDataColumnPanelProps {
  readonly asset: OntologyNode;
  readonly column: BoundColumn;
  readonly onClose: () => void;
  /** Swaps this panel for the detail of the column's asset. */
  readonly onOpenAsset: () => void;
}

interface FieldProps {
  readonly isDanger?: boolean;
  readonly label: string;
  readonly testId: string;
  readonly value: string;
}

const Field = ({ isDanger, label, testId, value }: FieldProps) => (
  <Box direction="col" gap={1}>
    <Typography color="secondary" size="text-xs">
      {label}
    </Typography>
    <Typography
      className="tw:break-all"
      color={isDanger ? 'danger' : undefined}
      data-testid={testId}
      size="text-sm"
      weight="medium">
      {value}
    </Typography>
  </Box>
);

/** The binding behind one column node of Data mode: the column, its property and its asset. */
const OntologyDataColumnPanel = ({
  asset,
  column,
  onClose,
  onOpenAsset,
}: OntologyDataColumnPanelProps) => {
  const { t } = useTranslation();
  const columnName = column.path.join('.');

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
  };

  return (
    // The panel only listens for Escape bubbling up from its own controls.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <aside
      aria-label={columnName}
      className={PANEL_CLASS}
      data-testid="ontology-data-column-panel"
      onKeyDown={handleKeyDown}>
      <Box align="start" gap={2} justify="between">
        <Box className="tw:min-w-0" direction="col" gap={1}>
          <Typography as="h3" size="text-md" weight="semibold">
            {t('label.column')}
          </Typography>
        </Box>
        <ButtonUtility
          color="tertiary"
          data-testid="ontology-data-column-panel-close"
          icon={XClose}
          size="xs"
          tooltip={t('label.close')}
          onClick={onClose}
        />
      </Box>
      <Field
        label={t('label.column')}
        testId="ontology-data-column-panel-column"
        value={column.type ? `${columnName} · ${column.type}` : columnName}
      />
      <Field
        isDanger={!column.isResolved}
        label={t('label.property')}
        testId="ontology-data-column-panel-property"
        value={column.propertyLabel}
      />
      <Field
        label={t('label.asset')}
        testId="ontology-data-column-panel-asset"
        value={asset.label}
      />
      <Box className="tw:mt-auto">
        <Button
          color="secondary"
          data-testid="ontology-data-column-panel-asset-detail"
          size="sm"
          onPress={onOpenAsset}>
          {t('label.ontology-view-asset-detail')}
        </Button>
      </Box>
    </aside>
  );
};

export default OntologyDataColumnPanel;
