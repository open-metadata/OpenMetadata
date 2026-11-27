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

import { Typography } from '@openmetadata/ui-core-components';
import {
  Check,
  TotalOccurrences,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import {
  lazy,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { observerOptions } from '../../../../constants/Mydata.constants';
import {
  INCIDENT_TASK_ID_PARAM,
  INCIDENT_TASK_TYPES,
} from '../../../../constants/Task.constant';
import { EntityType } from '../../../../enums/entity.enum';
import { useElementInView } from '../../../../hooks/useElementInView';
import { useFqn } from '../../../../hooks/useFqn';
import { useTestCaseStore } from '../../../../pages/IncidentManager/IncidentManagerDetailPage/useTestCase.store';
import {
  getTaskById,
  getTaskCounts,
  Task,
  TaskStatusGroup,
} from '../../../../rest/tasksAPI';
import { isTaskTerminalStatus } from '../../../../utils/TaskNavigationUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import TaskListV1 from '../../../ActivityFeed/ActivityFeedList/TaskListV1.component';
import { useActivityFeedProvider } from '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import withSuspenseFallback from '../../../AppRouter/withSuspenseFallback';
import Loader from '../../../common/Loader/Loader';
import './test-case-incident-tab.style.less';

type TaskFilter = 'open' | 'close';

const TaskTabNew = withSuspenseFallback(
  lazy(() =>
    import('../../../Entity/Task/TaskTab/TaskTabNew.component').then((m) => ({
      default: m.TaskTabNew,
    }))
  )
);

const useLinkedIncidentSelection = (
  decodedFqn: string,
  selectedTask: Task | undefined,
  setActiveTask: (task?: Task) => void,
  setTaskFilter: (filter: TaskFilter) => void
) => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const linkedTaskId = searchParams.get(INCIDENT_TASK_ID_PARAM);
  const [loadedTaskLink, setLoadedTaskLink] = useState<string>();
  const taskLink =
    linkedTaskId && decodedFqn ? `${decodedFqn}/${linkedTaskId}` : undefined;
  const isLoadingLinkedTask = Boolean(taskLink && loadedTaskLink !== taskLink);
  const isLinkedTaskSelected = Boolean(
    selectedTask &&
      selectedTask.id === linkedTaskId &&
      selectedTask.about?.fullyQualifiedName === decodedFqn
  );

  useEffect(() => {
    if (!linkedTaskId || !decodedFqn) {
      setLoadedTaskLink(undefined);

      return;
    }

    let cancelled = false;
    getTaskById(linkedTaskId, {
      fields: 'assignees,createdBy,about,comments,payload',
    })
      .then(({ data: incident }) => {
        if (
          cancelled ||
          !INCIDENT_TASK_TYPES.has(incident.type) ||
          incident.about?.type !== EntityType.TEST_CASE ||
          incident.about.fullyQualifiedName !== decodedFqn
        ) {
          return;
        }

        setTaskFilter(isTaskTerminalStatus(incident.status) ? 'close' : 'open');
        setActiveTask(incident);
      })
      .catch((error) => {
        if (!cancelled) {
          showErrorToast(
            error,
            t('server.entity-fetch-error', { entity: t('label.incident') })
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadedTaskLink(taskLink);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [decodedFqn, linkedTaskId, setActiveTask, setTaskFilter, t, taskLink]);

  return { isLoadingLinkedTask, isLinkedTaskSelected };
};

const TestCaseIncidentTab = () => {
  const { t } = useTranslation();
  const { fqn: decodedFqn } = useFqn();
  const { testCase } = useTestCaseStore();

  const owners = useMemo(() => testCase?.owners, [testCase]);

  const {
    getTaskData,
    loading,
    entityPaging,
    tasks,
    selectedTask,
    setActiveTask,
  } = useActivityFeedProvider();
  const [elementRef, isInView] = useElementInView({
    ...observerOptions,
    root: document.querySelector('#center-container'),
    rootMargin: '0px 0px 2px 0px',
  });
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('open');
  const [openTasksCount, setOpenTasksCount] = useState(0);
  const [closedTasksCount, setClosedTasksCount] = useState(0);
  const { isLoadingLinkedTask, isLinkedTaskSelected } =
    useLinkedIncidentSelection(
      decodedFqn,
      selectedTask,
      setActiveTask,
      setTaskFilter
    );
  const displayedTasks = useMemo(() => {
    if (
      !isLinkedTaskSelected ||
      !selectedTask ||
      tasks.some(({ id }) => id === selectedTask.id)
    ) {
      return tasks;
    }

    return [selectedTask, ...tasks];
  }, [isLinkedTaskSelected, selectedTask, tasks]);
  const showTaskDetails =
    !isLoadingLinkedTask && (!loading || isLinkedTaskSelected);

  const statusGroup =
    taskFilter === 'open' ? TaskStatusGroup.Open : TaskStatusGroup.Closed;

  const fetchCounts = useCallback(async () => {
    if (!decodedFqn) {
      return;
    }
    try {
      const counts = await getTaskCounts({ aboutEntity: decodedFqn });
      setOpenTasksCount(counts.open ?? 0);
      setClosedTasksCount(counts.completed ?? 0);
    } catch {
      // Badge counts are a UI affordance; don't block on failure.
    }
  }, [decodedFqn]);

  const handleFeedFetchFromFeedList = useCallback(
    (after?: string) => {
      getTaskData(
        undefined,
        after,
        EntityType.TEST_CASE,
        decodedFqn,
        statusGroup
      );
    },
    [decodedFqn, getTaskData, statusGroup]
  );

  useEffect(() => {
    if (decodedFqn && !isLoadingLinkedTask) {
      handleFeedFetchFromFeedList();
      fetchCounts();
    }
  }, [
    decodedFqn,
    handleFeedFetchFromFeedList,
    fetchCounts,
    isLoadingLinkedTask,
  ]);

  useEffect(() => {
    if (!decodedFqn || isLoadingLinkedTask) {
      return;
    }
    if (isInView && entityPaging.after && !loading) {
      handleFeedFetchFromFeedList(entityPaging.after);
    }
  }, [
    entityPaging,
    loading,
    isInView,
    decodedFqn,
    handleFeedFetchFromFeedList,
    isLoadingLinkedTask,
  ]);

  const handleTaskClick = useCallback(
    (task: Task) => {
      if (selectedTask?.id !== task?.id) {
        setActiveTask(task);
      }
    },
    [setActiveTask, selectedTask]
  );

  const loader = useMemo(() => (loading ? <Loader /> : null), [loading]);

  const handleUpdateTaskFilter = (filter: TaskFilter) => {
    setTaskFilter(filter);
  };

  const handleAfterTaskClose = () => {
    fetchCounts();
    handleFeedFetchFromFeedList();
    handleUpdateTaskFilter('close');
  };

  const handleOpenCloseTaskClick = (currentFilter: TaskFilter) => {
    if (currentFilter === taskFilter) {
      return;
    }
    handleUpdateTaskFilter(taskFilter === 'close' ? 'open' : 'close');
    setActiveTask();
  };

  return (
    <div
      className="h-full incident-page-issue-tab"
      data-testid="issue-tab-container">
      <div
        className="left-container"
        data-testid="left-container"
        id="left-container">
        <div className="d-flex gap-4 p-sm p-x-lg">
          <Typography
            className={classNames(
              'cursor-pointer p-l-xss d-flex items-center',
              {
                'font-medium': taskFilter === 'open',
              }
            )}
            data-testid="open-task"
            onClick={() => handleOpenCloseTaskClick('open')}>
            <TotalOccurrences className="m-r-xss" size={14} /> {openTasksCount}{' '}
            {t('label.open')}
          </Typography>
          <Typography
            className={classNames('cursor-pointer d-flex items-center', {
              'font-medium': taskFilter === 'close',
            })}
            data-testid="closed-task"
            onClick={() => handleOpenCloseTaskClick('close')}>
            <Check className="m-r-xss" size={14} /> {closedTasksCount}{' '}
            {t('label.closed')}
          </Typography>
        </div>

        <TaskListV1
          activeFeedId={selectedTask?.id}
          emptyPlaceholderText={t('label.no-entity', {
            entity: t('label.task-plural'),
          })}
          isLoading={
            isLoadingLinkedTask || (loading && isEmpty(displayedTasks))
          }
          selectedTask={selectedTask}
          taskList={displayedTasks}
          onTaskClick={isLoadingLinkedTask ? undefined : handleTaskClick}
        />
        {!isEmpty(tasks) && loader}
        <div
          className="w-full"
          data-testid="observer-element"
          id="observer-element"
          ref={elementRef as RefObject<HTMLDivElement>}
          style={{ height: '2px' }}
        />
      </div>
      <div className="right-container" data-testid="right-container">
        {loader}
        {showTaskDetails && selectedTask && (
          <div id="task-panel">
            <TaskTabNew
              entityType={EntityType.TEST_CASE}
              isForFeedTab={false}
              owners={owners}
              task={selectedTask}
              onAfterClose={handleAfterTaskClose}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default TestCaseIncidentTab;
