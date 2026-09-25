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
import {
  Box,
  Typography as CoreTypography,
} from '@openmetadata/ui-core-components';
import {
  FailedTests,
  MinusCircle,
  SuccessfulTests,
} from '@openmetadata/ui-core-components/icons';
import { Col, Divider, Tooltip, Typography } from 'antd';
import { isEmpty, lowerCase } from 'lodash';
import { ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as InheritIcon } from '../../../assets/svg/ic-inherit.svg';
import { ReactComponent as DefaultIcon } from '../../../assets/svg/ic-task.svg';
import { DATA_CONTRACT_SLA } from '../../../constants/DataContract.constants';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { Table } from '../../../generated/entity/data/table';
import {
  DataContractResult,
  RefreshedAtSource,
  SlaValidation,
} from '../../../generated/entity/datacontract/dataContractResult';
import { getContractStatusType } from '../../../utils/DataContract/DataContractUtils';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { Transi18next } from '../../../utils/i18next/LocalUtil';
import StatusBadgeV2 from '../../common/StatusBadge/StatusBadgeV2.component';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import './contract-sla.less';

const SLA_ICON_SIZE = 16;

/** The requirements contract validation checks, and where their outcome is. */
const SLA_CHECK_OUTCOME: Partial<
  Record<string, (validation: SlaValidation) => boolean | undefined>
> = {
  [DATA_CONTRACT_SLA.REFRESH_FREQUENCY]: (validation) =>
    validation.refreshFrequencyMet,
  [DATA_CONTRACT_SLA.TIME_AVAILABILITY]: (validation) =>
    validation.availabilityMet,
  [DATA_CONTRACT_SLA.MAX_LATENCY]: (validation) => validation.latencyMet,
};

const REFRESH_SOURCE_LABEL: Record<RefreshedAtSource, string> = {
  [RefreshedAtSource.SlaColumnProfile]: 'label.column-profile',
  [RefreshedAtSource.SystemProfile]: 'label.system-metric-plural',
  [RefreshedAtSource.LifeCycle]: 'label.life-cycle',
};

const ContractSLA: React.FC<{
  contract: DataContract;
  latestContractResults?: DataContractResult;
  contractStatus?: string;
}> = ({ contract, latestContractResults, contractStatus }) => {
  const { t } = useTranslation();
  const { data: tableData } = useGenericContext();
  const slaValidation = latestContractResults?.slaValidation;

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

  const renderOutcomeIcon = (key: string): ReactNode => {
    const outcomeOf = SLA_CHECK_OUTCOME[key];
    if (!slaValidation || !outcomeOf) {
      return <Icon className="sla-icon" component={DefaultIcon} />;
    }
    const met = outcomeOf(slaValidation);
    if (met === true) {
      return (
        <SuccessfulTests
          aria-hidden={false}
          aria-label={t('label.passed')}
          className="sla-icon tw:text-fg-success-primary"
          data-testid={`sla-${key}-passed`}
          role="img"
          size={SLA_ICON_SIZE}
        />
      );
    }

    return met === false ? (
      <FailedTests
        aria-hidden={false}
        aria-label={t('label.failed')}
        className="sla-icon tw:text-fg-error-primary"
        data-testid={`sla-${key}-failed`}
        role="img"
        size={SLA_ICON_SIZE}
      />
    ) : (
      <MinusCircle
        aria-hidden={false}
        aria-label={t('label.not-evaluated')}
        className="sla-icon tw:text-fg-quaternary"
        data-testid={`sla-${key}-not-evaluated`}
        role="img"
        size={SLA_ICON_SIZE}
      />
    );
  };

  if (isEmpty(renderSLAData)) {
    return null;
  }

  const inheritedIcon = contract.sla?.inherited ? (
    <Tooltip
      title={t('label.inherited-entity', {
        entity: t('label.service-level-agreement'),
      })}>
      <InheritIcon className="inherit-icon cursor-pointer" width={14} />
    </Tooltip>
  ) : null;

  return (
    <Col
      className="contract-card-items"
      data-testid="contract-sla-card"
      span={24}>
      <div className="contract-card-header-container">
        <div className="d-flex items-center gap-1">
          <Typography.Text className="contract-card-header">
            {t('label.service-level-agreement')}
          </Typography.Text>
          {inheritedIcon}
        </div>
        <Divider className="contract-dash-separator" />
      </div>

      <div className="sla-item-container">
        {renderSLAData.map((item) => (
          <div className="sla-item" key={item.key}>
            {renderOutcomeIcon(item.key)}
            <span className="sla-description">{item.label}</span>
          </div>
        ))}
      </div>

      {slaValidation && (
        <Box
          className="tw:mt-3"
          data-testid="sla-validation-result"
          direction="col"
          gap={1}>
          {contractStatus && (
            <Box align="center" gap={2}>
              <CoreTypography size="text-sm">
                {`${t('label.entity-status', {
                  entity: t('label.service-level-agreement'),
                })} :`}
              </CoreTypography>
              <StatusBadgeV2
                dataTestId="contract-status-card-item-sla-status"
                label={contractStatus}
                status={getContractStatusType(contractStatus)}
              />
            </Box>
          )}
          {slaValidation.lastRefreshedAt && slaValidation.refreshedAtSource && (
            <CoreTypography
              color="secondary"
              data-testid="sla-last-refreshed"
              size="text-sm">
              {t('message.sla-last-refreshed', {
                time: formatDateTime(slaValidation.lastRefreshedAt),
                source: t(
                  REFRESH_SOURCE_LABEL[slaValidation.refreshedAtSource]
                ),
              })}
            </CoreTypography>
          )}
          {slaValidation.message && (
            <CoreTypography
              color="secondary"
              data-testid="sla-validation-message"
              size="text-sm">
              {slaValidation.message}
            </CoreTypography>
          )}
        </Box>
      )}
    </Col>
  );
};

export default ContractSLA;
