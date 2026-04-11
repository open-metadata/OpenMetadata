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

import { Button, Dropdown } from '@openmetadata/ui-core-components';
import { Download01 } from '@untitledui/icons';
import React, { useState } from 'react';
import type { Key } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { showErrorToast } from '../../utils/ToastUtils';

export enum ExportFormat {
  PNG = 'png',
  SVG = 'svg',
  JSONLD = 'jsonld',
  TURTLE = 'turtle',
}
export interface ExportGraphPanelProps {
  supportedExports: ExportFormat[];
  onExportPng: () => Promise<void>;
  onExportSvg?: () => Promise<void>;
  onExportJsonLd?: () => Promise<void>;
  onExportTurtle?: () => Promise<void>;
  'data-testid'?: string;
}

const ExportGraphPanel: React.FC<ExportGraphPanelProps> = ({
  onExportPng,
  onExportSvg,
  onExportJsonLd,
  onExportTurtle,
  supportedExports = [ExportFormat.PNG, ExportFormat.SVG],
  'data-testid': testId = 'ontology-export-graph',
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const items = [
    { id: ExportFormat.PNG, label: t('label.png-uppercase') },
    { id: ExportFormat.SVG, label: `${t('label.svg-uppercase')} (raster)` },
    { id: ExportFormat.JSONLD, label: t('label.json-ld') },
    { id: ExportFormat.TURTLE, label: t('label.turtle-rdf') },
  ];

  const menuItems = items.filter((item) => supportedExports.includes(item.id));

  const handleAction = async (key: Key) => {
    setOpen(false);
    try {
      if (key === ExportFormat.PNG) {
        await onExportPng();
      } else if (key === ExportFormat.SVG) {
        await onExportSvg();
      } else if (key === ExportFormat.JSONLD && onExportJsonLd) {
        await onExportJsonLd();
      } else if (key === ExportFormat.TURTLE && onExportTurtle) {
        await onExportTurtle();
      }
    } catch {
      showErrorToast(t('server.unexpected-error'));
    }
  };

  return (
    <Dropdown.Root isOpen={open} onOpenChange={setOpen}>
      <Button
        color="secondary"
        data-testid={testId}
        iconLeading={<Download01 height={20} width={20} />}
        size="sm">
        {t('label.export-graph')}
      </Button>
      <Dropdown.Popover aria-label={t('label.export-graph')}>
        <Dropdown.Menu items={menuItems} onAction={handleAction}>
          {(item) => <Dropdown.Item id={item.id} label={item.label} />}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export default ExportGraphPanel;
