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
import Icon, { FilterOutlined } from '@ant-design/icons';
import { Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { compare, Operation } from 'fast-json-patch';
import { groupBy, isEmpty, isUndefined, uniqBy } from 'lodash';
import { EntityTags, TagFilterOptions } from 'Models';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ExternalLinkIcon } from '../../../assets/svg/external-links.svg';
import { DATA_ASSET_ICON_DIMENSION } from '../../../constants/constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../enums/entity.enum';
import { TagLabel, TagSource } from '../../../generated/entity/data/chart';
import { Dashboard } from '../../../generated/entity/data/dashboard';
import { ThreadType } from '../../../generated/entity/feed/thread';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { ChartType } from '../../../pages/DashboardDetailsPage/DashboardDetailsPage.component';
import { updateChart } from '../../../rest/chartAPI';
import {
  fetchCharts,
  sortTagsForCharts,
} from '../../../utils/DashboardDetailsUtils';
import { getColumnSorter, getEntityName } from '../../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import {
  getAllTags,
  searchTagInData,
} from '../../../utils/TableTags/TableTags.utils';
import { createTagObject } from '../../../utils/TagsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Table from '../../common/Table/Table';
import { ColumnFilter } from '../../Database/ColumnFilter/ColumnFilter.component';
import TableDescription from '../../Database/TableDescription/TableDescription.component';
import TableTags from '../../Database/TableTags/TableTags.component';
import { useGenericContext } from '../../GenericProvider/GenericProvider';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import { ChartsPermissions } from '../DashboardDetails/DashboardDetails.interface';

interface DashboardChartTableProps {
  onThreadLinkSelect: (link: string, threadType?: ThreadType) => void;
}

