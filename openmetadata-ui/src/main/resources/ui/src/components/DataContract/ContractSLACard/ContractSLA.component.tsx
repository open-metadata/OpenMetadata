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
import Icon from '@ant-design/icons';
import classNames from 'classnames';
import { ReactComponent as DefaultIcon } from '../../../assets/svg/ic-task.svg';
import { DataContract } from '../../../generated/entity/data/dataContract';
import './contract-sla.less';

const ContractSLA: React.FC<{
  contract: DataContract;
}> = ({ contract }) => {
  const latestContractResults = true;

  return (
    <div className="rule-item-container">
      {(contract?.semantics ?? []).map((item) => (
        <div className="rule-item">
          <Icon
            className={classNames('rule-icon', {
              'rule-icon-default': !latestContractResults,
            })}
            component={DefaultIcon}
          />
          <span className="rule-name">{item.name}</span>
        </div>
      ))}
    </div>
  );
};

export default ContractSLA;
