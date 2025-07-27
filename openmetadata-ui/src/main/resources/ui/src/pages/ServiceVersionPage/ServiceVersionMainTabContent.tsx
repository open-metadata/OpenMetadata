/*
 *  Copyright 2023 Collate.
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

import { Col, Row, Space } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { isEmpty, isNil } from 'lodash';
import { ServiceTypes } from 'Models';
import { useMemo } from 'react';
import DescriptionV1 from '../../components/common/EntityDescription/DescriptionV1';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Table from '../../components/common/Table/Table';
import TagsContainerV2 from '../../components/Tag/TagsContainerV2/TagsContainerV2';
import { DisplayType } from '../../components/Tag/TagsViewer/TagsViewer.interface';
import { PAGE_SIZE } from '../../constants/constants';
import { TABLE_SCROLL_VALUE } from '../../constants/Table.constants';
import { TagSource } from '../../generated/type/tagLabel';
import { useFqn } from '../../hooks/useFqn';
import { getCommonDiffsFromVersionData } from '../../utils/EntityVersionUtils';
import { getServiceMainTabColumns } from '../../utils/ServiceMainTabContentUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import { ServicePageData } from '../ServiceDetailsPage/ServiceDetailsPage.interface';
import { ServiceVersionMainTabContentProps } from './ServiceVersionMainTabContent.interface';

function ServiceVersionMainTabContent({
  serviceName,
  data,
  isServiceLoading,
  paging,
  pagingHandler,
  currentPage,
  serviceDetails,
  entityType,
  changeDescription,
}: ServiceVersionMainTabContentProps) {
  const { serviceCategory } = useRequiredParams<{
    serviceCategory: ServiceTypes;
  }>();

  const { fqn: serviceFQN } = useFqn();

  const tableColumn: ColumnsType<ServicePageData> = useMemo(
    () => getServiceMainTabColumns(serviceCategory),
    [serviceCategory]
  );

  const { tags, description } = useMemo(
    () => getCommonDiffsFromVersionData(serviceDetails, changeDescription),
    [serviceDetails, changeDescription]
  );

  return (
    <Row className="h-full" gutter={[0, 16]} wrap={false}>
      <Col className="p-t-sm m-x-lg" flex="auto">
        <Row gutter={[16, 16]}>
          <Col data-testid="description-container" span={24}>
            <DescriptionV1
              description={description}
              entityName={serviceName}
              entityType={entityType}
              showActions={false}
            />
          </Col>

          <Col data-testid="table-container" span={24}>
            <Space className="w-full m-b-md" direction="vertical" size="middle">
              <Table
                columns={tableColumn}
                customPaginationProps={{
                  currentPage,
                  isLoading: isServiceLoading,
                  showPagination:
                    Boolean(!isNil(paging.after) || !isNil(paging.before)) &&
                    !isEmpty(data),
                  pageSize: PAGE_SIZE,
                  paging,
                  pagingHandler,
                }}
                data-testid="service-children-table"
                dataSource={data}
                entityType={entityType}
                loading={isServiceLoading}
                locale={{
                  emptyText: <ErrorPlaceHolder className="m-y-md" />,
                }}
                pagination={false}
                rowKey="name"
                scroll={TABLE_SCROLL_VALUE}
                size="small"
              />
            </Space>
          </Col>
        </Row>
      </Col>
      <Col
        className="entity-tag-right-panel-container"
        data-testid="entity-right-panel"
        flex="220px">
        <Space className="w-full" direction="vertical" size="large">
          {Object.keys(TagSource).map((tagType) => (
            <TagsContainerV2
              newLook
              displayType={DisplayType.READ_MORE}
              entityFqn={serviceFQN}
              entityType={entityType}
              key={tagType}
              permission={false}
              selectedTags={tags}
              showTaskHandler={false}
              tagType={TagSource[tagType as TagSource]}
            />
          ))}
        </Space>
      </Col>
    </Row>
  );
}

export default ServiceVersionMainTabContent;
