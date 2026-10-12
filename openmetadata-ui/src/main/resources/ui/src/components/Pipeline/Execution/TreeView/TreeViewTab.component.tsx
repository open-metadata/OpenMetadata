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

import { Box, Grid, Typography } from '@openmetadata/ui-core-components';
import { Card, Empty } from 'antd';
import Tree from 'antd/lib/tree';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ArrowSvg } from '../../../../assets/svg/vector.svg';
import {
  PipelineStatus,
  Task,
} from '../../../../generated/entity/data/pipeline';
import { getLayoutGutter } from '../../../../utils/common/layout.utils';
import { formatDateTime } from '../../../../utils/date-time/DateTimeUtils';
import { getTreeData, getTreeViewData } from '../../../../utils/executionUtils';
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
      <Box
        align="center"
        className="layout-row m-b-lg m-t-md"
        justify="center"
        style={{ ...getLayoutGutter(16) }}
        wrap="wrap">
        <Box className="layout-column tw:block">
          <ArrowSvg className="cursor-pointer" />
        </Box>
        <Box className="layout-column tw:block">
          <Typography className="p-b-0 m-b-0 font-medium">
            {`${formatDateTime(startTime)} ${t(
              'label.to-lowercase'
            )} ${formatDateTime(endTime)}`}
          </Typography>
        </Box>
        <Box className="layout-column tw:block">
          <ArrowSvg className=" cursor-pointer transform-180" />
        </Box>
      </Box>

      {isEmpty(viewData) ? (
        <Empty
          className="my-4"
          description={t('message.no-execution-runs-found')}
        />
      ) : (
        <Grid className="layout-row layout-grid w-full">
          <Grid.Item className="layout-column" span={12}>
            <Tree
              defaultExpandAll
              showIcon
              showLine={{ showLeafIcon: false }}
              switcherIcon={<></>}
              treeData={treeLabelList}
            />
          </Grid.Item>
          <Grid.Item className="layout-column" span={12}>
            <Tree
              defaultExpandAll
              showIcon
              className="tree-without-indent"
              switcherIcon={<></>}
              treeData={treeDataList}
            />
          </Grid.Item>
        </Grid>
      )}
    </Card>
  );
};

export default TreeViewTab;
