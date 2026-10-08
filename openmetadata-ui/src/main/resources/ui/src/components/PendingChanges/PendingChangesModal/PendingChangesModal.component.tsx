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
  NativeSelect,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ClockRewind,
  Eye,
  Rows03,
  Search,
  Settings01,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { TFunction } from 'i18next';
import { startCase, uniqBy } from 'lodash';
import { FC, Key, ReactNode, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChangeRequest,
  ChangeRequestStatus,
} from '../../../generated/governance/changeRequest/changeRequest';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  getChangeRequestsByRequester,
  withdrawChangeRequest,
} from '../../../rest/changeRequestsAPI';
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
  AdminActions,
  PreviewPanel,
  RequestHistory,
} from '../ChangeRequestTools/ChangeRequestTools.component';
import {
  PendingChangesModalProps,
  RequestDetailProps,
} from './PendingChangesModal.interface';

enum Scope {
  Asset = 'asset',
  Mine = 'mine',
}

// Requests an administrator can still publish or cancel.
const OPEN_STATUSES = new Set([
  ChangeRequestStatus.Pending,
  ChangeRequestStatus.Approved,
]);

const PREVIEW_KEY = 'preview';

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
          ellipsis
          as="span"
          className="tw:max-w-full tw:text-tertiary"
          size="text-xs"
          weight="regular">
          {[
            Fqn.split(request.entityFullyQualifiedName).pop(),
            request.status,
            t('label.field-changed-count', {
              count: countChangedFields(request.activeRevision?.ops),
            }),
          ].join(' · ')}
        </Typography>
      </span>
      <span className="tw:flex tw:shrink-0 tw:flex-col tw:items-end">
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

// One titled block of a request's detail, set apart from the others by a card.
const DetailSection = ({
  icon: Icon,
  title,
  children,
}: {
  icon: FC<{ className?: string }>;
  title: string;
  children: ReactNode;
}) => (
  <section className="tw:flex tw:flex-col tw:gap-3 tw:rounded-xl tw:border tw:border-secondary tw:p-4">
    <span className="tw:flex tw:items-center tw:gap-2">
      <Icon className="tw:size-4 tw:text-tertiary" />
      <Typography as="span" size="text-sm" weight="semibold">
        {title}
      </Typography>
    </span>
    {children}
  </section>
);

const RequestDetail = ({ request, onChange }: RequestDetailProps) => {
  const { t } = useTranslation();
  const ops = request.activeRevision?.ops;
  const canWithdraw =
    useIsOwn(request) && request.status === ChangeRequestStatus.Pending;
  const isAdmin = Boolean(useApplicationStore().currentUser?.isAdmin);

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
            {[
              request.entityFullyQualifiedName,
              request.status,
              t('label.revision-number', {
                number: request.activeRevisionNumber,
              }),
              getRelativeTime(request.updatedAt),
            ].join(' · ')}
          </Typography>
        </span>
      </div>
      <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-5 tw:overflow-y-auto tw:px-6 tw:py-5">
        <DetailSection icon={Rows03} title={t('label.change-plural')}>
          <ChangeRequestChanges ops={ops} />
        </DetailSection>
        {isAdmin && OPEN_STATUSES.has(request.status) && (
          <DetailSection
            icon={Settings01}
            title={t('label.admin-action-plural')}>
            <AdminActions request={request} onChange={onChange} />
          </DetailSection>
        )}
        <DetailSection icon={ClockRewind} title={t('label.history')}>
          <RequestHistory request={request} />
        </DetailSection>
      </div>
      {canWithdraw && <WithdrawFooter request={request} onChange={onChange} />}
    </>
  );
};

const filterRequests = (requests: ChangeRequest[], search: string) => {
  const term = search.trim().toLowerCase();

  // A request matches by who proposed it, the asset it is on, its status or a field it changes.
  return term
    ? requests.filter((request) =>
        [
          request.requestedBy,
          request.entityFullyQualifiedName,
          request.status,
          ...(request.activeRevision?.ops ?? []).map((op) => op.field),
        ].some((text) => text.toLowerCase().includes(term))
      )
    : requests;
};

const subtitleOf = (requests: ChangeRequest[], t: TFunction) => {
  const [first] = requests;

  return first
    ? [
        Fqn.split(first.entityFullyQualifiedName).pop(),
        startCase(first.entityType),
        t('message.users-with-pending-changes', {
          count: uniqBy(requests, 'requestedBy').length,
        }),
      ].join(' · ')
    : '';
};

