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

import { Box, EmptyPlaceholder, Grid } from '@openmetadata/ui-core-components';
import { Assets } from '@openmetadata/ui-core-components/icons';
import { getLayoutGutter } from '../../utils/common/layout.utils';

import { isEmpty, isNil } from 'lodash';
import { ServiceTypes } from 'Models';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Description from '../../components/common/EntityDescription/Description';
import { ColumnsType } from '../../components/common/Table/Table.interface';
import Table from '../../components/common/Table/TableV2';
import TagsContainerV2 from '../../components/Tag/TagsContainerV2/TagsContainerV2';
import { DisplayType } from '../../components/Tag/TagsViewer/TagsViewer.interface';
import { PAGE_SIZE } from '../../constants/constants';
import { TABLE_SCROLL_VALUE } from '../../constants/Table.constants';
import { TagSource } from '../../generated/type/tagLabel';
import { useFqn } from '../../hooks/useFqn';
import { ServicePageData } from '../../interface/platform/service.interface';
import { getCommonDiffsFromVersionData } from '../../utils/EntityVersionUtilsPure';
import { getServiceMainTabColumns } from '../../utils/ServiceMainTabContentUtils';
import { getCountLabel } from '../../utils/ServicePureUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
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
  const { t } = useTranslation();

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
    <Box
      className="layout-row h-full"
      style={{ ...getLayoutGutter(0, 16) }}
      wrap="nowrap">
      <Box
        className="layout-column tw:block p-t-sm m-x-lg"
        style={{ flex: 'auto' }}>
        <Grid
          className="layout-row layout-grid"
          style={{ ...getLayoutGutter(16, 16) }}>
          <Grid.Item
            className="layout-column"
            data-testid="description-container"
            span={24}>
            <Description
              description={description}
              entityName={serviceName}
              entityType={entityType}
              showActions={false}
            />
          </Grid.Item>

          <Grid.Item
            className="layout-column"
            data-testid="table-container"
            span={24}>
            <Box
              inline
              align="stretch"
              className="layout-space w-full m-b-md"
              direction="col"
              gap={4}
              itemClassName="layout-space-item">
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
                  emptyText: (
                    <div className="tw:relative tw:min-h-42">
                      <EmptyPlaceholder
                        icon={<Assets className="tw:text-utility-gray-600" />}
                        title={t('message.no-entity-data-available', {
                          entity: getCountLabel(serviceCategory),
                        })}
                        variant="blank"
                      />
                    </div>
                  ),
                }}
                pagination={false}
                rowKey="name"
                scroll={TABLE_SCROLL_VALUE}
                size="small"
              />
            </Box>
          </Grid.Item>
        </Grid>
      </Box>
      <Box
        className="layout-column tw:block entity-tag-right-panel-container"
        data-testid="entity-right-panel"
        style={{ flex: `0 0 ${'220px'}` }}>
        <Box
          inline
          align="stretch"
          className="layout-space w-full"
          direction="col"
          gap={6}
          itemClassName="layout-space-item">
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
        </Box>
      </Box>
    </Box>
  );
}

export default ServiceVersionMainTabContent;
