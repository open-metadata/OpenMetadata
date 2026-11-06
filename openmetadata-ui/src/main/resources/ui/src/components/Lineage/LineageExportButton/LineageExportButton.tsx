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
  ButtonUtility,
  Tooltip,
  TooltipTrigger,
} from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DownloadIcon } from '../../../assets/svg/ic-download.svg';
import { ExportTypes } from '../../../constants/Export.constants';
import { useLineageProvider } from '../../../context/LineageProvider/LineageProvider';

/**
 * Exports the lineage graph as a PNG through the lineage provider, which holds
 * the laid-out nodes and edges and frames and draws them. Render it inside
 * `<LineageProvider>`, as the Lineage page's header is.
 */
const LineageExportButton = () => {
  const { t } = useTranslation();
  const { onExportClick } = useLineageProvider();

  return (
    <Tooltip
      placement="top"
      title={t('label.export-as-type', {
        type: t('label.png-uppercase'),
      })}>
      <TooltipTrigger>
        <ButtonUtility
          data-testid="export-button"
          icon={DownloadIcon}
          onClick={() => onExportClick([ExportTypes.PNG])}
        />
      </TooltipTrigger>
    </Tooltip>
  );
};

export default LineageExportButton;
