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

import { Button, Card, Typography } from 'antd';
import { FormatedTableData } from 'Models';
import React, { Fragment, FunctionComponent } from 'react';
import { Link } from 'react-router-dom';
import { EntityReference } from '../../generated/type/entityReference';
import { getEntityName } from '../../utils/CommonUtils';
import { getEntityIcon, getEntityLink } from '../../utils/TableUtils';
import { leftPanelAntCardStyle } from '../containers/PageLayout';
interface Prop {
  entityList: Array<FormatedTableData>;
  headerText: string | JSX.Element;
  noDataPlaceholder: JSX.Element;
  testIDText: string;
}

interface AntdEntityListProp {
  entityList: Array<FormatedTableData>;
  headerText?: string | JSX.Element;
  headerTextLabel: string;
  noDataPlaceholder: JSX.Element;
  testIDText: string;
}

const { Text } = Typography;

const EntityList: FunctionComponent<Prop> = ({
  entityList = [],
  headerText,
  noDataPlaceholder,
  testIDText,
}: Prop) => {
  return (
    <Fragment>
      <Text className="tw-font-semibold" type="secondary">
        {headerText}
      </Text>
      {entityList.length
        ? entityList.map((item, index) => {
            return (
              <div
                className="tw-flex tw-items-center tw-justify-between tw-mb-2"
                data-testid={`${testIDText}-${getEntityName(
                  item as unknown as EntityReference
                )}`}
                key={index}>
                <div className="tw-flex">
                  {getEntityIcon(item.index || item.type || '')}
                  <Link
                    className="tw-font-medium"
                    to={getEntityLink(
                      item.index || item.type || '',
                      item.fullyQualifiedName
                    )}>
                    <Button
                      className="tw-text-grey-body hover:tw-text-primary-hover hover:tw-underline"
                      title={getEntityName(item as unknown as EntityReference)}
                      type="text">
                      {getEntityName(item as unknown as EntityReference)}
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })
        : noDataPlaceholder}
    </Fragment>
  );
};

export const EntityListWithAntd: FunctionComponent<AntdEntityListProp> = ({
  entityList = [],
  headerText,
  headerTextLabel,
  noDataPlaceholder,
  testIDText,
}: AntdEntityListProp) => {
  return (
    <Card
      extra={headerText}
      style={leftPanelAntCardStyle}
      title={headerTextLabel}>
      {entityList.length
        ? entityList.map((item, index) => {
            return (
              <div
                className="tw-flex tw-items-center tw-justify-between"
                data-testid={`${testIDText}-${getEntityName(
                  item as unknown as EntityReference
                )}`}
                key={index}>
                <div className="tw-flex">
                  {getEntityIcon(item.index || item.type || '')}
                  <Link
                    className="tw-font-medium"
                    to={getEntityLink(
                      item.index || item.type || '',
                      item.fullyQualifiedName
                    )}>
                    <Button
                      className="tw-text-grey-body hover:tw-text-primary-hover hover:tw-underline"
                      title={getEntityName(item as unknown as EntityReference)}
                      type="text">
                      {getEntityName(item as unknown as EntityReference)}
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })
        : noDataPlaceholder}
    </Card>
  );
};

export default EntityList;