export const DashboardChartTable = ({
  onThreadLinkSelect,
}: DashboardChartTableProps) => {
  const { t } = useTranslation();
  const { getEntityPermission } = usePermissionProvider();
  const { theme } = useApplicationStore();

  const { data: dashboardDetails } = useGenericContext<Dashboard>();
  const { charts: listChartIds } = dashboardDetails ?? {};

  const [chartsPermissionsArray, setChartsPermissionsArray] = useState<
    Array<ChartsPermissions>
  >([]);

  const [charts, setCharts] = useState<ChartType[]>([]);
  const [editChart, setEditChart] = useState<{
    chart: ChartType;
    index: number;
  }>();

  const fetchChartPermissions = useCallback(async (id: string) => {
    try {
      const chartPermission = await getEntityPermission(
        ResourceEntity.CHART,
        id
      );

      return chartPermission;
    } catch (error) {
      return DEFAULT_ENTITY_PERMISSION;
    }
  }, []);

  const getAllChartsPermissions = useCallback(
    async (charts: ChartType[]) => {
      const permissionsArray: Array<ChartsPermissions> = [];
      try {
        await Promise.all(
          charts.map(async (chart) => {
            const chartPermissions = await fetchChartPermissions(chart.id);
            permissionsArray.push({
              id: chart.id,
              permissions: chartPermissions,
            });
          })
        );

        setChartsPermissionsArray(permissionsArray);
      } catch {
        showErrorToast(
          t('server.fetch-entity-permissions-error', {
            entity: t('label.chart'),
          })
        );
      }
    },
    [dashboardDetails]
  );

  useEffect(() => {
    if (charts) {
      getAllChartsPermissions(charts);
    }
  }, [charts]);

  const initializeCharts = useCallback(async () => {
    try {
      const res = await fetchCharts(listChartIds);
      setCharts(res);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.chart-plural'),
        })
      );
    }
  }, [listChartIds]);

  const handleUpdateChart = (chart: ChartType, index: number) => {
    setEditChart({ chart, index });
  };

  const closeEditChartModal = (): void => {
    setEditChart(undefined);
  };

  const chartDescriptionUpdateHandler = async (
    index: number,
    chartId: string,
    patch: Array<Operation>
  ) => {
    try {
      const response = await updateChart(chartId, patch);
      setCharts((prevCharts) => {
        const charts = [...prevCharts];
        charts[index] = response;

        return charts;
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const onChartUpdate = async (chartDescription: string) => {
    if (editChart) {
      const updatedChart = {
        ...editChart.chart,
        description: chartDescription,
      };
      const jsonPatch = compare(charts[editChart.index], updatedChart);

      try {
        await chartDescriptionUpdateHandler(
          editChart.index,
          editChart.chart.id,
          jsonPatch
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setEditChart(undefined);
      }
    } else {
      setEditChart(undefined);
    }
  };

  const tagFilter = useMemo(() => {
    const tags = getAllTags(charts);

    return groupBy(uniqBy(tags, 'value'), (tag) => tag.source) as Record<
      TagSource,
      TagFilterOptions[]
    >;
  }, [charts]);

  const hasEditTagAccess = (record: ChartType) => {
    const permissionsObject = chartsPermissionsArray?.find(
      (chart) => chart.id === record.id
    )?.permissions;

    return (
      !isUndefined(permissionsObject) &&
      (permissionsObject.EditTags || permissionsObject.EditAll)
    );
  };

  const hasEditGlossaryTermAccess = (record: ChartType) => {
    const permissionsObject = chartsPermissionsArray?.find(
      (chart) => chart.id === record.id
    )?.permissions;

    return (
      !isUndefined(permissionsObject) &&
      (permissionsObject.EditGlossaryTerms || permissionsObject.EditAll)
    );
  };

  const chartTagUpdateHandler = async (
    chartId: string,
    patch: Array<Operation>
  ) => {
    try {
      const res = await updateChart(chartId, patch);

      setCharts((prevCharts) => {
        const charts = [...prevCharts].map((chart) =>
          chart.id === chartId ? res : chart
        );

        // Sorting tags as the response of PATCH request does not return the sorted order
        // of tags, but is stored in sorted manner in the database
        // which leads to wrong PATCH payload sent after further tags removal
        return sortTagsForCharts(charts);
      });
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-updating-error', {
          entity: t('label.chart-plural'),
        })
      );
    }
  };

  const handleChartTagSelection = async (
    selectedTags: Array<EntityTags>,
    editColumnTag: ChartType
  ) => {
    if (selectedTags && editColumnTag) {
      const prevTags = editColumnTag.tags?.filter((tag) =>
        selectedTags.some((selectedTag) => selectedTag.tagFQN === tag.tagFQN)
      );
      const newTags = createTagObject(
        selectedTags.filter(
          (selectedTag) =>
            !editColumnTag.tags?.some(
              (tag) => tag.tagFQN === selectedTag.tagFQN
            )
        )
      );

      const updatedChart = {
        ...editColumnTag,
        tags: [...(prevTags as TagLabel[]), ...newTags],
      };
      const jsonPatch = compare(editColumnTag, updatedChart);
      await chartTagUpdateHandler(editColumnTag.id, jsonPatch);
    }
  };

  const tableColumn: ColumnsType<ChartType> = useMemo(
    () => [
      {
        title: t('label.chart-entity', {
          entity: t('label.name'),
        }),
        dataIndex: 'chartName',
        key: 'chartName',
        width: 220,
        fixed: 'left',
        sorter: getColumnSorter<ChartType, 'name'>('name'),
        render: (_, record) => {
          const chartName = getEntityName(record);

          return record.sourceUrl ? (
            <div className="d-flex items-center">
              <Typography.Link href={record.sourceUrl} target="_blank">
                <span className="break-all">{chartName}</span>

                <Icon
                  className="m-l-xs flex-none align-middle"
                  component={ExternalLinkIcon}
                  style={DATA_ASSET_ICON_DIMENSION}
                />
              </Typography.Link>
            </div>
          ) : (
            <Typography.Text className="w-full">{chartName}</Typography.Text>
          );
        },
      },
      {
        title: t('label.chart-entity', {
          entity: t('label.type'),
        }),
        dataIndex: 'chartType',
        key: 'chartType',
        width: 120,
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        width: 350,
        render: (_, record, index) => {
          const permissionsObject = chartsPermissionsArray?.find(
            (chart) => chart.id === record.id
          )?.permissions;

          const editDescriptionPermissions =
            !isUndefined(permissionsObject) &&
            (permissionsObject.EditDescription || permissionsObject.EditAll);

          return (
            <TableDescription
              columnData={{
                fqn: record.fullyQualifiedName ?? '',
                field: record.description,
              }}
              entityFqn={dashboardDetails?.fullyQualifiedName ?? ''}
              entityType={EntityType.DASHBOARD}
              hasEditPermission={editDescriptionPermissions}
              index={index}
              isReadOnly={dashboardDetails?.deleted}
              onClick={() => handleUpdateChart(record, index)}
              onThreadLinkSelect={onThreadLinkSelect}
            />
          );
        },
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
        accessor: 'tags',
        width: 300,
        filterIcon: (filtered) => (
          <FilterOutlined
            data-testid="tag-filter"
            style={{
              color: filtered ? theme.primaryColor : undefined,
            }}
          />
        ),
        render: (tags: TagLabel[], record: ChartType, index: number) => {
          return (
            <TableTags<ChartType>
              entityFqn={dashboardDetails?.fullyQualifiedName ?? ''}
              entityType={EntityType.DASHBOARD}
              handleTagSelection={handleChartTagSelection}
              hasTagEditAccess={hasEditTagAccess(record)}
              index={index}
              isReadOnly={dashboardDetails?.deleted}
              record={record}
              tags={tags}
              type={TagSource.Classification}
              onThreadLinkSelect={onThreadLinkSelect}
            />
          );
        },
        filters: tagFilter.Classification,
        filterDropdown: ColumnFilter,
        onFilter: searchTagInData,
      },
      {
        title: t('label.glossary-term-plural'),
        dataIndex: 'tags',
        key: 'glossary',
        accessor: 'tags',
        width: 300,
        filterIcon: (filtered) => (
          <FilterOutlined
            data-testid="glossary-filter"
            style={{
              color: filtered ? theme.primaryColor : undefined,
            }}
          />
        ),
        render: (tags: TagLabel[], record: ChartType, index: number) => (
          <TableTags<ChartType>
            entityFqn={dashboardDetails?.fullyQualifiedName ?? ''}
            entityType={EntityType.DASHBOARD}
            handleTagSelection={handleChartTagSelection}
            hasTagEditAccess={hasEditGlossaryTermAccess(record)}
            index={index}
            isReadOnly={dashboardDetails?.deleted}
            record={record}
            tags={tags}
            type={TagSource.Glossary}
            onThreadLinkSelect={onThreadLinkSelect}
          />
        ),
        filters: tagFilter.Glossary,
        filterDropdown: ColumnFilter,
        onFilter: searchTagInData,
      },
    ],
    [
      dashboardDetails?.deleted,
      chartsPermissionsArray,
      onThreadLinkSelect,
      hasEditTagAccess,
      handleUpdateChart,
      handleChartTagSelection,
      charts,
    ]
  );

  useEffect(() => {
    initializeCharts();
  }, [listChartIds]);

  if (isEmpty(charts)) {
    return <ErrorPlaceHolder />;
  }

  return (
    <>
      <Table
        bordered
        className="align-table-filter-left"
        columns={tableColumn}
        data-testid="charts-table"
        dataSource={charts}
        pagination={false}
        rowKey="id"
        scroll={{ x: 1200 }}
        size="small"
      />
      {editChart && (
        <ModalWithMarkdownEditor
          header={t('label.edit-chart-name', {
            name: getEntityName(editChart.chart),
          })}
          placeholder={t('label.enter-field-description', {
            field: t('label.chart'),
          })}
          value={editChart.chart.description ?? ''}
          visible={Boolean(editChart)}
          onCancel={closeEditChartModal}
          onSave={onChartUpdate}
        />
      )}
    </>
  );
};
