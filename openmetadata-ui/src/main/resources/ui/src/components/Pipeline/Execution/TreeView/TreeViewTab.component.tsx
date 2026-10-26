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

import {
  Box,
  Card,
  Grid,
  Tree,
  Typography,
} from '@openmetadata/ui-core-components';
import { ClockRewind } from '@openmetadata/ui-core-components/icons';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ArrowSvg } from '../../../../assets/svg/vector.svg';
import {
  PipelineStatus,
  Task,
} from '../../../../generated/entity/data/pipeline';
import { TreeNode } from '../../../../interface/tree.interface';
import { getLayoutGutter } from '../../../../utils/common/layout.utils';
import { formatDateTime } from '../../../../utils/date-time/DateTimeUtils';
import { getTreeData, getTreeViewData } from '../../../../utils/executionUtils';
import NoDataPlaceholder from '../../../common/EmptyPlaceholder/NoDataPlaceholder';
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

  const renderNode = (
    node: TreeNode,
    showGuideLines: boolean
  ): React.ReactNode => (
    <Tree.Item id={node.key} key={node.key} textValue={String(node.key)}>
      <Tree.ItemContent
        className="tw:min-h-9"
        indentPerLevel={showGuideLines ? 22 : 0}
        showExpandIcon={false}
        showGuideLines={showGuideLines}>
        {node.icon}
        {node.title}
      </Tree.ItemContent>
      {node.children?.map((child) => renderNode(child, showGuideLines))}
    </Tree.Item>
  );
  const expandedKeys = (nodes: TreeNode[]): (string | number)[] =>
    nodes.flatMap((node) => [node.key, ...expandedKeys(node.children ?? [])]);

  return (
    <Card>
      <Card.Content>
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
          <Box className="tw:relative tw:my-4 tw:min-h-40">
            <NoDataPlaceholder
              description={t('message.no-execution-runs-found')}
              icon={<ClockRewind />}
            />
          </Box>
        ) : (
          <Grid className="layout-row layout-grid w-full">
            <Grid.Item className="layout-column" span={12}>
              <Tree
                aria-label={t('label.task-plural')}
                defaultExpandedKeys={expandedKeys(treeLabelList)}
                selectionMode="none">
                {treeLabelList.map((node) => renderNode(node, true))}
              </Tree>
            </Grid.Item>
            <Grid.Item className="layout-column" span={12}>
              <Tree
                aria-label={t('label.task-plural')}
                defaultExpandedKeys={expandedKeys(treeDataList)}
                selectionMode="none">
                {treeDataList.map((node) => renderNode(node, false))}
              </Tree>
            </Grid.Item>
          </Grid>
        )}
      </Card.Content>
    </Card>
  );
};

export default TreeViewTab;
