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

import { Button, Dropdown, Typography } from '@openmetadata/ui-core-components';
import { Download01 } from '@untitledui/icons';
import React, { useState } from 'react';
import type { Key } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { showErrorToast } from '../../utils/ToastUtils';
import {
  ExportFormat,
  ExportGraphPanelProps,
} from './ExportGraphPanel.interface';

const ExportGraphPanel: React.FC<ExportGraphPanelProps> = ({
  onExportPng,
  onExportSvg,
  onExportJsonLd,
  onExportTurtle,
  onExportRdfXml,
  onExportCsv,
  supportedExports,
  description,
  'data-testid': testId = 'ontology-export-graph',
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const items = [
    { id: ExportFormat.PNG, label: t('label.png-uppercase') },
    ...(onExportSvg
      ? [{ id: ExportFormat.SVG, label: t('label.svg-uppercase') }]
      : []),
    ...(onExportJsonLd
      ? [{ id: ExportFormat.JSONLD, label: t('label.json-ld') }]
      : []),
    ...(onExportTurtle
      ? [{ id: ExportFormat.TURTLE, label: t('label.skos-turtle') }]
      : []),
    ...(onExportRdfXml
      ? [{ id: ExportFormat.RDFXML, label: t('label.owl-rdf-xml') }]
      : []),
    ...(onExportCsv ? [{ id: ExportFormat.CSV, label: t('label.csv') }] : []),
  ];

  const menuItems =
    supportedExports === undefined
      ? items
      : items.filter((item) => supportedExports.includes(item.id));

  const handleAction = async (key: Key) => {
    setExporting(true);
    try {
      if (key === ExportFormat.PNG) {
        await onExportPng();
      } else if (key === ExportFormat.SVG) {
        await onExportSvg?.();
      } else if (key === ExportFormat.JSONLD) {
        await onExportJsonLd?.();
      } else if (key === ExportFormat.TURTLE) {
        await onExportTurtle?.();
      } else if (key === ExportFormat.RDFXML) {
        await onExportRdfXml?.();
      } else if (key === ExportFormat.CSV) {
        await onExportCsv?.();
      }
      setOpen(false);
    } catch (error) {
      showErrorToast(String(error), t('server.entity-fetch-error'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dropdown.Root isOpen={open} onOpenChange={setOpen}>
      <Button
        color="secondary"
        data-testid={testId}
        iconLeading={<Download01 height={20} width={20} />}
        isDisabled={exporting}
        isLoading={exporting}
        size="sm">
        {t('label.export-graph')}
      </Button>
      <Dropdown.Popover aria-label={t('label.export-graph')} placement="top">
        {description && (
          <Typography
            className="tw:px-3 tw:py-2 tw:text-tertiary"
            size="text-xs">
            {description}
          </Typography>
        )}
        <Dropdown.Menu items={menuItems} onAction={handleAction}>
          {(item) => <Dropdown.Item id={item.id} label={item.label} />}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export default ExportGraphPanel;
