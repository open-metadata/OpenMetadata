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
import { AxiosError } from 'axios';
import { Operation } from 'fast-json-patch';
import { orderBy } from 'lodash';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE_LARGE } from '../../../constants/constants';
import { TestCaseResolutionStatus } from '../../../generated/tests/testCaseResolutionStatus';
import { Paging } from '../../../generated/type/paging';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { getListTestCaseIncidentByStateId } from '../../../rest/incidentManagerAPI';
import {
  addTaskComment,
  closeTask,
  createTask,
  deleteTaskComment,
  editTaskComment,
  getTaskById,
  listMyAssignedTasks,
  listMyCreatedTasks,
  listTasks,
  ListTasksParams,
  patchTask,
  resolveTask,
  ResolveTask,
  Task,
  TaskEntityStatus,
} from '../../../rest/tasksAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

interface TaskProviderProps {
  children: ReactNode;
}

interface TaskProviderContextType {
  tasks: Task[];
  selectedTask: Task | undefined;
  loading: boolean;
  isCommentsLoading: boolean;
  isTestCaseResolutionLoading: boolean;
  testCaseResolutionStatus: TestCaseResolutionStatus[];
  paging: Paging;
  // Task CRUD operations
  fetchTasks: (params?: ListTasksParams) => Promise<void>;
  fetchMyAssignedTasks: (status?: TaskEntityStatus) => Promise<void>;
  fetchMyCreatedTasks: (status?: TaskEntityStatus) => Promise<void>;
  fetchTaskById: (id: string) => Promise<Task | undefined>;
  createNewTask: (
    task: Parameters<typeof createTask>[0]
  ) => Promise<Task | undefined>;
  updateTask: (id: string, patch: Operation[]) => Promise<Task | undefined>;
  resolveTaskById: (id: string, data: ResolveTask) => Promise<Task | undefined>;
  closeTaskById: (id: string, comment?: string) => Promise<Task | undefined>;
  addComment: (taskId: string, message: string) => Promise<Task | undefined>;
  editComment: (
    taskId: string,
    commentId: string,
    message: string
  ) => Promise<Task | undefined>;
  deleteComment: (
    taskId: string,
    commentId: string
  ) => Promise<Task | undefined>;
  // Selection and state
  setSelectedTask: (task: Task | undefined) => void;
  refreshTask: (id: string) => Promise<void>;
  updateTestCaseIncidentStatus: (status: TestCaseResolutionStatus[]) => void;
}

const TaskContext = createContext<TaskProviderContextType>(
  {} as TaskProviderContextType
);

const TASK_FIELDS =
  'assignees,reviewers,watchers,about,domain,comments,createdBy';

