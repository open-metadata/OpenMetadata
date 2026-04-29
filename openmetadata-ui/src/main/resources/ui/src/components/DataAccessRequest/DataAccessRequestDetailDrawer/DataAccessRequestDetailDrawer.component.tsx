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

import { Badge } from '@openmetadata/ui-core-components';
import {
  Avatar,
  Button,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Skeleton,
  Space,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addTaskComment,
  getTaskById,
  resolveTask,
  Task,
  TaskComment,
  TaskResolutionType,
} from '../../../rest/tasksAPI';
import {
  buildResolveBody,
  canApprove,
  canReject,
  canRevoke,
  getApproveTransition,
  getDataAccessPayload,
  getDisplayStatus,
  getRejectTransition,
  getRevokeTransition,
} from '../../../utils/DataAccessRequest/DataAccessRequestUtils';

const STATUS_BADGE_COLOR: Record<
  string,
  'success' | 'error' | 'warning' | 'gray' | 'orange'
> = {
  Approved: 'success',
  Pending: 'warning',
  Rejected: 'error',
  Revoked: 'orange',
  Expired: 'gray',
};
import { getEntityName } from '../../../utils/EntityUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../utils/ToastUtils';
import { DataAccessRequestDetailDrawerProps } from '../DataAccessRequest.interface';

const { Text, Title } = Typography;

type ConfirmKind = 'approve' | 'reject' | 'revoke';

