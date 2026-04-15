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
  Chip,
  Divider,
  Icon,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  Menu,
  MenuItem,
  Popover,
  TextField,
} from '@mui/material';
import { Typography } from '@openmetadata/ui-core-components';
import {
  ArrowLeft as ArrowBackIcon,
  Check as CheckIcon,
  ChevronDown as ArrowDownIcon,
  ChevronUp as ArrowUpIcon,
  XClose as CloseIcon,
} from '@untitledui/icons';
import { AxiosError } from 'axios';
import { debounce, isEmpty, startCase } from 'lodash';
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
import { RequiredLabel } from '../../../common/MuiComponents/RequiredLabel/RequiredLabel.styled';
import { UserTag } from '../../../common/UserTag/UserTag.component';
import { InlineTestCaseIncidentStatusProps } from './TestCaseIncidentManagerStatus.interface';

const ACTION_BUTTON_STYLES = {
  cancel: {
    width: 24,
    height: 24,
    padding: 0,
    borderRadius: '4px',
    backgroundColor: 'grey.200',
    color: 'grey.600',
    '&:hover': {
      backgroundColor: 'grey.300',
    },
  },
  submit: {
    width: 24,
    height: 24,
    padding: 0,
    borderRadius: '4px',
    backgroundColor: 'primary.main',
    color: 'common.white',
    '&:hover': {
      backgroundColor: 'primary.dark',
    },
    '&:disabled': {
      backgroundColor: 'grey.200',
      color: 'grey.400',
    },
  },
  icon: {
    fontSize: 14,
    width: 14,
    height: 14,
  },
};

