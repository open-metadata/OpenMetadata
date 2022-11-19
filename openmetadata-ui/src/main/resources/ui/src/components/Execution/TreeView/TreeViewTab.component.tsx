/*
 *  Copyright 2022 Collate
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
import { Card, Col, Empty, Row, Typography } from 'antd';
import Tree from 'antd/lib/tree';
import { isEmpty } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PipelineStatus, Task } from '../../../generated/entity/data/pipeline';
import { getTreeData, getTreeViewData } from '../../../utils/executionUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { formatDateTimeFromSeconds } from '../../../utils/TimeUtils';
import './tree-view-tab.less';

interface TreeViewProps {
  executions: Array<PipelineStatus> | undefined;
  status: string;
  startTime: number;
  endTime: number;
  tasks: Task[];
}

const TreeViewTab = ({
  executions,
  status,
  startTime,
  endTime,
  tasks,
}: TreeViewProps) => {
  const viewData = useMemo(
    () => getTreeViewData(executions as PipelineStatus[], status),
    [executions, status]
  );

  const { treeDataList, treeLabelList } = useMemo(
    () => getTreeData(tasks, viewData),
    [tasks, viewData]
  );

  const { t } = useTranslation();

  return (
    <Card>
      <Row align="middle" className="m-b-lg m-t-md" justify="center">
        <SVGIcons
          alt="result"
          className="tw-w-4 transform-180 m-r-7 cursor-pointer"
          icon={Icons.ARROW_RIGHT}
        />
        <Typography.Title className="p-b-0" level={5}>
          {formatDateTimeFromSeconds(startTime)} to{' '}
          {formatDateTimeFromSeconds(endTime)}
        </Typography.Title>

        <SVGIcons
          alt="result"
          className="tw-w-4 m-l-7 cursor-pointer"
          icon={Icons.ARROW_RIGHT}
        />
      </Row>

      {isEmpty(viewData) && (
        <Empty
          className="my-4"
          description={t('label.no-execution-runs-found')}
        />
      )}
      <Row className="w-full">
        <Col span={6}>
          <Tree
            defaultExpandAll
            showIcon
            showLine={{ showLeafIcon: false }}
            switcherIcon={<></>}
            treeData={treeLabelList}
          />
        </Col>
        <Col span={18}>
          <Tree
            defaultExpandAll
            showIcon
            className="tree-without-indent"
            switcherIcon={<></>}
            treeData={treeDataList}
          />
        </Col>
      </Row>
    </Card>
  );
};

export default TreeViewTab;
