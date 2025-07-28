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
import { Empty, Typography } from 'antd';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CompletedIcon } from '../../../../../assets/svg/ic-check-circle-new.svg';
import { ReactComponent as PendingIcon } from '../../../../../assets/svg/pending-badge-1.svg';
import { GLOSSARY_TERM_APPROVAL_WORKFLOW_DEFINITION_NAME } from '../../../../../constants/Glossary.contant';
import {
  GlossaryTerm,
  Status,
} from '../../../../../generated/entity/data/glossaryTerm';
import {
  WorkflowInstanceState,
  WorkflowStatus,
} from '../../../../../generated/governance/workflows/workflowInstanceState';
import {
  getWorkflowInstancesForApplication,
  getWorkflowInstanceStateById,
} from '../../../../../rest/workflowAPI';
import {
  getCurrentMillis,
  getEpochMillisForPastDays,
  getShortRelativeTime,
} from '../../../../../utils/date-time/DateTimeUtils';
import { createGlossaryTermEntityLink } from '../../../../../utils/GlossaryTerm/GlossaryTermUtil';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import Loader from '../../../../common/Loader/Loader';
import { useGenericContext } from '../../../../Customization/GenericProvider/GenericProvider';
import './workflow-history.less';

const { Text } = Typography;

interface WorkflowHistoryProps {
  glossaryTerm?: GlossaryTerm;
}

const WorkflowHistory = memo(
  ({ glossaryTerm: propGlossaryTerm }: WorkflowHistoryProps) => {
    const { t } = useTranslation();
    const { data: contextGlossaryTerm } = useGenericContext<GlossaryTerm>();

    // Use prop if provided, otherwise fall back to context
    const glossaryTerm = propGlossaryTerm || contextGlossaryTerm;

    const [workflowHistory, setWorkflowHistory] = useState<
      WorkflowInstanceState[]
    >([]);
    const [isLoading, setIsLoading] = useState(false);

    // Collapse only when status is approved
    const initialCollapseState = useMemo(() => {
      const status = glossaryTerm?.status ?? Status.Approved;

      return status === Status.Approved && !propGlossaryTerm;
    }, [glossaryTerm?.status]);

    const [isCollapsed, setIsCollapsed] = useState(initialCollapseState);

    const toggleCollapse = useCallback(() => {
      setIsCollapsed((prev) => !prev);
    }, []);

    const fetchWorkflowHistory = useCallback(async () => {
      if (!glossaryTerm?.fullyQualifiedName) {
        return;
      }

      setIsLoading(true);
      try {
        const startTs = getEpochMillisForPastDays(30);
        const endTs = getCurrentMillis();
        const entityLink = createGlossaryTermEntityLink(
          glossaryTerm.fullyQualifiedName
        );

        // First, get workflow instances
        const instancesResponse = await getWorkflowInstancesForApplication({
          startTs,
          endTs,
          entityLink,
          workflowDefinitionName: 'GlossaryTermApprovalWorkflow',
        });

        const instances = instancesResponse.data || [];

        if (instances.length === 0) {
          setWorkflowHistory([]);

          return;
        }

        // Then fetch detailed states for each instance
        const statesPromises = await getWorkflowInstanceStateById(
          GLOSSARY_TERM_APPROVAL_WORKFLOW_DEFINITION_NAME,
          instances[0]?.id ?? '',
          {
            startTs,
            endTs,
          }
        );
        const reverseStates = statesPromises.data.reverse();
        setWorkflowHistory(reverseStates);
      } catch (error) {
        showErrorToast(error as string);
        setWorkflowHistory([]);
      } finally {
        setIsLoading(false);
      }
    }, [glossaryTerm?.fullyQualifiedName]);

    useEffect(() => {
      fetchWorkflowHistory();
    }, [fetchWorkflowHistory]);

    // Update collapsed state when glossary term status changes
    useEffect(() => {
      setIsCollapsed(initialCollapseState);
    }, [initialCollapseState]);

    const { completedSteps, totalSteps } = useMemo(() => {
      const completed = workflowHistory.filter(
        (item) => item.status === WorkflowStatus.Finished
      ).length;
      const total = workflowHistory.length;

      return {
        completedSteps: completed,
        totalSteps: total,
      };
    }, [workflowHistory]);

    const getStatusIcon = useCallback((status: string) => {
      switch (status) {
        case WorkflowStatus.Finished:
          return (
            <div className="completed-icon bedge-icon flex-center">
              <CompletedIcon data-testid="completed-icon" width={10} />
            </div>
          );
        case WorkflowStatus.Running:
        case WorkflowStatus.Exception:
        case WorkflowStatus.Failure:
        default:
          return (
            <div className="pending-icon bedge-icon flex-center">
              <PendingIcon data-testid="pending-icon" width={12} />
            </div>
          );
      }
    }, []);

    const renderTimelineItem = useCallback(
      (item: WorkflowInstanceState) => (
        <div
          className="timeline-container flex gap-2 w-full relative"
          key={item.id}>
          <div className="relative z-10">
            {getStatusIcon(item.status || 'RUNNING')}
          </div>
          <div className="horizontal-line" />
          <div className="d-flex flex-col w-full">
            <div className="stage-name font-medium">
              {item.stage?.displayName ?? item.stage?.name}
            </div>
            <div className="stage-time">
              {getShortRelativeTime(item.timestamp)}
            </div>
          </div>
        </div>
      ),
      [getStatusIcon]
    );

    const workflowSteps = useMemo(
      () =>
        Array.from({ length: totalSteps }, (_, index) => (
          <div
            className={`workflow-step ${
              index < completedSteps ? 'completed' : 'pending'
            }`}
            key={index}
          />
        )),
      [totalSteps, completedSteps]
    );

    const workflowContent = useMemo(() => {
      if (isLoading) {
        return <Loader />;
      }

      if (isEmpty(workflowHistory)) {
        return (
          <Empty
            description={
              <Text className="text-grey-muted">
                {t('label.no-entity-available', {
                  entity: t('label.workflow-history'),
                })}
              </Text>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        );
      }

      return (
        <div
          className={classNames('workflow-history-widget', {
            'workflow-history-widget-rightPanel': !propGlossaryTerm,
          })}>
          <div
            className=" cursor-pointer d-flex flex-col w-full gap-2"
            role="button"
            tabIndex={0}
            onClick={toggleCollapse}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleCollapse();
              }
            }}>
            <div className="workflow-header d-flex justify-between align-center w-full">
              <div className="d-flex align-center gap-2">
                <Text className="workflow-title">
                  {t('label.workflow-history')}
                </Text>
              </div>
              <Text className="workflow-counter">
                {completedSteps}/{totalSteps}
              </Text>
            </div>
            <div className="workflow-progress w-full">
              <div className="workflow-steps">{workflowSteps}</div>
            </div>
          </div>
          {!isCollapsed && (
            <div className="workflow-timeline flex flex-col">
              {workflowHistory.map(renderTimelineItem)}
            </div>
          )}
        </div>
      );
    }, [
      isLoading,
      workflowHistory,
      completedSteps,
      totalSteps,
      workflowSteps,
      renderTimelineItem,
      propGlossaryTerm,
      isCollapsed,
      toggleCollapse,
    ]);

    return workflowContent;
  }
);

export default WorkflowHistory;
