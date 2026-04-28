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

import {
  Box,
  Button,
  Divider,
  Dropdown,
  Input,
  Label,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { debounce, isEmpty } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { STATUS_COLORS } from '../../../../constants/Color.constants';
import { PAGE_SIZE_BASE } from '../../../../constants/constants';
import { TEST_CASE_RESOLUTION_STATUS_LABELS } from '../../../../constants/TestSuite.constant';
import { EntityType } from '../../../../enums/entity.enum';
import {
  EntityReference,
  TestCaseFailureReasonType,
  TestCaseResolutionStatusTypes,
} from '../../../../generated/tests/testCaseResolutionStatus';
import { Option } from '../../../../pages/TasksPage/TasksPage.interface';
import {
  getListTestCaseIncidentByStateId,
  transitionIncident,
} from '../../../../rest/incidentManagerAPI';
import { getUserAndTeamSearch } from '../../../../rest/miscAPI';
import {
  createTask,
  ResolveTask,
  TaskCategory,
  TaskEntityType,
  TaskResolutionType,
} from '../../../../rest/tasksAPI';
import { getEntityName } from '../../../../utils/EntityUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import Loader from '../../../common/Loader/Loader';
import { UserTag } from '../../../common/UserTag/UserTag.component';
import { ChipTrigger } from './InlineIncidentStatus/ChipTrigger.component';
import { FailureReasonChipGroup } from './InlineIncidentStatus/FailureReasonChipGroup.component';
import { IncidentScrollableList } from './InlineIncidentStatus/IncidentScrollableList.component';
import { IncidentStatusPopoverHeader } from './InlineIncidentStatus/IncidentStatusPopoverHeader.component';
import { IncidentStatusPopoverShell } from './InlineIncidentStatus/IncidentStatusPopoverShell.component';
import { InlineTestCaseIncidentStatusProps } from './TestCaseIncidentManagerStatus.interface';

const SELECTED_ITEM_CLASS =
  'tw:[&[data-selected]>div]:!bg-brand-solid tw:[&[data-selected]>div_*]:!text-white';

const InlineTestCaseIncidentStatus = ({
  data,
  hasEditPermission,
  onSubmit,
}: InlineTestCaseIncidentStatusProps) => {
  const { t } = useTranslation();
  const chipRef = React.useRef<HTMLButtonElement>(null);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showAssigneePopover, setShowAssigneePopover] = useState(false);
  const [showResolvedPopover, setShowResolvedPopover] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userOptions, setUserOptions] = useState<Option[]>([]);
  const [selectedAssignee, setSelectedAssignee] =
    useState<EntityReference | null>(
      data?.testCaseResolutionStatusDetails?.assignee ?? null
    );
  const [selectedReason, setSelectedReason] =
    useState<TestCaseFailureReasonType | null>(null);
  const [comment, setComment] = useState('');

  const statusType = data.testCaseResolutionStatusType;

  const initialOptions = useMemo(() => {
    const assignee = data?.testCaseResolutionStatusDetails?.assignee;
    if (assignee) {
      return [
        {
          label: getEntityName(assignee),
          value: assignee.id || '',
          type: assignee.type,
          name: assignee.name,
          displayName: assignee.displayName,
        },
      ];
    }

    return [];
  }, [data?.testCaseResolutionStatusDetails?.assignee]);

  const searchUsers = useCallback(
    async (query: string) => {
      setIsLoadingUsers(true);
      try {
        const res = await getUserAndTeamSearch(query, true, PAGE_SIZE_BASE);
        const hits = res.data.hits.hits;
        const suggestOptions: Option[] = hits.map((hit) => ({
          label: getEntityName(hit._source),
          value: hit._id ?? '',
          type: hit._source.entityType,
          name: hit._source.name,
          displayName: hit._source.displayName,
        }));

        if (initialOptions.length > 0) {
          const assigneeId = initialOptions[0].value;
          const isAssigneeInResults = suggestOptions.some(
            (opt) => opt.value === assigneeId
          );
          if (isAssigneeInResults) {
            const filteredOptions = suggestOptions.filter(
              (opt) => opt.value !== assigneeId
            );
            setUserOptions([initialOptions[0], ...filteredOptions]);
          } else {
            setUserOptions([initialOptions[0], ...suggestOptions]);
          }
        } else {
          setUserOptions(suggestOptions);
        }
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setIsLoadingUsers(false);
      }
    },
    [initialOptions]
  );

  const debouncedSearch = useMemo(
    () => debounce(searchUsers, 300),
    [searchUsers]
  );

  const handleSearchUsers = useCallback(
    (query: string) => {
      if (isEmpty(query)) {
        searchUsers('');
      } else {
        debouncedSearch(query);
      }
    },
    [debouncedSearch, searchUsers]
  );

  const reopenIncident = useCallback(
    async (
      targetStatus: TestCaseResolutionStatusTypes,
      additionalData?: { assignee?: EntityReference }
    ) => {
      const testCaseFqn = data.testCaseReference?.fullyQualifiedName;
      const testCaseName = data.testCaseReference?.name;
      if (!testCaseFqn || !testCaseName) {
        return;
      }

      setIsLoading(true);
      try {
        const newTask = await createTask({
          name: `Incident: ${testCaseName}`,
          category: TaskCategory.Incident,
          type: TaskEntityType.TestCaseResolution,
          about: testCaseFqn,
          aboutType: 'testCase',
        });

        if (targetStatus !== TestCaseResolutionStatusTypes.New && newTask?.id) {
          const transitionMap: Partial<
            Record<TestCaseResolutionStatusTypes, string>
          > = {
            [TestCaseResolutionStatusTypes.ACK]: 'ack',
            [TestCaseResolutionStatusTypes.Assigned]: 'assign',
          };
          const transitionId = transitionMap[targetStatus];
          if (transitionId) {
            const assignee = additionalData?.assignee;
            await transitionIncident(newTask.id, {
              transitionId,
              payload: assignee
                ? {
                    assignees: [
                      {
                        id: assignee.id,
                        type: assignee.type ?? EntityType.USER,
                        name: assignee.name,
                        fullyQualifiedName:
                          assignee.fullyQualifiedName ?? assignee.name,
                        displayName: assignee.displayName,
                      },
                    ],
                  }
                : undefined,
            });
          }
        }

        const refreshed = await getListTestCaseIncidentByStateId(newTask.id);
        const latest = refreshed?.data?.[0];
        if (latest) {
          onSubmit(latest);
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    },
    [
      data.testCaseReference?.fullyQualifiedName,
      data.testCaseReference?.name,
      onSubmit,
    ]
  );

  const submitStatusChange = useCallback(
    async (
      status: TestCaseResolutionStatusTypes,
      additionalData?: {
        assignee?: EntityReference;
        reason?: TestCaseFailureReasonType;
        comment?: string;
      }
    ) => {
      const currentStatus = data.testCaseResolutionStatusType;

      if (currentStatus === TestCaseResolutionStatusTypes.Resolved) {
        await reopenIncident(status, additionalData);

        return;
      }

      const taskId = data.stateId;
      if (!taskId) {
        return;
      }

      let resolveRequest: ResolveTask;
      if (status === TestCaseResolutionStatusTypes.New) {
        resolveRequest = { transitionId: 'new' };
      } else if (status === TestCaseResolutionStatusTypes.ACK) {
        resolveRequest = { transitionId: 'ack' };
      } else if (status === TestCaseResolutionStatusTypes.Assigned) {
        const transitionId =
          currentStatus === TestCaseResolutionStatusTypes.Assigned
            ? 'reassign'
            : 'assign';
        const assignee = additionalData?.assignee;
        resolveRequest = {
          transitionId,
          payload: assignee
            ? {
                assignees: [
                  {
                    id: assignee.id,
                    type: assignee.type ?? EntityType.USER,
                    name: assignee.name,
                    fullyQualifiedName:
                      assignee.fullyQualifiedName ?? assignee.name,
                    displayName: assignee.displayName,
                  },
                ],
              }
            : undefined,
        };
      } else if (status === TestCaseResolutionStatusTypes.Resolved) {
        resolveRequest = {
          transitionId: 'resolve',
          resolutionType: TaskResolutionType.Completed,
          comment: additionalData?.comment,
          payload: additionalData?.reason
            ? { testCaseFailureReason: additionalData.reason }
            : undefined,
        };
      } else {
        return;
      }

      setIsLoading(true);
      try {
        await transitionIncident(taskId, resolveRequest);

        const refreshed = await getListTestCaseIncidentByStateId(taskId);
        const latest = refreshed?.data?.[0];
        if (latest) {
          onSubmit(latest);
        }

        setShowAssigneePopover(false);
        setShowResolvedPopover(false);
        setSelectedAssignee(null);
        setSelectedReason(null);
        setComment('');
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    },
    [data.stateId, data.testCaseResolutionStatusType, onSubmit, reopenIncident]
  );

  const handleStatusMenuOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setShowStatusMenu(false);

        return;
      }
      if (statusType === TestCaseResolutionStatusTypes.Assigned) {
        searchUsers('');
        setShowAssigneePopover(true);
      } else if (statusType === TestCaseResolutionStatusTypes.Resolved) {
        setSelectedReason(
          data?.testCaseResolutionStatusDetails?.testCaseFailureReason ?? null
        );
        setComment(
          data?.testCaseResolutionStatusDetails?.testCaseFailureComment ?? ''
        );
        setShowResolvedPopover(true);
      } else {
        setShowStatusMenu(true);
      }
    },
    [
      statusType,
      searchUsers,
      data?.testCaseResolutionStatusDetails?.testCaseFailureReason,
      data?.testCaseResolutionStatusDetails?.testCaseFailureComment,
    ]
  );

  const handleStatusChange = useCallback(
    async (newStatus: TestCaseResolutionStatusTypes) => {
      setShowStatusMenu(false);

      if (newStatus === TestCaseResolutionStatusTypes.Assigned) {
        searchUsers('');
        setShowAssigneePopover(true);
      } else if (newStatus === TestCaseResolutionStatusTypes.Resolved) {
        setShowResolvedPopover(true);
      } else {
        await submitStatusChange(newStatus);
      }
    },
    [searchUsers, submitStatusChange]
  );

  const handleBackToStatusMenu = useCallback(() => {
    setShowAssigneePopover(false);
    setShowResolvedPopover(false);
    setSelectedAssignee(
      data?.testCaseResolutionStatusDetails?.assignee ?? null
    );
    setUserOptions([]);
    setSelectedReason(null);
    setComment('');
    setShowStatusMenu(true);
  }, [data?.testCaseResolutionStatusDetails?.assignee]);

  const handleCloseAllPopovers = useCallback(() => {
    setShowAssigneePopover(false);
    setShowResolvedPopover(false);
    setShowStatusMenu(false);
    setSelectedAssignee(
      data?.testCaseResolutionStatusDetails?.assignee ?? null
    );
    setUserOptions([]);
    setSelectedReason(null);
    setComment('');
  }, [data?.testCaseResolutionStatusDetails?.assignee]);

  const handleAssigneeSelect = (user: EntityReference) => {
    setSelectedAssignee(user);
  };

  const handleAssigneeSubmit = () => {
    if (selectedAssignee) {
      submitStatusChange(TestCaseResolutionStatusTypes.Assigned, {
        assignee: selectedAssignee,
      });
    }
  };

  const handleResolvedSubmit = () => {
    if (selectedReason && comment) {
      submitStatusChange(TestCaseResolutionStatusTypes.Resolved, {
        reason: selectedReason,
        comment,
      });
    }
  };

  const overlayOpen =
    showStatusMenu || showAssigneePopover || showResolvedPopover;

  const userListContent = useMemo(() => {
    if (isLoadingUsers) {
      return (
        <Box align="center" className="tw:p-4" direction="row" justify="center">
          <Loader size="small" />
        </Box>
      );
    }

    if (userOptions.length === 0) {
      return (
        <Box className="tw:p-2 tw:text-center">
          <Typography className="tw:text-tertiary" size="text-sm">
            {t('message.no-username-available', { user: '' })}
          </Typography>
        </Box>
      );
    }

    return userOptions.map((option) => {
      const user: EntityReference = {
        id: option.value,
        name: option.name,
        displayName: option.displayName,
        type: option.type ?? EntityType.USER,
      };

      const isSelected = selectedAssignee?.id === option.value;

      return (
        <Button
          className={
            isSelected
              ? 'tw:w-full tw:justify-start tw:bg-primary_hover'
              : 'tw:w-full tw:justify-start'
          }
          color="tertiary"
          data-testid={option.name}
          key={option.value}
          size="sm"
          onPress={() => handleAssigneeSelect(user)}>
          <UserTag
            avatarType="outlined"
            className="tw:font-normal"
            id={option.name ?? ''}
            name={option.label}
          />
        </Button>
      );
    });
  }, [isLoadingUsers, userOptions, selectedAssignee, t]);

  const chipLabel = TEST_CASE_RESOLUTION_STATUS_LABELS[statusType];

  const renderStatusChipButton = () => {
    const palette = STATUS_COLORS[statusType] ?? STATUS_COLORS.New;

    return (
      <ChipTrigger
        attachPressHandler={false}
        chipLabel={chipLabel}
        chipRef={chipRef}
        dataTestId={`${data.testCaseReference?.name}-status`}
        hasEditPermission={hasEditPermission && !isLoading}
        overlayOpen={overlayOpen}
        palette={palette}
      />
    );
  };

  const statusMenuItems = (
    <Dropdown.Menu
      selectedKeys={[statusType]}
      selectionMode="single"
      onAction={(key) =>
        handleStatusChange(key as TestCaseResolutionStatusTypes)
      }>
      {Object.values(TestCaseResolutionStatusTypes).map((status) => (
        <Dropdown.Item
          className={SELECTED_ITEM_CLASS}
          data-testid={`status-item-${status}`}
          id={status}
          key={status}
          textValue={TEST_CASE_RESOLUTION_STATUS_LABELS[status]}>
          <Typography size="text-sm" weight="regular">
            {TEST_CASE_RESOLUTION_STATUS_LABELS[status]}
          </Typography>
        </Dropdown.Item>
      ))}
    </Dropdown.Menu>
  );

  const assigneePopoverBody = (
    <>
      <IncidentStatusPopoverHeader
        cancelTestId="cancel-assignee-popover-button"
        submitDisabled={!selectedAssignee || isLoading}
        submitTestId="submit-assignee-popover-button"
        title={t('label.assigned')}
        onBack={handleBackToStatusMenu}
        onCancel={handleCloseAllPopovers}
        onSubmit={handleAssigneeSubmit}
      />
      <Divider />
      <Box
        className="tw:p-4 tw:box-border tw:min-w-0 tw:w-full"
        direction="col"
        gap={2}>
        <Input
          data-testid="assignee-search-input"
          placeholder={t('label.search')}
          size="sm"
          onChange={(value) => {
            handleSearchUsers(String(value ?? ''));
          }}
        />
        <IncidentScrollableList>{userListContent}</IncidentScrollableList>
      </Box>
    </>
  );

  const resolvedPopoverBody = (
    <>
      <IncidentStatusPopoverHeader
        cancelTestId="cancel-resolved-popover-button"
        submitDisabled={!selectedReason || !comment || isLoading}
        submitTestId="submit-resolved-popover-button"
        title={t('label.resolved')}
        onBack={handleBackToStatusMenu}
        onCancel={handleCloseAllPopovers}
        onSubmit={handleResolvedSubmit}
      />
      <Divider />
      <Box className="tw:p-4" direction="col" gap={3}>
        <Label isRequired>{t('label.reason')}</Label>
        <FailureReasonChipGroup
          selectedReason={selectedReason}
          onSelect={setSelectedReason}
        />
        <Label isRequired>{t('label.comment')}</Label>
        <TextArea
          data-testid="resolved-comment-textarea"
          placeholder={t('message.enter-a-field', {
            field: t('label.comment-lowercase'),
          })}
          rows={4}
          textAreaClassName="tw:text-xs"
          value={comment}
          onChange={(value) => setComment(String(value ?? ''))}
        />
      </Box>
    </>
  );

  const renderInteractiveChip = () => {
    if (showAssigneePopover) {
      return (
        <IncidentStatusPopoverShell
          containerClassName="tw:max-h-[500px] tw:min-w-0 tw:w-[320px] tw:border tw:border-border-secondary"
          dataTestid={`${data.testCaseReference?.name}-assignee-popover`}
          isOpen={showAssigneePopover}
          trigger={renderStatusChipButton()}
          onOpenChange={(open) => {
            if (open) {
              searchUsers('');
              setShowAssigneePopover(true);
            } else {
              handleCloseAllPopovers();
            }
          }}>
          {assigneePopoverBody}
        </IncidentStatusPopoverShell>
      );
    }

    if (showResolvedPopover) {
      return (
        <IncidentStatusPopoverShell
          containerClassName="tw:min-w-0 tw:w-[320px] tw:border tw:border-border-secondary"
          dataTestid={`${data.testCaseReference?.name}-resolved-popover`}
          isOpen={showResolvedPopover}
          trigger={renderStatusChipButton()}
          onOpenChange={(open) => {
            if (!open) {
              handleCloseAllPopovers();
            } else {
              setShowResolvedPopover(true);
            }
          }}>
          {resolvedPopoverBody}
        </IncidentStatusPopoverShell>
      );
    }

    // Keep the chip always inside Dropdown.Root so the MenuTrigger's internal
    // triggerRef is already set on the DOM button before the user clicks.
    // onOpenChange routes to the appropriate sub-popover based on status type.
    return (
      <Dropdown.Root
        isOpen={showStatusMenu}
        onOpenChange={handleStatusMenuOpenChange}>
        {renderStatusChipButton()}
        <Dropdown.Popover
          className="tw:min-w-[100px] tw:w-max tw:overflow-auto"
          placement="top">
          {statusMenuItems}
        </Dropdown.Popover>
      </Dropdown.Root>
    );
  };

  if (!hasEditPermission) {
    return (
      <Box inline align="center">
        {renderStatusChipButton()}
      </Box>
    );
  }

  return (
    <Box inline align="center">
      {renderInteractiveChip()}
    </Box>
  );
};

export default InlineTestCaseIncidentStatus;