const DataAccessRequestDetailDrawer = ({
  taskId,
  open,
  onClose,
  onResolved,
}: DataAccessRequestDetailDrawerProps) => {
  const { t } = useTranslation();
  const [task, setTask] = useState<Task | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null);
  const [confirmComment, setConfirmComment] = useState('');
  const [resolving, setResolving] = useState(false);

  const loadTask = useCallback(async () => {
    if (!taskId) {
      return;
    }
    try {
      setLoading(true);
      const response = await getTaskById(taskId, {
        fields: 'comments,assignees,reviewers,resolution,about',
      });
      setTask(response.data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (open && taskId) {
      loadTask();
    } else {
      setTask(undefined);
      setComment('');
    }
  }, [open, taskId, loadTask]);

  const payload = useMemo(
    () => (task ? getDataAccessPayload(task) : undefined),
    [task]
  );

  const handlePostComment = async () => {
    if (!task || !comment.trim()) {
      return;
    }
    try {
      setPostingComment(true);
      const updated = await addTaskComment(task.id, comment.trim());
      setTask(updated);
      setComment('');
      showSuccessToast(t('message.comment-posted'));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setPostingComment(false);
    }
  };

  const openConfirm = (kind: ConfirmKind) => {
    setConfirmKind(kind);
    setConfirmComment('');
  };

  const closeConfirm = () => {
    setConfirmKind(null);
    setConfirmComment('');
  };

  const transitionFor = (kind: ConfirmKind) => {
    if (!task) {
      return undefined;
    }
    if (kind === 'approve') {
      return getApproveTransition(task);
    }
    if (kind === 'reject') {
      return getRejectTransition(task);
    }

    return getRevokeTransition(task);
  };

  const handleResolve = async () => {
    if (!task || !confirmKind) {
      return;
    }
    const transition = transitionFor(confirmKind);
    if (!transition) {
      return;
    }
    if (transition.requiresComment && !confirmComment.trim()) {
      return;
    }
    try {
      setResolving(true);
      const resolutionType =
        transition.resolutionType ??
        (confirmKind === 'approve'
          ? TaskResolutionType.Approved
          : confirmKind === 'reject'
            ? TaskResolutionType.Rejected
            : TaskResolutionType.Revoked);

      const body = buildResolveBody(
        transition.id,
        resolutionType,
        confirmComment.trim() || undefined
      );
      const updated = await resolveTask(task.id, body);
      setTask(updated);
      showSuccessToast(t(`message.task-${confirmKind}-success`));
      closeConfirm();
      onResolved?.(updated);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setResolving(false);
    }
  };

  const renderField = (labelKey: string, value: React.ReactNode) => (
    <div className="tw:flex tw:items-start tw:gap-2 tw:py-1">
      <Text className="tw:min-w-32" type="secondary">
        {t(labelKey)}
      </Text>
      <div className="tw:flex-1">{value}</div>
    </div>
  );

  const renderComments = (comments: TaskComment[]) => {
    if (comments.length === 0) {
      return (
        <Empty
          description={t('label.no-comments')}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    return (
      <Space className="tw:w-full" direction="vertical" size="middle">
        {comments.map((c) => (
          <div className="tw:flex tw:gap-2" key={c.id}>
            <Avatar size="small">
              {(c.author?.displayName ?? c.author?.name ?? '?')
                .charAt(0)
                .toUpperCase()}
            </Avatar>
            <div className="tw:flex-1">
              <div className="tw:flex tw:items-center tw:gap-2">
                <Text strong>
                  {c.author?.displayName ?? c.author?.name ?? t('label.user')}
                </Text>
                <Text className="tw:text-xs" type="secondary">
                  {new Date(c.createdAt).toLocaleString()}
                </Text>
              </div>
              <Text className="tw:text-sm">{c.message}</Text>
            </div>
          </div>
        ))}
      </Space>
    );
  };

  const renderActions = () => {
    if (!task) {
      return null;
    }
    const showApprove = canApprove(task);
    const showReject = canReject(task);
    const showRevoke = canRevoke(task);

    if (!showApprove && !showReject && !showRevoke) {
      return null;
    }

    return (
      <div
        className="tw:flex tw:items-center tw:gap-2 tw:p-3 tw:bg-(--color-bg-secondary) tw:rounded-md"
        data-testid="dar-actions">
        <Text strong>{t('label.action-required')}</Text>
        <Space className="tw:ml-auto" size="small">
          {showReject && (
            <Button
              danger
              data-testid="dar-reject-button"
              onClick={() => openConfirm('reject')}>
              {t('label.reject')}
            </Button>
          )}
          {showApprove && (
            <Button
              data-testid="dar-approve-button"
              type="primary"
              onClick={() => openConfirm('approve')}>
              {t('label.approve')}
            </Button>
          )}
          {showRevoke && (
            <Button
              danger
              data-testid="dar-revoke-button"
              type="primary"
              onClick={() => openConfirm('revoke')}>
              {t('label.revoke-access')}
            </Button>
          )}
        </Space>
      </div>
    );
  };

  return (
    <>
      <Drawer
        destroyOnClose
        data-testid="dar-detail-drawer"
        open={open}
        title={
          task ? (
            <Space>
              <Title className="tw:m-0" level={5}>
                {task.about?.displayName ?? task.about?.name ?? task.taskId}
              </Title>
              {(() => {
                const display = getDisplayStatus(task);
                const color = STATUS_BADGE_COLOR[display] ?? 'gray';

                return (
                  <Badge color={color} size="sm" type="color">
                    {display}
                  </Badge>
                );
              })()}
            </Space>
          ) : (
            t('label.data-access-request')
          )
        }
        width={520}
        onClose={onClose}>
        {loading || !task ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <Space className="tw:w-full" direction="vertical" size="middle">
            <Text className="tw:text-xs" type="secondary">
              {task.taskId}
              {task.about?.fullyQualifiedName
                ? ` · ${task.about.fullyQualifiedName}`
                : ''}
            </Text>

            {renderField(
              'label.requested-by',
              task.createdBy ? getEntityName(task.createdBy) : '-'
            )}

            {payload?.accessType &&
              renderField('label.access-type', payload.accessType)}

            {payload?.columns &&
              payload.columns.length > 0 &&
              renderField(
                'label.columns-requested',
                payload.columns
                  .map((c) => c.split('.').pop() ?? c)
                  .join(', ')
              )}

            {payload?.duration &&
              renderField('label.duration', payload.duration)}

            {payload?.reason &&
              renderField('label.reason-for-access', payload.reason)}

            {task.resolution?.resolvedBy &&
              renderField(
                'label.approver',
                getEntityName(task.resolution.resolvedBy)
              )}

            {task.resolution?.resolvedAt &&
              renderField(
                'label.resolved-on',
                new Date(task.resolution.resolvedAt).toLocaleString()
              )}

            {renderActions()}

            <Divider className="tw:my-2" />

            <Title level={5}>{t('label.comment-plural')}</Title>

            <Form.Item>
              <Input.TextArea
                data-testid="dar-comment-input"
                placeholder={t('label.add-a-comment-with-mention')}
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <div className="tw:flex tw:justify-end tw:mt-2">
                <Button
                  data-testid="dar-post-comment"
                  disabled={!comment.trim()}
                  loading={postingComment}
                  type="primary"
                  onClick={handlePostComment}>
                  {t('label.post-comment')}
                </Button>
              </div>
            </Form.Item>

            {renderComments(task.comments ?? [])}
          </Space>
        )}
      </Drawer>

      <Modal
        confirmLoading={resolving}
        data-testid="dar-confirm-modal"
        okButtonProps={{
          danger: confirmKind !== 'approve',
          disabled:
            transitionFor(confirmKind ?? 'approve')?.requiresComment &&
            !confirmComment.trim(),
        }}
        okText={
          confirmKind === 'approve'
            ? t('label.approve')
            : confirmKind === 'reject'
              ? t('label.reject')
              : t('label.revoke')
        }
        open={confirmKind !== null}
        title={
          confirmKind === 'approve'
            ? t('label.approve-request')
            : confirmKind === 'reject'
              ? t('label.reject-request')
              : t('label.revoke-access')
        }
        onCancel={closeConfirm}
        onOk={handleResolve}>
        <Form.Item
          label={t('label.comment')}
          required={
            transitionFor(confirmKind ?? 'approve')?.requiresComment ?? false
          }>
          <Input.TextArea
            data-testid="dar-confirm-comment"
            rows={3}
            value={confirmComment}
            onChange={(e) => setConfirmComment(e.target.value)}
          />
        </Form.Item>
      </Modal>
    </>
  );
};

export default DataAccessRequestDetailDrawer;