export const TaskProvider = ({ children }: TaskProviderProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | undefined>();
  const [loading, setLoading] = useState(false);
  const [isCommentsLoading] = useState(false);
  const [isTestCaseResolutionLoading, setIsTestCaseResolutionLoading] =
    useState(false);
  const [testCaseResolutionStatus, setTestCaseResolutionStatus] = useState<
    TestCaseResolutionStatus[]
  >([]);
  const [paging, setPaging] = useState<Paging>({} as Paging);

  const fetchTestCaseResolution = useCallback(async (id: string) => {
    setIsTestCaseResolutionLoading(true);
    try {
      const { data } = await getListTestCaseIncidentByStateId(id, {
        limit: PAGE_SIZE_LARGE,
      });
      setTestCaseResolutionStatus(
        orderBy(data, (item) => item.timestamp, ['asc'])
      );
    } catch {
      setTestCaseResolutionStatus([]);
    } finally {
      setIsTestCaseResolutionLoading(false);
    }
  }, []);

  const fetchTasks = useCallback(async (params?: ListTasksParams) => {
    setLoading(true);
    try {
      const response = await listTasks({
        fields: TASK_FIELDS,
        ...params,
      });
      setTasks(response.data);
      setPaging(response.paging);
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        t('server.entity-fetch-error', { entity: t('label.task-plural') })
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMyAssignedTasks = useCallback(
    async (status?: TaskEntityStatus) => {
      setLoading(true);
      try {
        const response = await listMyAssignedTasks({
          fields: TASK_FIELDS,
          status,
        });
        setTasks(response.data);
        setPaging(response.paging);
      } catch (err) {
        showErrorToast(
          err as AxiosError,
          t('server.entity-fetch-error', { entity: t('label.task-plural') })
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const fetchMyCreatedTasks = useCallback(async (status?: TaskEntityStatus) => {
    setLoading(true);
    try {
      const response = await listMyCreatedTasks({
        fields: TASK_FIELDS,
        status,
      });
      setTasks(response.data);
      setPaging(response.paging);
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        t('server.entity-fetch-error', { entity: t('label.task-plural') })
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTaskById = useCallback(async (id: string) => {
    try {
      const response = await getTaskById(id, { fields: TASK_FIELDS });
      const task = response.data;
      setSelectedTask(task);

      // Fetch test case resolution if applicable
      if (
        task.type === 'TestCaseResolution' &&
        task.payload &&
        typeof task.payload === 'object' &&
        'testCaseResolutionStatusId' in task.payload
      ) {
        fetchTestCaseResolution(
          task.payload.testCaseResolutionStatusId as string
        );
      }

      return task;
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        t('server.entity-fetch-error', { entity: t('label.task') })
      );

      return undefined;
    }
  }, []);

  const createNewTask = useCallback(
    async (taskData: Parameters<typeof createTask>[0]) => {
      try {
        const task = await createTask(taskData);
        showSuccessToast(
          t('server.create-entity-success', { entity: t('label.task') })
        );

        return task;
      } catch (err) {
        showErrorToast(
          err as AxiosError,
          t('server.create-entity-error', { entity: t('label.task') })
        );

        return undefined;
      }
    },
    []
  );

  const updateTask = useCallback(
    async (id: string, patch: Operation[]) => {
      try {
        const task = await patchTask(id, patch);

        // Update in tasks list
        setTasks((prev) => prev.map((t) => (t.id === id ? task : t)));

        // Update selected task if it matches
        if (selectedTask?.id === id) {
          setSelectedTask(task);
        }

        return task;
      } catch (err) {
        showErrorToast(
          err as AxiosError,
          t('server.entity-updating-error', { entity: t('label.task') })
        );

        return undefined;
      }
    },
    [selectedTask]
  );

  const resolveTaskById = useCallback(
    async (id: string, data: ResolveTask) => {
      try {
        const task = await resolveTask(id, data);
        showSuccessToast(t('server.task-resolved-successfully'));

        // Update in tasks list
        setTasks((prev) => prev.map((t) => (t.id === id ? task : t)));

        // Update selected task if it matches
        if (selectedTask?.id === id) {
          setSelectedTask(task);
        }

        return task;
      } catch (err) {
        showErrorToast(err as AxiosError, t('server.unexpected-error'));

        return undefined;
      }
    },
    [selectedTask]
  );

  const closeTaskById = useCallback(
    async (id: string, comment?: string) => {
      try {
        const task = await closeTask(id, comment);
        showSuccessToast(t('server.task-closed-successfully'));

        // Update in tasks list
        setTasks((prev) => prev.map((t) => (t.id === id ? task : t)));

        // Update selected task if it matches
        if (selectedTask?.id === id) {
          setSelectedTask(task);
        }

        return task;
      } catch (err) {
        showErrorToast(err as AxiosError, t('server.unexpected-error'));

        return undefined;
      }
    },
    [selectedTask]
  );

  const addComment = useCallback(
    async (taskId: string, message: string) => {
      if (!currentUser) {
        return undefined;
      }

      try {
        const task = await addTaskComment(taskId, message);

        // Update in tasks list
        setTasks((prev) => prev.map((t) => (t.id === taskId ? task : t)));

        // Update selected task if it matches
        if (selectedTask?.id === taskId) {
          setSelectedTask(task);
        }

        return task;
      } catch (err) {
        showErrorToast(
          err as AxiosError,
          t('server.add-entity-error', { entity: t('label.comment') })
        );

        return undefined;
      }
    },
    [currentUser, selectedTask]
  );

  const editComment = useCallback(
    async (taskId: string, commentId: string, message: string) => {
      if (!currentUser) {
        return undefined;
      }

      try {
        const task = await editTaskComment(taskId, commentId, message);

        // Update in tasks list
        setTasks((prev) => prev.map((t) => (t.id === taskId ? task : t)));

        // Update selected task if it matches
        if (selectedTask?.id === taskId) {
          setSelectedTask(task);
        }

        showSuccessToast(
          t('server.update-entity-success', { entity: t('label.comment') })
        );

        return task;
      } catch (err) {
        showErrorToast(
          err as AxiosError,
          t('server.entity-updating-error', { entity: t('label.comment') })
        );

        return undefined;
      }
    },
    [currentUser, selectedTask]
  );

  const deleteComment = useCallback(
    async (taskId: string, commentId: string) => {
      if (!currentUser) {
        return undefined;
      }

      try {
        const task = await deleteTaskComment(taskId, commentId);

        // Update in tasks list
        setTasks((prev) => prev.map((t) => (t.id === taskId ? task : t)));

        // Update selected task if it matches
        if (selectedTask?.id === taskId) {
          setSelectedTask(task);
        }

        showSuccessToast(
          t('server.delete-entity-success', { entity: t('label.comment') })
        );

        return task;
      } catch (err) {
        showErrorToast(
          err as AxiosError,
          t('server.delete-entity-error', { entity: t('label.comment') })
        );

        return undefined;
      }
    },
    [currentUser, selectedTask]
  );

  const refreshTask = useCallback(
    async (id: string) => {
      try {
        const response = await getTaskById(id, { fields: TASK_FIELDS });
        const task = response.data;

        // Update in tasks list
        setTasks((prev) => prev.map((t) => (t.id === id ? task : t)));

        // Update selected task if it matches
        if (selectedTask?.id === id) {
          setSelectedTask(task);
        }
      } catch {
        // Silently fail refresh
      }
    },
    [selectedTask]
  );

  const updateTestCaseIncidentStatus = useCallback(
    (status: TestCaseResolutionStatus[]) => {
      setTestCaseResolutionStatus(status);
    },
    []
  );

  const contextValue = useMemo(
    () => ({
      tasks,
      selectedTask,
      loading,
      isCommentsLoading,
      isTestCaseResolutionLoading,
      testCaseResolutionStatus,
      paging,
      fetchTasks,
      fetchMyAssignedTasks,
      fetchMyCreatedTasks,
      fetchTaskById,
      createNewTask,
      updateTask,
      resolveTaskById,
      closeTaskById,
      addComment,
      editComment,
      deleteComment,
      setSelectedTask,
      refreshTask,
      updateTestCaseIncidentStatus,
    }),
    [
      tasks,
      selectedTask,
      loading,
      isCommentsLoading,
      isTestCaseResolutionLoading,
      testCaseResolutionStatus,
      paging,
      fetchTasks,
      fetchMyAssignedTasks,
      fetchMyCreatedTasks,
      fetchTaskById,
      createNewTask,
      updateTask,
      resolveTaskById,
      closeTaskById,
      addComment,
      editComment,
      deleteComment,
      refreshTask,
      updateTestCaseIncidentStatus,
    ]
  );

  return (
    <TaskContext.Provider value={contextValue}>{children}</TaskContext.Provider>
  );
};

export const useTaskProvider = () => useContext(TaskContext);

export default TaskProvider;