const InlineTestCaseIncidentStatus = ({
  data,
  hasEditPermission,
  onSubmit,
}: InlineTestCaseIncidentStatusProps) => {
  const { t } = useTranslation();
  const chipRef = React.useRef<HTMLDivElement>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
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

        // If there's an assigned user and it's not in the results, add it at the top
        if (initialOptions.length > 0) {
          const assigneeId = initialOptions[0].value;
          const isAssigneeInResults = suggestOptions.some(
            (opt) => opt.value === assigneeId
          );
          if (isAssigneeInResults) {
            // Move assignee to top
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
        // When search is cleared, trigger search with empty query to get default results
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

  const handleStatusClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!hasEditPermission) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();

    if (chipRef.current) {
      setAnchorEl(chipRef.current);

      // Open directly to the current status detail screen
      if (statusType === TestCaseResolutionStatusTypes.Assigned) {
        // Load initial user list with empty search
        searchUsers('');
        setShowAssigneePopover(true);
      } else if (statusType === TestCaseResolutionStatusTypes.Resolved) {
        // Pre-populate with existing values
        setSelectedReason(
          data?.testCaseResolutionStatusDetails?.testCaseFailureReason ?? null
        );
        setComment(
          data?.testCaseResolutionStatusDetails?.testCaseFailureComment ?? ''
        );
        setShowResolvedPopover(true);
      } else {
        // For New/Ack, show the status menu
        setShowStatusMenu(true);
      }
    }
  };

  const handleCloseStatusMenu = useCallback(() => {
    setShowStatusMenu(false);
    setAnchorEl(null);
  }, []);

  const handleStatusChange = useCallback(
    async (newStatus: TestCaseResolutionStatusTypes) => {
      setShowStatusMenu(false);

      if (newStatus === TestCaseResolutionStatusTypes.Assigned) {
        // Load initial user list with empty search
        searchUsers('');
        setShowAssigneePopover(true);
      } else if (newStatus === TestCaseResolutionStatusTypes.Resolved) {
        setShowResolvedPopover(true);
      } else {
        setAnchorEl(null);
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
    setAnchorEl(null);
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

  const statusColor = STATUS_COLORS[statusType] || STATUS_COLORS.New;

  const dropdownIcon = useMemo(() => {
    if (!hasEditPermission) {
      return undefined;
    }

    return showStatusMenu || showAssigneePopover || showResolvedPopover ? (
      <ArrowUpIcon />
    ) : (
      <ArrowDownIcon />
    );
  }, [
    hasEditPermission,
    showStatusMenu,
    showAssigneePopover,
    showResolvedPopover,
  ]);

  const userListContent = useMemo(() => {
    if (isLoadingUsers) {
      return (
        <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
          <Loader size="small" />
        </Box>
      );
    }

    if (userOptions.length === 0) {
      return (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography as="span" className="tw:text-body tw:text-tertiary">
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

      return (
        <ListItem disablePadding key={option.value}>
          <ListItemButton
            data-testid={option.name}
            selected={selectedAssignee?.id === option.value}
            sx={{ py: 1.5 }}
            onClick={() => handleAssigneeSelect(user)}>
            <UserTag
              avatarType="outlined"
              id={option.name ?? ''}
              name={option.label}
            />
          </ListItemButton>
        </ListItem>
      );
    });
  }, [isLoadingUsers, userOptions, selectedAssignee, t]);

  return (
    <Box ref={chipRef} sx={{ display: 'inline-flex', alignItems: 'center' }}>
      <Chip
        data-testid={`${data.testCaseReference?.name}-status`}
        deleteIcon={dropdownIcon}
        label={TEST_CASE_RESOLUTION_STATUS_LABELS[statusType]}
        sx={{
          px: 1,
          backgroundColor: statusColor.bg,
          color: statusColor.color,
          border: `1px solid ${statusColor.border}`,
          borderRadius: '16px',
          fontWeight: 500,
          fontSize: '12px',
          cursor: hasEditPermission ? 'pointer' : 'default',
          '& .MuiChip-label': {
            px: 1,
          },
          '& .MuiChip-deleteIcon': {
            color: statusColor.color,
            fontSize: '16px',
            margin: '0 4px 0 -4px',
            height: '16px',
            width: '16px',
          },
          '&:hover': {
            backgroundColor: statusColor.bg,
            opacity: 0.8,
          },
        }}
        onClick={handleStatusClick}
        onDelete={hasEditPermission ? handleStatusClick : undefined}
      />

      <Menu
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        open={showStatusMenu}
        sx={{
          '.MuiPaper-root': {
            width: 'max-content',
          },
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        onClose={handleCloseStatusMenu}>
        {Object.values(TestCaseResolutionStatusTypes).map((status) => (
          <MenuItem
            key={status}
            selected={status === statusType}
            sx={{
              minWidth: 100,
              fontWeight: status === statusType ? 600 : 400,
              '&.Mui-selected': {
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': {
                  backgroundColor: 'primary.dark',
                },
              },
            }}
            onClick={() => handleStatusChange(status)}>
            {TEST_CASE_RESOLUTION_STATUS_LABELS[status]}
          </MenuItem>
        ))}
      </Menu>

      {/* Assigned status popover */}
      <Popover
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        data-testid={`${data.testCaseReference?.name}-assignee-popover`}
        open={showAssigneePopover}
        slotProps={{
          paper: {
            sx: {
              width: 300,
              maxHeight: 500,
              border: '1px solid',
              borderColor: 'grey.300',
            },
          },
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        onClose={handleCloseAllPopovers}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',

            gap: 2,
            p: 3,
          }}>
          <IconButton size="small" onClick={handleBackToStatusMenu}>
            <ArrowBackIcon />
          </IconButton>
          <Typography as="span" className="tw:text-base tw:font-semibold">
            {t('label.assigned')}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <IconButton
            data-testid="cancel-assignee-popover-button"
            size="small"
            sx={ACTION_BUTTON_STYLES.cancel}
            onClick={handleCloseAllPopovers}>
            <CloseIcon style={ACTION_BUTTON_STYLES.icon} />
          </IconButton>
          <IconButton
            data-testid="submit-assignee-popover-button"
            disabled={!selectedAssignee || isLoading}
            size="small"
            sx={ACTION_BUTTON_STYLES.submit}
            onClick={handleAssigneeSubmit}>
            <CheckIcon style={ACTION_BUTTON_STYLES.icon} />
          </IconButton>
        </Box>
        <Divider sx={{ borderColor: 'grey.300' }} />
        <Box sx={{ p: 4 }}>
          <TextField
            fullWidth
            data-testid="assignee-search-input"
            placeholder={t('label.search')}
            size="small"
            sx={{ mb: 2 }}
            onChange={(e) => handleSearchUsers(e.target.value)}
          />

          <List sx={{ maxHeight: 300, overflow: 'auto' }}>
            {userListContent}
          </List>
        </Box>
      </Popover>

      {/* Resolved status popover */}
      <Popover
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        data-testid={`${data.testCaseReference?.name}-resolved-popover`}
        open={showResolvedPopover}
        slotProps={{
          paper: {
            sx: {
              width: 400,
              border: '1px solid',
              borderColor: 'grey.300',
            },
          },
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        onClose={handleCloseAllPopovers}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: 3,
          }}>
          <IconButton size="small" onClick={handleBackToStatusMenu}>
            <ArrowBackIcon />
          </IconButton>
          <Typography as="span" className="tw:text-base tw:font-semibold">
            {t('label.resolved')}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <IconButton
            data-testid="cancel-resolved-popover-button"
            size="small"
            sx={ACTION_BUTTON_STYLES.cancel}
            onClick={handleCloseAllPopovers}>
            <CloseIcon style={ACTION_BUTTON_STYLES.icon} />
          </IconButton>
          <IconButton
            data-testid="submit-resolved-popover-button"
            disabled={!selectedReason || !comment || isLoading}
            size="small"
            sx={ACTION_BUTTON_STYLES.submit}
            onClick={handleResolvedSubmit}>
            <CheckIcon style={ACTION_BUTTON_STYLES.icon} />
          </IconButton>
        </Box>

        <Divider sx={{ borderColor: 'grey.300' }} />
        <Box sx={{ p: 4 }}>
          <RequiredLabel mb={1}>{t('label.reason')}</RequiredLabel>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 5 }}>
            {Object.values(TestCaseFailureReasonType).map((reason) => (
              <Chip
                data-testid={`reason-chip-${reason}`}
                icon={
                  selectedReason === reason ? (
                    <Icon
                      component={CheckIcon}
                      sx={{ fontSize: 14, color: 'common.white', mx: 0.5 }}
                    />
                  ) : undefined
                }
                key={reason}
                label={startCase(reason)}
                sx={{
                  cursor: 'pointer',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 500,
                  height: 'auto',
                  '& .MuiChip-label': {
                    px: selectedReason === reason ? 0.5 : 1.5,
                    py: 0.5,
                  },
                  ...(selectedReason === reason
                    ? {
                        backgroundColor: 'primary.main',
                        color: 'common.white',
                        border: 'none',
                        '&:hover': {
                          backgroundColor: 'primary.dark',
                        },
                        '& .MuiChip-icon': {
                          color: 'common.white',
                        },
                      }
                    : {
                        backgroundColor: 'grey.50',
                        color: 'grey.900',
                        border: '1px solid',
                        borderColor: 'grey.200',
                        '&:hover': {
                          backgroundColor: 'grey.100',
                        },
                      }),
                }}
                onClick={() => setSelectedReason(reason)}
              />
            ))}
          </Box>

          <RequiredLabel mb={1}>{t('label.comment')}</RequiredLabel>
          <TextField
            fullWidth
            multiline
            data-testid="resolved-comment-textarea"
            placeholder="Enter your comment"
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </Box>
      </Popover>
    </Box>
  );
};

export default InlineTestCaseIncidentStatus;
