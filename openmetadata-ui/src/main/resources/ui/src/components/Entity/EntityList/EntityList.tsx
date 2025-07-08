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

import { Button, Col, Row, Typography } from 'antd';
import { isEmpty } from 'lodash';
import { FunctionComponent } from 'react';
import { Link } from 'react-router-dom';
import { EntityReference } from '../../../generated/entity/type';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getEntityName } from '../../../utils/EntityUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import EntityListSkeleton from '../../common/Skeleton/MyData/EntityListSkeleton/EntityListSkeleton.component';
import './entity.less';

interface AntdEntityListProp {
  loading?: boolean;
  entityList: Array<EntityReference>;
  headerText?: string | JSX.Element;
  headerTextLabel: string;
  noDataPlaceholder: JSX.Element;
  testIDText: string;
}

export const EntityListWithV1: FunctionComponent<AntdEntityListProp> = ({
  entityList = [],
  headerText,
  headerTextLabel,
  noDataPlaceholder,
  testIDText,
  loading,
}: AntdEntityListProp) => {
  return (
    <EntityListSkeleton
      dataLength={entityList.length !== 0 ? entityList.length : 5}
      loading={Boolean(loading)}>
      <>
        <Row className="m-b-xs" justify="space-between">
          <Col>
            <Typography.Text className="font-medium">
              {headerTextLabel}
            </Typography.Text>
          </Col>
          <Col>
            <Typography.Text>{headerText}</Typography.Text>
          </Col>
        </Row>
        {isEmpty(entityList) ? (
          <div className="flex-center h-full">{noDataPlaceholder}</div>
        ) : (
          <div className="entity-list-body">
            {entityList.map((item) => {
              return (
                <div
                  className="right-panel-list-item flex items-center justify-between"
                  data-testid={`${testIDText}-${item.name}`}
                  key={item.id}>
                  <div className="flex items-center">
                    <Link
                      className="font-medium"
                      to={entityUtilClassBase.getEntityLink(
                        item.type || '',
                        item.fullyQualifiedName ?? ''
                      )}>
                      <Button
                        className="entity-button flex-center p-0 m--ml-1"
                        icon={
                          <div className="entity-button-icon m-r-xs">
                            {searchClassBase.getEntityIcon(item.type || '')}
                          </div>
                        }
                        title={getEntityName(
                          item as unknown as EntityReference
                        )}
                        type="text">
                        <Typography.Text
                          className="w-72 text-left text-xs"
                          ellipsis={{ tooltip: true }}>
                          {getEntityName(item as unknown as EntityReference)}
                        </Typography.Text>
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>
    </EntityListSkeleton>
  );
};
