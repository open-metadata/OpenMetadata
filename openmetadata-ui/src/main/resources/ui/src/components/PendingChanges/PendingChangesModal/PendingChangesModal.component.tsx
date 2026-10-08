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
import {
  Button,
  Dialog,
  Input,
  Modal,
  ModalOverlay,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { Search } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { startCase, uniqBy } from 'lodash';
import { Key, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChangeRequest,
  ChangeRequestStatus,
} from '../../../generated/governance/changeRequest/changeRequest';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { withdrawChangeRequest } from '../../../rest/changeRequestsAPI';
import { getRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import Fqn from '../../../utils/Fqn';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import ChangeRequestChanges from '../ChangeRequestChanges/ChangeRequestChanges.component';
import {
  countChangedFields,
  countChanges,
} from '../ChangeRequestChanges/ChangeRequestChanges.utils';
import {
  PendingChangesModalProps,
  RequestDetailProps,
} from './PendingChangesModal.interface';

const useIsOwn = (request: ChangeRequest) =>
  useApplicationStore().currentUser?.name === request.requestedBy;

const RequesterName = ({ request }: { request: ChangeRequest }) => {
  const { t } = useTranslation();

  return <>{useIsOwn(request) ? t('label.you') : request.requestedBy}</>;
};

const RequestSummary = ({ request }: { request: ChangeRequest }) => {
  const { t } = useTranslation();

  return (
    <span className="tw:flex tw:w-full tw:min-w-0 tw:items-center tw:gap-3">
      <ProfilePicture name={request.requestedBy} size="sm" />
      <span className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:items-start">
        <Typography ellipsis as="span" size="text-sm" weight="semibold">
          <RequesterName request={request} />
        </Typography>
        <Typography
          as="span"
          className="tw:text-tertiary"
          size="text-xs"
          weight="regular">
          {t('label.field-changed-count', {
            count: countChangedFields(request.activeRevision?.ops),
          })}
        </Typography>
      </span>
      <span className="tw:flex tw:flex-col tw:items-end">
        <Typography as="span" size="text-xs" weight="medium">
          {t('label.revision-number', { number: request.activeRevisionNumber })}
        </Typography>
        <Typography
          as="span"
          className="tw:text-quaternary"
          size="text-xs"
          weight="regular">
          {getRelativeTime(request.updatedAt)}
        </Typography>
      </span>
    </span>
  );
};

/** The author of a pending request can withdraw it; reviewers decide on the request's task. */
const WithdrawFooter = ({ request, onChange }: RequestDetailProps) => {
  const { t } = useTranslation();
  const [isBusy, setIsBusy] = useState(false);

  const handleWithdraw = async () => {
    setIsBusy(true);
    try {
      await withdrawChangeRequest(request.id, request.activeRevisionNumber);
      showSuccessToast(t('message.change-request-withdrawn'));
      await onChange();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog.Footer className="tw:mt-0 tw:sm:mt-0">
      <Button
        color="secondary"
        data-testid="withdraw-change-request"
        isDisabled={isBusy}
        size="sm"
        onClick={handleWithdraw}>
        {t('label.withdraw-revision')}
      </Button>
    </Dialog.Footer>
  );
};

const RequestDetail = ({ request, onChange }: RequestDetailProps) => {
  const { t } = useTranslation();
  const ops = request.activeRevision?.ops;
  const canWithdraw =
    useIsOwn(request) && request.status === ChangeRequestStatus.Pending;

  return (
    <>
      <div className="tw:flex tw:items-center tw:gap-3 tw:border-b tw:border-subtle tw:px-6 tw:py-4">
        <ProfilePicture name={request.requestedBy} size="sm" />
        <span className="tw:flex tw:flex-col">
          <Typography as="span" size="text-sm">
            <Typography as="span" weight="semibold">
              <RequesterName request={request} />
            </Typography>{' '}
            <span className="tw:text-tertiary">
              {t('message.proposed-change-count', {
                count: countChanges(ops),
              })}
            </span>
          </Typography>
          <Typography as="span" className="tw:text-tertiary" size="text-xs">
            {`${t('label.revision-number', {
              number: request.activeRevisionNumber,
            })} · ${getRelativeTime(request.updatedAt)}`}
          </Typography>
        </span>
      </div>
      <div className="tw:flex-1 tw:overflow-y-auto tw:px-6 tw:py-5">
        <ChangeRequestChanges ops={ops} />
      </div>
      {canWithdraw && <WithdrawFooter request={request} onChange={onChange} />}
    </>
  );
};

/**
 * The change requests waiting on one asset: the requests on the left, the selected one's
 * proposed changes on the right, with the actions the viewer can take on it.
 */
const PendingChangesModal = ({
  requests,
  onClose,
  onChange,
}: PendingChangesModalProps) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<Key>();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return term
      ? requests.filter(
          (request) =>
            request.requestedBy.toLowerCase().includes(term) ||
            request.activeRevision?.ops.some((op) =>
              op.field.toLowerCase().includes(term)
            )
        )
      : requests;
  }, [requests, search]);

  const selected =
    filtered.find((request) => request.id === selectedId) ?? filtered[0];
  const [first] = requests;
  const subtitle = first
    ? [
        Fqn.split(first.entityFullyQualifiedName).pop(),
        startCase(first.entityType),
        t('message.users-with-pending-changes', {
          count: uniqBy(requests, 'requestedBy').length,
        }),
      ].join(' · ')
    : '';

  return (
    <ModalOverlay
      isOpen
      className="tw:z-1100"
      onOpenChange={(open) => !open && onClose()}>
      <Modal>
        <Dialog
          showCloseButton
          data-testid="pending-changes-modal"
          width={960}
          onClose={onClose}>
          <Dialog.Header
            className="tw:border-b tw:border-subtle tw:pr-12 tw:pb-4 tw:sm:pb-4"
            title={t('label.pending-changes')}>
            <Typography as="p" className="tw:text-tertiary" size="text-sm">
              {subtitle}
            </Typography>
          </Dialog.Header>
          <Tabs
            className="tw:h-[520px] tw:flex-row"
            orientation="vertical"
            selectedKey={selected?.id ?? null}
            onSelectionChange={setSelectedId}>
            <div className="tw:flex tw:w-80 tw:shrink-0 tw:flex-col tw:gap-3 tw:border-r tw:border-subtle tw:bg-secondary tw:p-3">
              <Input
                icon={Search}
                inputDataTestId="pending-changes-search"
                placeholder={t('label.search-by-user-or-field')}
                value={search}
                onChange={setSearch}
              />
              <Tabs.List
                aria-label={t('label.pending-changes')}
                className="tw:w-full tw:overflow-y-auto"
                type="button-minimal">
                {filtered.map((request) => (
                  <Tabs.Item
                    className="tw:w-full"
                    data-testid={`change-request-${request.id}`}
                    id={request.id}
                    key={request.id}>
                    <RequestSummary request={request} />
                  </Tabs.Item>
                ))}
              </Tabs.List>
              {filtered.length === 0 && (
                <Typography
                  as="span"
                  className="tw:px-3 tw:text-tertiary"
                  size="text-sm">
                  {t('message.no-match-found')}
                </Typography>
              )}
            </div>
            {filtered.map((request) => (
              <Tabs.Panel
                className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col"
                id={request.id}
                key={request.id}>
                <RequestDetail request={request} onChange={onChange} />
              </Tabs.Panel>
            ))}
          </Tabs>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default PendingChangesModal;
