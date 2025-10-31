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
/*
 *  Copyright 2021 Collate
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

import { Link } from '@mui/material';
import { Typography } from 'antd';
import { startCase } from 'lodash';
import { useTranslation } from 'react-i18next';
import { CUSTOM_PROPERTIES_DOCS } from '../../../../constants/docs.constants';
import { CustomProperty } from '../../../../generated/entity/type';
import { Transi18next } from '../../../../utils/CommonUtils';
import { getEntityLinkFromType } from '../../../../utils/EntityUtils';
import Loader from '../../../common/Loader/Loader';
import { CustomPropertiesSectionProps } from './CustomPropertiesSection.interface';
import './CustomPropertiesSection.less';

const CustomPropertiesSection = ({
  entityData,
  entityDetails,
  entityType,
  entityTypeDetail,
  isEntityDataLoading,
}: CustomPropertiesSectionProps) => {
  const { t } = useTranslation();

  if (isEntityDataLoading) {
    return (
      <div className="entity-summary-panel-tab-content">
        <div className="p-x-md p-t-md">
          <Loader size="default" />
        </div>
      </div>
    );
  }

  const customProperties = entityTypeDetail?.customProperties || [];
  const extensionData = entityData?.extension || {};

  if (customProperties.length === 0) {
    return (
      <div className="entity-summary-panel-tab-content">
        <div className="p-x-md p-t-md text-justify text-grey-muted">
          <Transi18next
            i18nKey="message.no-custom-properties-entity"
            renderElement={
              <a
                href={CUSTOM_PROPERTIES_DOCS}
                rel="noreferrer"
                target="_blank"
                title="Custom properties documentation"
              />
            }
            values={{
              docs: t('label.doc-plural-lowercase'),
              entity: startCase(entityType),
            }}
          />
        </div>
      </div>
    );
  }

  const formatValue = (val: unknown) => {
    if (!val) {
      return (
        <div className="text-center text-grey-muted p-sm">
          {t('label.no-data-found')}
        </div>
      );
    }

    if (typeof val === 'object') {
      if (Array.isArray(val)) {
        return val.join(', ');
      }
      const objVal = val as Record<string, unknown>;
      if (objVal.name || objVal.displayName) {
        return String(objVal.name || objVal.displayName);
      }
      if (objVal.value) {
        return String(objVal.value);
      }
      // Handle table-type custom properties
      if (objVal.rows && objVal.columns) {
        const tableVal = objVal as {
          rows: Record<string, unknown>[];
          columns: string[];
        };

        return (
          <div className="custom-property-table">
            <table className="ant-table ant-table-small">
              <colgroup>
                {tableVal.columns.map((column: string) => (
                  <col key={column} style={{ minWidth: '80px' }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {tableVal.columns.map((column: string) => (
                    <th className="ant-table-cell" key={column}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableVal.rows.map(
                  (row: Record<string, unknown>, rowIndex: number) => {
                    const rowKey = `row-${rowIndex}-${tableVal.columns
                      .map((col: string) => row[col])
                      .join('-')}`;

                    return (
                      <tr key={rowKey}>
                        {tableVal.columns.map((column: string) => (
                          <td className="ant-table-cell" key={column}>
                            {String(row[column] || '-')}
                          </td>
                        ))}
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        );
      }

      return JSON.stringify(val);
    }

    return String(val);
  };

  return (
    <div className="entity-summary-panel-tab-content">
      {customProperties.length > 5 && (
        <div className="view-all-container">
          <Link
            href={getEntityLinkFromType(
              entityDetails.details.fullyQualifiedName || '',
              entityType
            )}
            rel="noopener noreferrer"
            target="_blank">
            <span className="text-primary">{t('label.view-all')}</span>
          </Link>
        </div>
      )}
      <div className="p-x-md">
        <div className="custom-properties-list">
          {customProperties.slice(0, 5).map((property: CustomProperty) => {
            const value = extensionData[property.name];

            return (
              <div className="custom-property-item" key={property.name}>
                <Typography.Text className="property-name">
                  {property.displayName || property.name}
                </Typography.Text>
                <Typography.Text className="property-value">
                  {formatValue(value)}
                </Typography.Text>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CustomPropertiesSection;
