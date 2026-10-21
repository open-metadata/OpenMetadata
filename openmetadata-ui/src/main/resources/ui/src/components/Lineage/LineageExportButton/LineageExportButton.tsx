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
import { useTranslation } from 'react-i18next';
import { ExportTypes } from '../../../constants/Export.constants';
import { useLineageHandlers } from '../Lineage/LineageHandlersContext';

const LineageExportButton = () => {
  const { t } = useTranslation();
  const { onExportClick } = useLineageHandlers();

  return (
    <ButtonUtility
      data-testid="export-button"
      icon={Download01}
      tooltip={t('label.export-as-type', {
        type: t('label.png-uppercase'),
      })}
      onClick={() => onExportClick([ExportTypes.PNG])}
    />
  );
};

export default LineageExportButton;
