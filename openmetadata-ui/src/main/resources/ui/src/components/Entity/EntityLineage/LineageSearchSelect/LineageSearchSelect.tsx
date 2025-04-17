/*
 *  Copyright 2024 Collate.
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
import { RightOutlined } from '@ant-design/icons';
import { Select, Space, Typography } from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import classNames from 'classnames';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Node } from 'reactflow';
import { ZOOM_TRANSITION_DURATION } from '../../../../constants/Lineage.constants';
import { useLineageProvider } from '../../../../context/LineageProvider/LineageProvider';
import { LineagePlatformView } from '../../../../context/LineageProvider/LineageProvider.interface';
import { Column } from '../../../../generated/entity/data/table';
import { getEntityChildrenAndLabel } from '../../../../utils/EntityLineageUtils';
import { getEntityName } from '../../../../utils/EntityUtils';
import searchClassBase from '../../../../utils/SearchClassBase';
import serviceUtilClassBase from '../../../../utils/ServiceUtilClassBase';

const LineageSearchSelect = () => {
  const { t } = useTranslation();
  const {
    nodes,
    zoomValue,
    reactFlowInstance,
    isEditMode,
    onNodeClick,
    onColumnClick,
    isPlatformLineage,
    platformView,
  } = useLineageProvider();

  const nodeOptions = useMemo(() => {
    const options: DefaultOptionType[] = [];

    nodes.forEach((nodeObj) => {
      const { node } = nodeObj.data;
      if (!node) {
        return;
      }
      const nodeOption = {
        label: (
          <Space data-testid={`option-${node.fullyQualifiedName}`} size={0}>
            <img
              alt={node.serviceType}
              className="m-r-xss"
              height="16px"
              src={serviceUtilClassBase.getServiceTypeLogo(node)}
              width="16px"
            />
            <Typography.Text>{getEntityName(node)}</Typography.Text>
          </Space>
        ),
        value: node.fullyQualifiedName,
        dataLabel: getEntityName(node),
      };
      options.push(nodeOption);

      const { childrenFlatten = [] } = getEntityChildrenAndLabel(node);

      // Add all columns of the node as separate options
      childrenFlatten.forEach((column: Column) => {
        const columnOption = {
          label: (
            <div
              className="d-flex items-center gap-1"
              data-testid={`option-${column.fullyQualifiedName}`}>
              <div className="d-flex items-center gap-1">
                <img
                  alt={node.serviceType}
                  height="16px"
                  src={serviceUtilClassBase.getServiceTypeLogo(node)}
                  width="16px"
                />
                <Typography.Text className="text-grey-muted text-xs">
                  {getEntityName(node)}
                </Typography.Text>
                <RightOutlined className="text-grey-muted text-xss" />
              </div>
              <div className="d-flex items-center gap-1 ">
                <div className="flex-center w-4 h-4 text-base-color">
                  {searchClassBase.getEntityIcon(node.entityType ?? '')}
                </div>
                <Typography.Text>{getEntityName(column)}</Typography.Text>
              </div>
            </div>
          ),
          value: column.fullyQualifiedName,
          dataLabel: getEntityName(column),
        };
        options.push(columnOption);
      });
    });

    return options;
  }, [nodes]);

  const onOptionSelect = useCallback(
    (value?: string) => {
      const selectedNode = nodes.find(
        (node: Node) => node.data.node.fullyQualifiedName === value
      );
      if (selectedNode) {
        const { position } = selectedNode;
        onNodeClick(selectedNode);
        // moving selected node in center
        reactFlowInstance?.setCenter(position.x, position.y, {
          duration: ZOOM_TRANSITION_DURATION,
          zoom: zoomValue,
        });
      } else {
        onColumnClick(value ?? '');
      }
    },
    [onNodeClick, reactFlowInstance, onColumnClick]
  );

  if (isPlatformLineage || platformView !== LineagePlatformView.None) {
    return null;
  }

  return (
    <Select
      allowClear
      showSearch
      className={classNames('custom-control-search-box', {
        'custom-control-search-box-edit-mode': isEditMode,
      })}
      data-testid="lineage-search"
      dropdownMatchSelectWidth={false}
      optionFilterProp="dataLabel"
      optionLabelProp="dataLabel"
      options={nodeOptions}
      placeholder={t('label.search-entity', {
        entity: t('label.lineage'),
      })}
      popupClassName="lineage-search-options-list"
      onChange={onOptionSelect}
    />
  );
};

export default LineageSearchSelect;
