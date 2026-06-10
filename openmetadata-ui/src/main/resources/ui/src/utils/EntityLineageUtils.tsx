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

import Icon, { CheckOutlined } from '@ant-design/icons';
import { Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { isEmpty } from 'lodash';
import type { LoadingState } from 'Models';
import { Link } from 'react-router-dom';
import { ReactComponent as MetricIcon } from '../assets/svg/metric.svg';
import Loader from '../components/common/Loader/Loader';
import CustomNodeV1 from '../components/Entity/EntityLineage/CustomNodeV1.component';
import LoadMoreNode from '../components/Entity/EntityLineage/LoadMoreNode/LoadMoreNode';
import { NO_DATA_PLACEHOLDER } from '../constants/constants';
import { LINEAGE_TABLE_COLUMN_LOCALIZATION_KEYS } from '../constants/Lineage.constants';
import { EntityType } from '../enums/entity.enum';
import entityUtilClassBase from '../utils/EntityUtilClassBase';
import serviceUtilClassBase from '../utils/ServiceUtilClassBase';
import Fqn from './Fqn';
import { t } from './i18next/LocalUtil';

export {
  addLineageHandler,
  centerNodePosition,
  checkUpstreamDownstream,
  createColumnEdges,
  createEdgesAndEdgeMaps,
  createEntityEdgesAndMaps,
  createNewEdge,
  createNodes,
  dragHandle,
  getAllDownstreamEdges,
  getAllTracedColumnEdge,
  getAllTracedEdges,
  getAllTracedNodes,
  getClassifiedEdge,
  getColumnFunctionValue,
  getColumnLineageData,
  getConnectedNodesEdges,
  getEdgeDataFromEdge,
  getEdgePathAlignmentData,
  getEdgePathData,
  getELKLayoutedElements,
  getEntityChildrenAndLabel,
  getEntityCountAtDepth,
  getEntityNodeIcon,
  getEntityTypeFromPlatformView,
  getExportData,
  getExportEntity,
  getLayoutedElements,
  getLineageDetailsObject,
  getLineageEdge,
  getLineageEdgeForAPI,
  getLineageEntityExclusionFilter,
  getModalBodyText,
  getNewLineageConnectionDetails,
  getNodeLineageData,
  getNodesBoundsReactFlow,
  getUpdatedColumnsFromEdge,
  getUpstreamDownstreamNodesEdges,
  getViewportForBoundsReactFlow,
  getViewportForLineageExport,
  isSelfConnectingEdge,
  MAX_LINEAGE_LENGTH,
  onLoad,
  onNodeContextMenu,
  parseLineageData,
  positionNodesUsingElk,
  removeLineageHandler,
  removeUnconnectedNodes,
} from './EntityLineagePureUtils';

export const getLoadingStatusValue = (
  defaultState: string | JSX.Element,
  loading: boolean,
  status: LoadingState
) => {
  if (loading) {
    return <Loader className="text-primary" size="small" />;
  } else if (status === 'success') {
    return <CheckOutlined className="text-primary" />;
  } else {
    return defaultState;
  }
};

export const nodeTypes = {
  output: CustomNodeV1,
  input: CustomNodeV1,
  default: CustomNodeV1,
  'load-more': LoadMoreNode,
};

const buildLineageTableColumns = (headers: string[]): ColumnsType<string> => {
  const FROM_FIELDS = ['fromEntityFQN', 'fromServiceName', 'fromServiceType'];
  const TO_FIELDS = ['toEntityFQN', 'toServiceName', 'toServiceType'];

  const renderCombined = (fqn: string, serviceType: string) => {
    const isMetricEntity = serviceType === EntityType.METRIC;

    return (
      <div className="d-flex items-center gap-2">
        {isMetricEntity ? (
          <Icon component={MetricIcon} style={{ fontSize: '20px' }} />
        ) : (
          <img
            alt={fqn}
            className="header-icon"
            src={serviceUtilClassBase.getServiceLogo(serviceType)}
          />
        )}

        <Typography.Text className="text-primary" ellipsis={{ tooltip: true }}>
          {isEmpty(fqn) ? NO_DATA_PLACEHOLDER : fqn}
        </Typography.Text>
      </div>
    );
  };

  const getEntityType = (serviceType: string, fqn: string) => {
    if (!serviceType || !fqn) {
      return EntityType.TABLE;
    }

    if (serviceType === EntityType.METRIC) {
      return serviceType;
    }

    let entityType =
      serviceUtilClassBase.getEntityTypeFromServiceType(serviceType);

    if (entityType === EntityType.DASHBOARD) {
      const fqnSplit = Fqn.split(fqn);

      entityType =
        fqnSplit.length === 3 ? EntityType.DASHBOARD_DATA_MODEL : entityType;
    }

    return entityType;
  };

  const columns: ColumnsType<string> = [];
  columns.push(
    ...([
      {
        title: t('label.from-entity'),
        dataIndex: 'fromCombined',
        key: 'fromCombined',
        width: 300,
        ellipsis: { showTitle: false },
        render: (_: string, record: Record<string, string>) => {
          const serviceType = isEmpty(record.fromServiceType)
            ? EntityType.METRIC
            : record.fromServiceType;

          return (
            <Link
              to={entityUtilClassBase.getEntityLink(
                getEntityType(serviceType, record.fromEntityFQN),
                record.fromEntityFQN
              )}>
              {renderCombined(record.fromEntityFQN, serviceType)}
            </Link>
          );
        },
      },
      {
        title: t('label.to-entity'),
        dataIndex: 'toCombined',
        key: 'toCombined',
        width: 300,
        ellipsis: { showTitle: false },
        render: (_: string, record: Record<string, string>) => {
          const serviceType = isEmpty(record.toServiceType)
            ? EntityType.METRIC
            : record.toServiceType;

          return (
            <Link
              to={entityUtilClassBase.getEntityLink(
                getEntityType(serviceType, record.toEntityFQN),
                record.toEntityFQN
              )}>
              {renderCombined(record.toEntityFQN, serviceType)}
            </Link>
          );
        },
      },
    ] as unknown as ColumnsType<string>[number][])
  );

  headers.forEach((header) => {
    if ([...FROM_FIELDS, ...TO_FIELDS].includes(header)) {
      return;
    }

    columns.push({
      title: LINEAGE_TABLE_COLUMN_LOCALIZATION_KEYS[header],
      dataIndex: header,
      key: header,
      width: 200,
      ellipsis: { showTitle: false },
      render: (text: string) => (
        <Typography.Text
          data-testid={`lineage-column-${header}-${text}`}
          ellipsis={{ tooltip: true }}>
          {isEmpty(text) ? NO_DATA_PLACEHOLDER : text}
        </Typography.Text>
      ),
    });
  });

  return columns;
};

export const getLineageTableConfig = (
  csvData: string[][]
): {
  columns: ColumnsType<string>;
  dataSource: Record<string, string>[];
} => {
  if (!csvData || csvData.length < 2) {
    return {
      columns: [],
      dataSource: [],
    };
  }

  const [headers, ...rows] = csvData;

  const dataSource = rows.map((row, index) => {
    const rowData: Record<string, string> = {};
    headers.forEach((header, headerIndex) => {
      rowData[header] = row[headerIndex] || '';
    });
    rowData.key = index.toString();

    return rowData;
  });

  const columns = buildLineageTableColumns(headers);

  return { columns, dataSource };
};
