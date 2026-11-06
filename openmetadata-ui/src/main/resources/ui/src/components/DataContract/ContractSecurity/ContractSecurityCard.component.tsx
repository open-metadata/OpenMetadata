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
import {
  Badge,
  Card,
  Divider,
  Grid,
  Typography,
} from '@openmetadata/ui-core-components';
import { getLayoutGutter } from '../../../utils/common/layout.utils';

import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import {
  ContractSecurity,
  RowFilter,
} from '../../../generated/entity/data/dataContract';
import { Table } from '../../../generated/entity/data/table';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import './contract-security.less';

const renderRowFilterValues = (filter: RowFilter) =>
  filter.values?.map((item, index) => (
    <span className="row-filter-value">{`${item}${
      filter.values?.length === index + 1 ? '' : ','
    }`}</span>
  ));

const ContractSecurityCard: React.FC<{
  security?: ContractSecurity;
}> = ({ security }) => {
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

  const renderSecurityPolicies = useMemo(() => {
    return security?.policies?.map((policy, index) => (
      <Card className="contract-security-policy-card tw:overflow-visible tw:text-sm tw:leading-[1.5715] tw:text-primary tw:tabular-nums">
        <div
          className={classNames(
            'tw:-mb-px tw:flex tw:min-h-12 tw:items-center tw:border-b',
            'tw:border-black/6 tw:px-3.5 tw:py-3 tw:text-base tw:leading-[1.5715]',
            'tw:font-medium tw:text-black/85 tw:dark:border-secondary',
            'tw:dark:text-primary'
          )}>
          <div className="tw:inline-block tw:flex-1 tw:overflow-hidden tw:text-ellipsis tw:whitespace-nowrap">
            <Typography className="access-policy-label">{`${t(
              'label.access-policy'
            )}: `}</Typography>
            <Typography
              className="access-policy-value"
              data-testid={`contract-security-access-policy-${index}`}>
              {policy.accessPolicy || NO_DATA_PLACEHOLDER}
            </Typography>
          </div>
        </div>
        <div className="tw:rounded-xl tw:border-t tw:border-utility-gray-200 tw:py-3 tw:pl-3">
          <div className="contract-security-policy-card-identity-container">
            <Typography className="contract-security-policy-subtitle-label">
              {t('label.identities')}
            </Typography>

            {isEmpty(policy.identities)
              ? NO_DATA_PLACEHOLDER
              : policy.identities?.map((identity) => (
                  <Badge
                    bordered={false}
                    className="tw:mr-2.5 tw:mb-2.5 tw:inline-flex tw:max-w-full tw:whitespace-normal tw:font-medium"
                    color="gray"
                    data-testid={`contract-security-identities-${index}-${identity}`}
                    key={identity}
                    size="sm"
                    type="color">
                    {identity}
                  </Badge>
                ))}
          </div>

          {!isEmpty(policy.rowFilters) && (
            <>
              <Divider dashed className="contract-dash-separator" />

              <div className="contract-security-policy-card-row-filter-container">
                <Typography className="contract-security-policy-subtitle-label">
                  {t('label.row-filter-plural')}
                </Typography>

                {policy.rowFilters?.map((filter, filterIndex) => {
                  return (
                    <Badge
                      bordered={false}
                      className="tw:mr-2.5 tw:mb-2.5 tw:inline-flex tw:max-w-full tw:whitespace-normal tw:font-medium"
                      color="gray"
                      data-testid={`contract-security-rowFilter-${index}-${filterIndex}`}
                      key={filter.columnName}
                      size="sm"
                      type="color">
                      {`${
                        tableColumnNameMap?.get(filter.columnName ?? '') ??
                        filter.columnName ??
                        NO_DATA_PLACEHOLDER
                      } = `}
                      {renderRowFilterValues(filter)}
                    </Badge>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </Card>
    ));
  }, [security?.policies]);

  return (
    <Grid
      className="layout-row layout-grid contract-security-component-container"
      style={{ ...getLayoutGutter(0, 26) }}>
      <Grid.Item className="layout-column" span={24}>
        <Card
          className="contract-security-classification-container tw:overflow-visible tw:px-5 tw:py-4 tw:text-sm tw:leading-[1.5715] tw:text-primary tw:tabular-nums"
          data-testid="contract-security-classification">
          <Typography className="contract-security-classification-label">
            {t('label.classification')}
          </Typography>

          {isEmpty(security?.dataClassification)
            ? NO_DATA_PLACEHOLDER
            : security?.dataClassification?.split(',').map((item) => (
                <Badge
                  bordered={false}
                  className="tw:mr-2 tw:inline-flex tw:max-w-full tw:whitespace-normal tw:font-medium"
                  color="pink"
                  data-testid="contract-security-classification-tag"
                  key={item}
                  size="sm"
                  type="color">
                  {item}
                </Badge>
              ))}
        </Card>
      </Grid.Item>

      {!isEmpty(security?.policies) && (
        <Grid.Item
          className="layout-column"
          data-testid="contract-security-policy-container"
          span={24}>
          <Typography className="contract-security-policy-label">
            {t('label.policy-plural')}
          </Typography>

          {renderSecurityPolicies}
        </Grid.Item>
      )}
    </Grid>
  );
};

export default ContractSecurityCard;
