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
import { Radio, RadioChangeEvent } from 'antd';
import BookOutline from '../../../assets/svg/bookoutline.svg?react';
import CodeOutline from '../../../assets/svg/codeOutline.svg?react';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { DataContractMode } from '../../../constants/DataContract.constants';
import './contract-view-switch-tab.less';

const ContractViewSwitchTab = ({
  mode,
  handleModeChange,
}: {
  mode: DataContractMode;
  handleModeChange: (e: RadioChangeEvent) => void;
}) => {
  return (
    <Radio.Group
      className="contract-mode-radio-group"
      optionType="button"
      options={[
        {
          label: (
            <CodeOutline
              className="align-middle"
              color={DE_ACTIVE_COLOR}
              data-testid="contract-view-switch-tab-yaml"
              height={20}
              width={20}
            />
          ),
          value: DataContractMode.YAML,
        },
        {
          label: (
            <BookOutline
              className="align-middle"
              color={DE_ACTIVE_COLOR}
              data-testid="contract-view-switch-tab-ui"
              height={20}
              width={20}
            />
          ),
          value: DataContractMode.UI,
        },
      ]}
      value={mode}
      onChange={handleModeChange}
    />
  );
};

export default ContractViewSwitchTab;
