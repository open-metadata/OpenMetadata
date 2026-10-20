/*
 *  Copyright 2024 Collate.
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

import { Box, HintText } from '@openmetadata/ui-core-components';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import FormCardSection from '../../../components/common/FormCardSection/FormCardSection';
import { useAlertSelectionContext } from '../../../hooks/useAlertSelection';
import AlertSourcePicker from '../AlertSourcePicker/AlertSourcePicker';
import { AlertFormSourceItemProps } from './AlertFormSourceItem.interface';

function AlertFormSourceItem({
  filterResources,
  isViewMode = false,
  value = [],
  onChange,
  error,
}: Readonly<AlertFormSourceItemProps>) {
  const { t } = useTranslation();
  const { capabilities } = useAlertSelectionContext();

  const sourceNames = useMemo(
    () => (filterResources ?? []).map((resource) => resource.name ?? ''),
    [filterResources]
  );

  return (
    <FormCardSection
      heading={t('label.source')}
      subHeading={t('message.alerts-source-description')}>
      <Box
        align="start"
        className="source-input-container"
        direction="col"
        gap={2}>
        <AlertSourcePicker
          isDisabled={isViewMode}
          isInvalid={Boolean(error)}
          selection={capabilities.selection}
          sources={sourceNames}
          value={value}
          onChange={onChange}
        />
        {error && <HintText isInvalid>{error}</HintText>}
      </Box>
    </FormCardSection>
  );
}

export default AlertFormSourceItem;
