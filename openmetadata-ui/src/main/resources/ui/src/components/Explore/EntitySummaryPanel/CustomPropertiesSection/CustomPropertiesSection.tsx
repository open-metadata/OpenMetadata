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

import { Button, Typography } from 'antd';
import { startCase } from 'lodash';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CUSTOM_PROPERTIES_DOCS } from '../../../../constants/docs.constants';
import { EntityType } from '../../../../enums/entity.enum';
import { Transi18next } from '../../../../utils/CommonUtils';
import { getEntityLinkFromType } from '../../../../utils/EntityUtils';
import Loader from '../../../common/Loader/Loader';

interface CustomPropertiesSectionProps {
  entityData?: any;
  entityDetails: any;
  entityType: EntityType;
  entityTypeDetail?: any;
  isEntityDataLoading: boolean;
}

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
        <div className="p-x-md p-t-md text-center text-grey-muted">
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

  const formatValue = (val: any) => {
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
      if (val.name || val.displayName) {
        return val.name || val.displayName;
      }
      if (val.value) {
        return val.value;
      }
      // Handle table-type custom properties
      if (val.rows && val.columns) {
        return (
          <div className="custom-property-table">
            <table className="ant-table ant-table-small">
              <colgroup>
                {val.columns.map((_: string, index: number) => (
                  <col key={index} style={{ minWidth: '80px' }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {val.columns.map((column: string, index: number) => (
                    <th className="ant-table-cell" key={index}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {val.rows.map((row: any, rowIndex: number) => (
                  <tr key={rowIndex}>
                    {val.columns.map((column: string, colIndex: number) => (
                      <td className="ant-table-cell" key={colIndex}>
                        {row[column] || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
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
      <div className="p-x-md">
        <div className="custom-properties-list">
          {customProperties.slice(0, 5).map((property: any) => {
            const value = extensionData[property.name];

            return (
              <div className="custom-property-item" key={property.name}>
                <Typography.Text strong className="property-name">
                  {property.displayName || property.name}
                </Typography.Text>
                <Typography.Text className="property-value">
                  {formatValue(value)}
                </Typography.Text>
              </div>
            );
          })}
          {customProperties.length > 5 && (
            <div className="m-t-md">
              <Link
                rel="noopener noreferrer"
                target="_blank"
                to={getEntityLinkFromType(
                  entityDetails.details.fullyQualifiedName || '',
                  entityType as EntityType
                )}>
                <Button size="small" type="primary">
                  {t('label.view-all')}
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomPropertiesSection;
