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
import { Col, Divider, Typography } from 'antd';
import { isEmpty, lowerCase } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DefaultIcon } from '../../../assets/svg/ic-task.svg';
import { DATA_CONTRACT_SLA } from '../../../constants/DataContract.constants';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { Table } from '../../../generated/entity/data/table';
import { Transi18next } from '../../../utils/CommonUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import './contract-sla.less';

const ContractSLA: React.FC<{
  contract: DataContract;
}> = ({ contract }) => {
  const { t } = useTranslation();
  const { data: tableData } = useGenericContext();

  const tableColumnNameMap = useMemo(() => {
    const columns = (tableData as Table).columns;
    if (!isEmpty(columns)) {
      const tableColumnNamesObject = new Map<string, string>();

      columns.forEach((item) =>
        tableColumnNamesObject.set(
          item.fullyQualifiedName ?? '',
          getEntityName(item)
        )
      );

      return tableColumnNamesObject;
    }

    return null;
  }, [tableData]);

  const renderSLAData = useMemo(() => {
    if (isEmpty(contract.sla)) {
      return [];
    }

    const slaList = [];

    if (contract.sla?.refreshFrequency) {
      slaList.push({
        key: DATA_CONTRACT_SLA.REFRESH_FREQUENCY,
        label: (
          <Transi18next
            i18nKey="message.freshness-sla-description"
            renderElement={<strong />}
            values={{
              label: t('label.freshness'),
              data: `${contract.sla?.refreshFrequency.interval} ${lowerCase(
                contract.sla?.refreshFrequency.unit
              )}`,
            }}
          />
        ),
      });
    }

    if (contract.sla?.availabilityTime) {
      slaList.push({
        key: DATA_CONTRACT_SLA.TIME_AVAILABILITY,
        label: (
          <Transi18next
            i18nKey="message.completeness-sla-description"
            renderElement={<strong />}
            values={{
              label: t('label.completeness'),
              data: `${contract.sla?.availabilityTime}`,
            }}
          />
        ),
      });
    }

    if (contract.sla?.maxLatency) {
      slaList.push({
        key: DATA_CONTRACT_SLA.MAX_LATENCY,
        label: (
          <Transi18next
            i18nKey="message.latency-sla-description"
            renderElement={<strong />}
            values={{
              label: t('label.latency'),
              data: `${contract.sla?.maxLatency?.value} ${lowerCase(
                contract.sla?.maxLatency?.unit
              )}`,
            }}
          />
        ),
      });
    }

    if (contract.sla?.retention) {
      slaList.push({
        key: DATA_CONTRACT_SLA.RETENTION,
        label: (
          <Transi18next
            i18nKey="message.retention-sla-description"
            renderElement={<strong />}
            values={{
              label: t('label.retention'),
              data: `${contract.sla?.retention?.period} ${lowerCase(
                contract.sla?.retention?.unit
              )}`,
            }}
          />
        ),
      });
    }

    if (contract.sla?.columnName) {
      slaList.push({
        key: DATA_CONTRACT_SLA.COLUMN_NAME,
        label: (
          <Transi18next
            i18nKey="message.column-name-sla-description"
            renderElement={<strong />}
            values={{
              label: t('label.column'),
              data: tableColumnNameMap?.get(contract.sla?.columnName ?? ''),
            }}
          />
        ),
      });
    }

    return slaList;
  }, [contract.sla, tableColumnNameMap]);

  if (isEmpty(renderSLAData)) {
    return null;
  }

  return (
    <Col
      className="contract-card-items"
      data-testid="contract-sla-card"
      span={24}>
      <div className="contract-card-header-container">
        <Typography.Text className="contract-card-header">
          {t('label.service-level-agreement')}
        </Typography.Text>
        <Divider className="contract-dash-separator" />
      </div>

      <div className="sla-item-container">
        {renderSLAData.map((item) => (
          <div className="sla-item" key={item.key}>
            <Icon className="sla-icon" component={DefaultIcon} />
            <span className="sla-description">{item.label}</span>
          </div>
        ))}
      </div>
    </Col>
  );
};

export default ContractSLA;
