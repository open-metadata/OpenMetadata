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
import { Card, Col, Divider, Row, Tag, Typography } from 'antd';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { ContractSecurity } from '../../../generated/entity/data/dataContract';
import { Table } from '../../../generated/entity/data/table';
import { getEntityName } from '../../../utils/EntityUtils';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import './contract-security.less';

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
      <Card
        className="contract-security-policy-card"
        title={
          <div>
            <Typography.Text className="access-policy-label">{`${t(
              'label.access-policy'
            )}: `}</Typography.Text>
            <Typography.Text
              className="access-policy-value"
              data-testid={`contract-security-access-policy-${index}`}>
              {policy.accessPolicy || NO_DATA_PLACEHOLDER}
            </Typography.Text>
          </div>
        }>
        <div className="contract-security-policy-card-identity-container">
          <Typography.Text className="contract-security-policy-subtitle-label">
            {t('label.identities')}
          </Typography.Text>

          {isEmpty(policy.identities)
            ? NO_DATA_PLACEHOLDER
            : policy.identities?.map((identity) => (
                <Tag
                  className="custom-tag"
                  data-testid={`contract-security-identities-${index}-${identity}`}
                  key={identity}>
                  {identity}
                </Tag>
              ))}
        </div>

        {!isEmpty(policy.rowFilters) && (
          <>
            <Divider className="contract-dash-separator" />

            <div className="contract-security-policy-card-row-filter-container">
              <Typography.Text className="contract-security-policy-subtitle-label">
                {t('label.row-filter-plural')}
              </Typography.Text>

              {policy.rowFilters?.map((filter, filterIndex) => {
                return (
                  <Tag
                    className="custom-tag"
                    data-testid={`contract-security-rowFilter-${index}-${filterIndex}`}
                    key={filter.columnName}>
                    {`${
                      tableColumnNameMap?.get(filter.columnName ?? '') ??
                      filter.columnName ??
                      NO_DATA_PLACEHOLDER
                    } = `}
                    {filter.values?.map((item, index) => (
                      <span className="row-filter-value">{`${item}${
                        filter.values?.length === index + 1 ? '' : ','
                      }`}</span>
                    ))}
                  </Tag>
                );
              })}
            </div>
          </>
        )}
      </Card>
    ));
  }, [security?.policies]);

  return (
    <Row className="contract-security-component-container" gutter={[0, 26]}>
      <Col span={24}>
        <Card
          className="contract-security-classification-container"
          data-testid="contract-security-classification">
          <Typography.Text className="contract-security-classification-label">
            {t('label.classification')}
          </Typography.Text>

          {isEmpty(security?.dataClassification)
            ? NO_DATA_PLACEHOLDER
            : security?.dataClassification?.split(',').map((item) => (
                <Tag className="custom-tag" color="pink">
                  {item}
                </Tag>
              ))}
        </Card>
      </Col>

      {!isEmpty(security?.policies) && (
        <Col data-testid="contract-security-policy-container" span={24}>
          <Typography.Text className="contract-security-policy-label">
            {t('label.policy-plural')}
          </Typography.Text>

          {renderSecurityPolicies}
        </Col>
      )}
    </Row>
  );
};

export default ContractSecurityCard;
