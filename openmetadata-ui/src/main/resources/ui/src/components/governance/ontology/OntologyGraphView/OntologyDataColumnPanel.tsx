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
import { Box, Button, Typography } from '@openmetadata/ui-core-components';
import { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BoundColumn,
  OntologyNode,
} from '../../../OntologyExplorer/OntologyExplorer.interface';
import { getAssetPath } from '../OntologyConceptInspector/OntologyConceptInspector.utils';
import { AssetPanelHeader } from './OntologyDataAssetPanel';
import {
  DATA_PANEL_CLASS,
  DATA_PANEL_SECTION_CLASS,
} from './OntologyGraphView.constants';

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

/** One label and value row, laid out as the asset panel's bound columns are. */
const Field = ({ isDanger, label, testId, value }: FieldProps) => (
  <li className="tw:flex tw:items-baseline tw:justify-between tw:gap-3">
    <Typography className="tw:shrink-0" color="secondary" size="text-xs">
      {label}
    </Typography>
    <Typography
      ellipsis
      color={isDanger ? 'danger' : undefined}
      data-testid={testId}
      size="text-xs"
      weight="medium">
      {value}
    </Typography>
  </li>
);

/** The binding behind one column node of Data mode, in the same card as the asset detail. */
const OntologyDataColumnPanel = ({
  asset,
  column,
  onClose,
  onOpenAsset,
}: OntologyDataColumnPanelProps) => {
  const { t } = useTranslation();
  const columnName = column.path.join('.');
  const fullyQualifiedName = asset.entityRef?.fullyQualifiedName;

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
      className={DATA_PANEL_CLASS}
      data-testid="ontology-data-column-panel"
      onKeyDown={handleKeyDown}>
      <AssetPanelHeader
        fullyQualifiedName={fullyQualifiedName}
        name={columnName}
        nameTestId="ontology-data-column-panel-column"
        path={getAssetPath(fullyQualifiedName)}
        serviceLabel={column.type}
        testIdPrefix="ontology-data-column-panel"
        typeLabel={t('label.column')}
        onClose={onClose}
      />
      <Box className={DATA_PANEL_SECTION_CLASS} direction="col" gap={2}>
        <ul className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-1.5 tw:p-0">
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
        </ul>
      </Box>
      <Box
        align="center"
        className={DATA_PANEL_SECTION_CLASS}
        gap={2}
        justify="end">
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
