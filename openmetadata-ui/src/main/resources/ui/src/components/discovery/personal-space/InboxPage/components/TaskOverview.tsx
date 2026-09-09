/*
 *  Copyright 2026 Collate.
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

import { Box, Button, Typography } from '@openmetadata/ui-core-components';
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ProfilePicture from '../../../../../components/common/ProfilePicture/ProfilePicture';
import RichTextEditorPreviewerV1 from '../../../../../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import { Task } from '../../../../../generated/entity/tasks/task';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import {
  EXTENSION_POINTS,
  InboxTaskPanelContribution,
} from '../../../../../utils/ExtensionPointTypes';
import { getFrontEndFormat } from '../../../../../utils/FeedUtilsPure';
import { useApplicationsProvider } from '../../../../Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import { getTaskResolutionSummary } from '../taskResolution.utils';

export interface TaskOverviewProps {
  task: Task;
}

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <Box className="tw:grid tw:grid-cols-[200px_1fr] tw:items-start tw:gap-3">
    <Typography className="tw:text-quaternary" size="text-xs" weight="medium">
      {label}
    </Typography>
    <div className="tw:min-w-0 tw:break-words tw:text-xs">{children}</div>
  </Box>
);

/**
 * Assignee chips clamped to the first two rows, with a Show more / Show less
 * toggle when the list overflows. Measures actual chip wrapping (offsetTop rows)
 * so the clamp matches whatever the panel width allows, and re-measures on resize.
 */
const CollapsibleAssignees: React.FC<{
  assignees: NonNullable<Task['assignees']>;
}> = ({ assignees }) => {
  const { t } = useTranslation();
  const listRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [collapsedHeight, setCollapsedHeight] = useState<number>();

  const measure = useCallback(() => {
    const el = listRef.current;
    if (!el) {
      return;
    }
    const chips = Array.from(el.children) as HTMLElement[];
    const rowTops = Array.from(
      new Set(chips.map((chip) => chip.offsetTop))
    ).sort((a, b) => a - b);

    // Two rows or fewer: everything already fits, so drop the clamp + toggle.
    if (rowTops.length <= 2) {
      setCollapsedHeight(undefined);

      return;
    }

    const secondRowBottom = Math.max(
      ...chips
        .filter((chip) => chip.offsetTop === rowTops[1])
        .map((chip) => chip.offsetTop + chip.offsetHeight)
    );
    setCollapsedHeight(secondRowBottom - rowTops[0]);
  }, []);

  useLayoutEffect(() => {
    measure();
    const el = listRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);

    return () => observer.disconnect();
  }, [measure, assignees]);

  const isCollapsible = collapsedHeight !== undefined;
  const isClamped = isCollapsible && !expanded;

  return (
    <Box direction="col" gap={2}>
      <div
        className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:overflow-hidden"
        ref={listRef}
        style={isClamped ? { maxHeight: collapsedHeight } : undefined}>
        {assignees.map((assignee) => (
          <Box align="center" gap={1} key={assignee.id}>
            <ProfilePicture
              displayName={assignee.name}
              name={assignee.name ?? ''}
              width="18"
            />
            <Typography size="text-xs" weight="medium">
              {getEntityName(assignee)}
            </Typography>
          </Box>
        ))}
      </div>
      {isCollapsible && (
        <Button
          className="tw:self-start"
          color="link-color"
          data-testid="assignees-toggle"
          size="xs"
          onClick={() => setExpanded((prev) => !prev)}>
          {expanded ? t('label.show-less') : t('label.show-more')}
        </Button>
      )}
    </Box>
  );
};

/**
 * Overview tab content for a task. Data Access Requests use the borderless
 * figma-v1 panel; all other task types fall back to a generic summary.
 */
const TaskOverview: React.FC<TaskOverviewProps> = ({ task }) => {
  const { t } = useTranslation();
  const { extensionRegistry } = useApplicationsProvider();

  // A plugin can contribute a task-type-specific panel (e.g. Data Access
  // Request) that replaces the generic overview for matching tasks. Standalone
  // OSS renders the generic overview below when nothing is contributed.
  const taskPanel = extensionRegistry
    .getContributions<InboxTaskPanelContribution>(
      EXTENSION_POINTS.INBOX_TASK_PANELS
    )
    .find((panel) => panel.condition(task));

  if (taskPanel) {
    const TaskPanel = taskPanel.component;

    return <TaskPanel id={task.id} task={task} />;
  }

  const assignees = task.assignees ?? [];
  // Outcome rows for a closed task; the status itself sits beside the title.
  const resolution = getTaskResolutionSummary(task);

  return (
    <Box direction="col" gap={4}>
      {assignees.length > 0 && (
        <Row label={t('label.assignee-plural')}>
          <CollapsibleAssignees assignees={assignees} />
        </Row>
      )}
      {task.description && (
        <Row label={t('label.description')}>
          <RichTextEditorPreviewerV1
            className="tw:text-primary tw:[&_.tiptap]:text-xs!"
            markdown={getFrontEndFormat(task.description)}
          />
        </Row>
      )}
      {resolution?.resolvedByName && (
        <Row label={t('label.resolved-by')}>
          <Box align="center" gap={1}>
            <ProfilePicture
              displayName={resolution.resolvedByName}
              name={resolution.resolvedBy?.name ?? ''}
              width="18"
            />
            <Typography size="text-xs" weight="medium">
              {resolution.resolvedByName}
            </Typography>
          </Box>
        </Row>
      )}
      {resolution?.resolvedOn && (
        <Row label={t('label.resolved-on')}>
          <Typography size="text-xs" weight="medium">
            {resolution.resolvedOn}
          </Typography>
        </Row>
      )}
      {resolution?.hasResolution && (
        <Row label={t(resolution.commentLabelKey)}>
          <Typography size="text-xs" weight="medium">
            {resolution.comment}
          </Typography>
        </Row>
      )}
    </Box>
  );
};

export default TaskOverview;
