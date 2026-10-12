/*
 *  Copyright 2025 Collate.
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
import { ButtonGroup, ButtonGroupItem } from '@openmetadata/ui-core-components';
import { BookOpen01, Code01 } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import { DataContractMode } from '../../../constants/DataContract.constants';
const ContractViewSwitchTab = ({
  mode,
  handleModeChange,
}: {
  mode: DataContractMode;
  handleModeChange: (mode: DataContractMode) => void;
}) => {
  const { t } = useTranslation();

  return (
    <ButtonGroup
      disallowEmptySelection
      aria-label={t('label.view')}
      selectedKeys={new Set([mode])}
      onSelectionChange={(keys) =>
        handleModeChange([...keys][0] as DataContractMode)
      }>
      <ButtonGroupItem
        aria-label={t('label.user-interface')}
        data-testid="contract-view-switch-tab-ui"
        iconLeading={BookOpen01}
        id={DataContractMode.UI}
      />
      <ButtonGroupItem
        aria-label={t('label.code')}
        data-testid="contract-view-switch-tab-yaml"
        iconLeading={Code01}
        id={DataContractMode.YAML}
      />
    </ButtonGroup>
  );
};

export default ContractViewSwitchTab;
