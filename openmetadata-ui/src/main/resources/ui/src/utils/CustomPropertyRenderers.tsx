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

import { Button, Tag, Typography } from 'antd';
import { TFunction } from 'i18next';
import { isEmpty } from 'lodash';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ProfilePicture from '../components/common/ProfilePicture/ProfilePicture';
import RichTextEditorPreviewerV1 from '../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import { CustomProperty, EntityReference } from '../generated/entity/type';
import { formatTableCellValue } from './CustomProperty.utils';
import entityUtilClassBase from './EntityUtilClassBase';
import { getEntityName } from './EntityUtils';
import searchClassBase from './SearchClassBase';

export const isEntityReference = (obj: Record<string, unknown>): boolean => {
  return !!(obj.type && obj.fullyQualifiedName && (obj.id || obj.name));
};

export const renderEntityReferenceButton = (item: EntityReference) => {
  const isUserOrTeam = ['user', 'team'].includes(item.type);

  return (
    <Link
      key={item.id}
      to={entityUtilClassBase.getEntityLink(item.type, item.name as string)}>
      <Button
        className="entity-button flex-center p-0"
        icon={
          <div className="entity-button-icon m-r-xs">
            {isUserOrTeam ? (
              <ProfilePicture
                className="d-flex"
                isTeam={item.type === 'team'}
                name={item.name ?? ''}
                type="circle"
                width="18"
              />
            ) : (
              searchClassBase.getEntityIcon(item.type)
            )}
          </div>
        }
        type="text">
        <Typography.Text
          className="text-left text-primary"
          ellipsis={{ tooltip: true }}>
          {getEntityName(item)}
        </Typography.Text>
      </Button>
    </Link>
  );
};

export const renderTableValue = (tableVal: {
  rows: Record<string, unknown>[];
  columns: string[];
}) => {
  return (
    <div className="custom-property-table">
      <table className="ant-table ant-table-small">
        <colgroup>
          {tableVal.columns.map((column: string) => (
            <col className="table-col-min-width" key={column} />
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
                      {formatTableCellValue(row[column])}
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
};

export const renderIntervalValue = (
  objVal: Record<string, unknown>,
  isTimeInterval: boolean,
  t: TFunction
): string => {
  const entityLabel = isTimeInterval ? t('label.time') : '';

  return `${t('label.start-entity', {
    entity: entityLabel,
  })}: ${objVal.start} - ${t('label.end-entity', {
    entity: entityLabel,
  })}: ${objVal.end}`;
};

const renderEntityReferenceList = (entityRefs: EntityReference[]) => (
  <div className="d-flex flex-column">
    {entityRefs.map((item: EntityReference) => (
      <div key={item.id}>{renderEntityReferenceButton(item)}</div>
    ))}
  </div>
);

const renderEntityReferenceSingle = (item: EntityReference) => (
  <div className="d-flex items-center">{renderEntityReferenceButton(item)}</div>
);

const renderEnumValues = (values: string[]) => (
  <div className="d-flex flex-wrap gap-2">
    {values.map((enumValue: string) => (
      <Tag key={enumValue}>{enumValue}</Tag>
    ))}
  </div>
);

const renderObjectValue = (
  objVal: Record<string, unknown>,
  propertyTypeName: string | undefined,
  t: TFunction
): React.ReactNode => {
  if (objVal.rows && objVal.columns) {
    const tableVal = objVal as {
      rows: Record<string, unknown>[];
      columns: string[];
    };

    return renderTableValue(tableVal);
  }

  if (objVal.start !== undefined && objVal.end !== undefined) {
    return renderIntervalValue(objVal, propertyTypeName === 'timeInterval', t);
  }

  if (objVal.name || objVal.displayName) {
    return String(objVal.name || objVal.displayName);
  }

  if (objVal.value !== undefined) {
    return typeof objVal.value === 'object' && objVal.value !== null
      ? JSON.stringify(objVal.value)
      : String(objVal.value);
  }

  return JSON.stringify(objVal);
};

const renderObjectPropertyValue = (
  val: unknown,
  propertyTypeName: string | undefined,
  t: TFunction
) => {
  const objVal = val as Record<string, unknown>;

  if (propertyTypeName === 'entityReferenceList' && Array.isArray(val)) {
    return renderEntityReferenceList(val as EntityReference[]);
  }

  if (propertyTypeName === 'entityReference' && isEntityReference(objVal)) {
    return renderEntityReferenceSingle(val as EntityReference);
  }

  if (propertyTypeName === 'enum' && Array.isArray(val)) {
    return renderEnumValues(val as string[]);
  }

  if (Array.isArray(val)) {
    return val.join(', ');
  }

  return renderObjectValue(objVal, propertyTypeName, t);
};

interface CustomPropertyValueRendererProps {
  value: unknown;
  property: CustomProperty;
}

export const CustomPropertyValueRenderer: React.FC<CustomPropertyValueRendererProps> =
  ({ value: val, property }) => {
    const { t } = useTranslation();
    const propertyTypeName = property.propertyType?.name;
    const isEmptyValue =
      val === null ||
      val === undefined ||
      val === '' ||
      (typeof val === 'object' && isEmpty(val));

    if (isEmptyValue) {
      return (
        <Typography.Text className="no-data-text">
          {t('label.not-set')}
        </Typography.Text>
      );
    }

    if (propertyTypeName === 'markdown') {
      return <RichTextEditorPreviewerV1 markdown={val as string} />;
    }

    if (typeof val === 'object') {
      return renderObjectPropertyValue(val, propertyTypeName, t);
    }

    return <>{String(val)}</>;
  };
