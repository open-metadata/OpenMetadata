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
import { useTranslation } from 'react-i18next';
import { ReactComponent as BookOutline } from '../../../assets/svg/bookoutline.svg';
import { ReactComponent as CodeOutline } from '../../../assets/svg/codeOutline.svg';
import { DataContractMode } from '../../../constants/DataContract.constants';
import {
  SEGMENT_TOGGLE_GROUP_CLASS,
  SEGMENT_TOGGLE_ITEM_CLASS,
} from '../../../constants/SegmentToggle.constants';

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
      className={SEGMENT_TOGGLE_GROUP_CLASS}
      data-testid="contract-view-switch"
      selectedKeys={[mode]}
      size="sm"
      onSelectionChange={(keys) => {
        const [selected] = [...keys];
        // YAML is enum value 0, so test for presence, not truthiness.
        if (selected !== undefined) {
          handleModeChange(selected as DataContractMode);
        }
      }}>
      <ButtonGroupItem
        aria-label={t('label.editor')}
        className={SEGMENT_TOGGLE_ITEM_CLASS}
        id={DataContractMode.UI}>
        <BookOutline
          className="tw:size-5"
          data-testid="contract-view-switch-tab-ui"
        />
      </ButtonGroupItem>
      <ButtonGroupItem
        aria-label={t('label.code')}
        className={SEGMENT_TOGGLE_ITEM_CLASS}
        id={DataContractMode.YAML}>
        <CodeOutline
          className="tw:size-5"
          data-testid="contract-view-switch-tab-yaml"
        />
      </ButtonGroupItem>
    </ButtonGroup>
  );
};

export default ContractViewSwitchTab;