/** The asset's requests, or every request the current user submitted, on any asset. */
const useScopedRequests = (
  scope: Scope,
  assetRequests: ChangeRequest[],
  onChange: () => Promise<void>
) => {
  const { currentUser } = useApplicationStore();
  const [mine, setMine] = useState<ChangeRequest[]>([]);

  const loadMine = async () => {
    if (currentUser?.name) {
      try {
        setMine(await getChangeRequestsByRequester(currentUser.name));
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }
  };

  useEffect(() => {
    if (scope === Scope.Mine) {
      loadMine();
    }
  }, [scope]);

  const refresh = async () => {
    await onChange();
    if (scope === Scope.Mine) {
      await loadMine();
    }
  };

  return { requests: scope === Scope.Mine ? mine : assetRequests, refresh };
};

const firstIdOf = (
  selected: ChangeRequest | undefined,
  list: ChangeRequest[]
) => (selected ?? list[0])?.id;

const emptyMessage = (scope: Scope, search: string, t: TFunction) => {
  if (search.trim()) {
    return t('message.no-match-found');
  }

  return scope === Scope.Mine
    ? t('message.no-change-requests-by-you')
    : t('message.no-pending-changes-on-asset');
};

interface RequestListProps {
  requests: ChangeRequest[];
  scope: Scope;
  search: string;
  canPreview: boolean;
  isPreviewing: boolean;
  onPreview: () => void;
  onScopeChange: (scope: Scope) => void;
  onSearchChange: (search: string) => void;
}

/** The requests to pick from: on this asset or the current user's, searchable. */
const RequestList = ({
  requests,
  scope,
  search,
  canPreview,
  isPreviewing,
  onPreview,
  onScopeChange,
  onSearchChange,
}: RequestListProps) => {
  const { t } = useTranslation();

  return (
    <div className="tw:flex tw:w-80 tw:shrink-0 tw:flex-col tw:gap-3 tw:border-r tw:border-subtle tw:bg-secondary tw:p-3">
      {canPreview && (
        <>
          <Button
            className="tw:w-full"
            color={isPreviewing ? 'primary' : 'secondary'}
            data-testid="preview-change-button"
            iconLeading={Eye}
            size="sm"
            onClick={onPreview}>
            {t('label.preview-change')}
          </Button>
          <hr className="tw:border-subtle" />
        </>
      )}
      <Typography
        as="span"
        className="tw:px-1 tw:text-tertiary tw:uppercase"
        size="text-xs"
        weight="semibold">
        {t('label.change-request-plural')}
      </Typography>
      <NativeSelect
        data-testid="change-request-scope"
        options={[
          { label: t('label.this-asset'), value: Scope.Asset },
          { label: t('label.my-request-plural'), value: Scope.Mine },
        ]}
        selectClassName="tw:py-2 tw:text-sm"
        value={scope}
        onChange={(event) => onScopeChange(event.target.value as Scope)}
      />
      <Input
        icon={Search}
        inputDataTestId="pending-changes-search"
        placeholder={t('label.search-by-requester-field-or-asset')}
        size="sm"
        value={search}
        onChange={onSearchChange}
      />
      <Tabs.List
        aria-label={t('label.pending-changes')}
        className="tw:w-full tw:overflow-y-auto"
        type="button-minimal">
        {requests.map((request) => (
          <Tabs.Item
            className="tw:w-full"
            data-testid={`change-request-${request.id}`}
            id={request.id}
            key={request.id}>
            <RequestSummary request={request} />
          </Tabs.Item>
        ))}
        {canPreview && (
          // Selected through the preview button above; kept in the list so its panel is a tab.
          <Tabs.Item
            aria-hidden
            className="tw:hidden"
            data-testid="preview-change-tab"
            id={PREVIEW_KEY}>
            {t('label.preview-change')}
          </Tabs.Item>
        )}
      </Tabs.List>
      {requests.length === 0 && (
        <Typography
          as="span"
          className="tw:px-3 tw:text-tertiary"
          size="text-sm">
          {emptyMessage(scope, search, t)}
        </Typography>
      )}
    </div>
  );
};

// Back to the review of every pending change, grouped by field.
const ReviewViewButton = ({
  onSwitchView,
}: {
  onSwitchView?: (preview?: boolean) => void;
}) => {
  const { t } = useTranslation();

  return onSwitchView ? (
    <Button
      className="tw:mt-2"
      color="secondary"
      data-testid="switch-to-review"
      iconLeading={Rows03}
      size="sm"
      onClick={() => onSwitchView()}>
      {t('label.review-pending-changes')}
    </Button>
  ) : null;
};

/**
 * The change requests waiting on one asset, or the current user's own: the requests on the left,
 * the selected one's proposed changes, history and the actions the viewer can take on the right.
 * Without a request selected, the right side previews whether an edit to the asset would be held.
 */
const PendingChangesModal = ({
  requests: assetRequests,
  onClose,
  onChange,
  entityId,
  entityType,
  entityFqn,
  onSwitchView,
  startWithPreview,
}: PendingChangesModalProps) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<Key | undefined>(
    startWithPreview ? PREVIEW_KEY : undefined
  );
  const [scope, setScope] = useState(Scope.Asset);
  const { requests, refresh } = useScopedRequests(
    scope,
    assetRequests,
    onChange
  );
  const previewType = entityType ?? assetRequests[0]?.entityType ?? '';
  const filtered = useMemo(
    () => filterRequests(requests, search),
    [requests, search]
  );
  const selected = filtered.find((request) => request.id === selectedId);
  const canPreview = Boolean(previewType && entityId);
  const showPreview =
    canPreview && (selectedId === PREVIEW_KEY || filtered.length === 0);

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
              {subtitleOf(requests, t)}
            </Typography>
            <ReviewViewButton onSwitchView={onSwitchView} />
          </Dialog.Header>
          <Tabs
            className="tw:h-[520px] tw:flex-row"
            orientation="vertical"
            selectedKey={
              showPreview ? PREVIEW_KEY : firstIdOf(selected, filtered)
            }
            onSelectionChange={setSelectedId}>
            <RequestList
              canPreview={canPreview}
              isPreviewing={showPreview}
              requests={filtered}
              scope={scope}
              search={search}
              onPreview={() => setSelectedId(PREVIEW_KEY)}
              onScopeChange={setScope}
              onSearchChange={setSearch}
            />
            {filtered.map((request) => (
              <Tabs.Panel
                className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col"
                id={request.id}
                key={request.id}>
                <RequestDetail request={request} onChange={refresh} />
              </Tabs.Panel>
            ))}
            {canPreview && (
              <Tabs.Panel
                className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:overflow-y-auto tw:px-6 tw:py-5"
                id={PREVIEW_KEY}>
                <PreviewPanel
                  entityFqn={entityFqn}
                  entityId={entityId ?? ''}
                  entityType={previewType}
                />
              </Tabs.Panel>
            )}
          </Tabs>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default PendingChangesModal;
