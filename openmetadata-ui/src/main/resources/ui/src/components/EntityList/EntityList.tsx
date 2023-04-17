/*
 *  Copyright 2022 Collate.
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
import React, { Fragment, FunctionComponent } from 'react';
import { Link } from 'react-router-dom';
import { getEntityName } from 'utils/EntityUtils';
import { EntityReference } from '../../generated/type/entityReference';
import { getEntityIcon, getEntityLink } from '../../utils/TableUtils';
import EntityListSkeleton from '../Skeleton/MyData/EntityListSkeleton/EntityListSkeleton.component';
import './entity.less';
interface Prop {
  entityList: Array<EntityReference>;
  headerText: string | JSX.Element;
  noDataPlaceholder: JSX.Element;
  testIDText: string;
}

interface AntdEntityListProp {
  loading?: boolean;
  entityList: Array<EntityReference>;
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
      <Text className="font-semibold" type="secondary">
        {headerText}
      </Text>
      {entityList.length
        ? entityList.map((item, index) => {
            return (
              <div
                className="flex items-center justify-between m-b-xs"
                data-testid={`${testIDText}-${getEntityName(
                  item as unknown as EntityReference
                )}`}
                key={index}>
                <div className="flex">
                  {getEntityIcon(item.type || '')}
                  <Link
                    className="font-medium"
                    to={getEntityLink(
                      item.type || '',
                      item.fullyQualifiedName as string
                    )}>
                    <Button
                      className="entity-button"
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
  loading,
}: AntdEntityListProp) => {
  return (
    <Card
      className="panel-shadow-color"
      extra={headerText}
      title={headerTextLabel}>
      <EntityListSkeleton
        dataLength={entityList.length !== 0 ? entityList.length : 5}
        loading={Boolean(loading)}>
        <>
          {entityList.length
            ? entityList.map((item, index) => {
                return (
                  <div
                    className="flex items-center justify-between"
                    data-testid={`${testIDText}-${getEntityName(
                      item as unknown as EntityReference
                    )}`}
                    key={index}>
                    <div className="flex items-center">
                      {getEntityIcon(item.type || '')}
                      <Link
                        className="font-medium"
                        to={getEntityLink(
                          item.type || '',
                          item.fullyQualifiedName as string
                        )}>
                        <Button
                          className="entity-button"
                          title={getEntityName(
                            item as unknown as EntityReference
                          )}
                          type="text">
                          <Typography.Text
                            className="w-48 text-left"
                            ellipsis={{ tooltip: true }}>
                            {getEntityName(item as unknown as EntityReference)}
                          </Typography.Text>
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })
            : noDataPlaceholder}
        </>
      </EntityListSkeleton>
    </Card>
  );
};

export default EntityList;
