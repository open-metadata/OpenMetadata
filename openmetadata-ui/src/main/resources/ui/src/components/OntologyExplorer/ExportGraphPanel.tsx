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

export interface ExportGraphPanelProps {
  onExportPng: () => Promise<void>;
  onExportSvg: () => Promise<void>;
}

const EXPORT_PNG = 'png';
const EXPORT_SVG = 'svg';

const ExportGraphPanel: React.FC<ExportGraphPanelProps> = ({
  onExportPng,
  onExportSvg,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const items = [
    { id: EXPORT_PNG, label: t('label.png-uppercase') },
    { id: EXPORT_SVG, label: t('label.svg-uppercase') },
  ];

  const handleAction = async (key: Key) => {
    setOpen(false);
    if (key === EXPORT_PNG) {
      await onExportPng();
    } else if (key === EXPORT_SVG) {
      await onExportSvg();
    }
  };

  return (
    <Dropdown.Root isOpen={open} onOpenChange={setOpen}>
      <Button
        color="secondary"
        data-testid="ontology-export-graph"
        iconLeading={<Download01 height={20} width={20} />}
        size="sm">
        {t('label.export-graph')}
      </Button>
      <Dropdown.Popover aria-label={t('label.export-graph')}>
        <Dropdown.Menu items={items} onAction={handleAction}>
          {(item) => <Dropdown.Item id={item.id} label={item.label} />}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export default ExportGraphPanel;
