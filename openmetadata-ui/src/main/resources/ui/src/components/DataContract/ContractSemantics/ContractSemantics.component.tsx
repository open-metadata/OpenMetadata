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
import { Col, Row, Typography } from 'antd';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FailIcon } from '../../../assets/svg/ic-fail.svg';
import { ReactComponent as CheckIcon } from '../../../assets/svg/ic-successful.svg';
import { ReactComponent as DefaultIcon } from '../../../assets/svg/ic-task.svg';
import { SemanticsRule } from '../../../generated/entity/data/dataContract';
import { DataContractResult } from '../../../generated/entity/datacontract/dataContractResult';
import { getContractStatusType } from '../../../utils/DataContract/DataContractUtils';
import StatusBadgeV2 from '../../common/StatusBadge/StatusBadgeV2.component';

const ContractSemantics: React.FC<{
  semantics: SemanticsRule[];
  latestContractResults?: DataContractResult;
  contractStatus?: string;
}> = ({ semantics, latestContractResults, contractStatus }) => {
  const { t } = useTranslation();

  const getSemanticIconPerLastExecution = (semanticName: string) => {
    if (!latestContractResults) {
      return DefaultIcon;
    }
    const isRuleFailed =
      latestContractResults?.semanticsValidation?.failedRules?.find(
        (rule) => rule.ruleName === semanticName
      );

    if (isRuleFailed) {
      return FailIcon;
    }

    return CheckIcon;
  };

  return (
    <Row className="contract-semantic-component-container" gutter={[20, 0]}>
      <Col span={12}>
        <div className="rule-item-container">
          {semantics.map((item) => (
            <div className="rule-item" key={item.rule}>
              <Icon
                className={classNames('rule-icon', {
                  'rule-icon-default': !latestContractResults,
                })}
                component={getSemanticIconPerLastExecution(item.name)}
              />
              <div className="rule-item-content">
                <Typography.Text className="rule-name">
                  {item.name}
                </Typography.Text>
                <Typography.Text className="rule-description">
                  {item.description}
                </Typography.Text>
              </div>
            </div>
          ))}
        </div>
      </Col>
      <Col className="d-flex justify-end" span={12}>
        {contractStatus && (
          <div className="contract-status-container">
            <Typography.Text>{`${t('label.entity-status', {
              entity: t('label.schema'),
            })} :`}</Typography.Text>
            <StatusBadgeV2
              dataTestId="contract-status-card-item-semantics-status"
              label={contractStatus}
              status={getContractStatusType(contractStatus)}
            />
          </div>
        )}
      </Col>
    </Row>
  );
};

export default ContractSemantics;
