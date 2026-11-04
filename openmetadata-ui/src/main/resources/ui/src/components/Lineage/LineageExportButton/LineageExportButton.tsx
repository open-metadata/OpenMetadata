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
import { ButtonUtility } from '@openmetadata/ui-core-components';
import { Download01 } from '@openmetadata/ui-core-components/icons';
import { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ExportTypes,
  LINEAGE_EXPORT_SELECTOR,
} from '../../../constants/Export.constants';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { getLineagePngExportOptions } from '../../../utils/CanvasUtils';
import { getCurrentISODate } from '../../../utils/date-time/DateTimeUtils';
import { useEntityExportModalProvider } from '../../Entity/EntityExportModalProvider/EntityExportModalProvider.component';

interface LineageExportButtonProps {
  size?: ComponentProps<typeof ButtonUtility>['size'];
}

/**
 * Exports the lineage map as a PNG. The map publishes the graph it draws to
 * the lineage store, so this needs no `<Lineage>` context and also works in
 * the AI-mode page header, which sits outside it.
 */
const LineageExportButton = ({ size }: LineageExportButtonProps) => {
  const { t } = useTranslation();
  const { showModal } = useEntityExportModalProvider();

  const handleExport = () => {
    const { nodes, edges } = useLineageStore.getState();

    showModal({
      name: `${t('label.lineage')}_${getCurrentISODate()}`,
      title: t('label.lineage'),
      exportTypes: [ExportTypes.PNG],
      documentSelector: LINEAGE_EXPORT_SELECTOR,
      ...getLineagePngExportOptions(nodes, edges),
      onExport: async () => '',
    });
  };

  return (
    <ButtonUtility
      data-testid="export-button"
      icon={Download01}
      size={size}
      tooltip={t('label.export-as-type', {
        type: t('label.png-uppercase'),
      })}
      onClick={handleExport}
    />
  );
};

export default LineageExportButton;
