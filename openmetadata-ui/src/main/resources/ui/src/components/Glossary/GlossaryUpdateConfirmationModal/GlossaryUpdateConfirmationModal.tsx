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
  Alert,
  Button,
  Dialog,
  FeaturedIcon,
  Modal,
  ModalOverlay,
  ProgressBarCircle,
  Typography,
} from '@openmetadata/ui-core-components';
import { AlertCircle } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ClientErrors } from '../../../enums/Axios.enum';
import { EntityType } from '../../../enums/entity.enum';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../../generated/entity/type';
import {
  BulkOperationResult,
  Status,
} from '../../../generated/type/bulkOperationResult';
import { validateTagAddtionToGlossary } from '../../../rest/glossaryAPI';
import { getEntityLinkFromType } from '../../../utils/EntityLinkUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import Table from '../../common/Table/TableV2';
import {
  GlossaryUpdateConfirmationModalProps,
  UpdateState,
} from './GlossaryUpdateConfirmationModal.interface';

const renderFooter = (
  failedStatus: BulkOperationResult | undefined,
  onCancel: () => void,
  t: (key: string) => string
) => (
  <div className="tw:flex tw:w-full tw:items-center tw:justify-between">
    <Typography color="secondary">
      {failedStatus?.numberOfRowsFailed &&
        `${failedStatus.numberOfRowsFailed} ${t('label.failed')}`}
    </Typography>
    <Button color="secondary" onPress={onCancel}>
      {t('label.cancel')}
    </Button>
  </div>
);

const renderFailedContent = (
  failedStatus: BulkOperationResult | undefined,
  tagError: { code: number; message: string } | undefined,
  t: (key: string) => string
) => {
  const columns = [
    {
      title: t('label.asset-plural'),
      dataIndex: 'request',
      key: 'request',
      render: (record: EntityReference) => (
        <Link
          target="_blank"
          to={getEntityLinkFromType(
            record.fullyQualifiedName ?? '',
            record.type as EntityType
          )}>
          {record.fullyQualifiedName}
        </Link>
      ),
    },
    {
      title: t('label.failure-reason'),
      dataIndex: 'message',
      key: 'message',
      render: (error: string) => (
        <Typography as="p" className="tw:text-primary">
          {error}
        </Typography>
      ),
    },
  ];

  return (
    <div className="tw:flex tw:flex-col tw:gap-2">
      {failedStatus && (
        <>
          <Table
            columns={columns}
            dataSource={failedStatus?.failedRequest ?? []}
            pagination={{
              pageSize: 5,
              showSizeChanger: true,
            }}
            rowKey={(record) => record.request?.id}
          />
          <Alert
            className="tw:mt-2"
            title={t('message.glossary-tag-assignment-help-message')}
            variant="warning"
          />
        </>
      )}
      {tagError?.code === ClientErrors.BAD_REQUEST && (
        <Alert title={tagError.message} variant="warning" />
      )}
    </div>
  );
};

export const GlossaryUpdateConfirmationModal = ({
  glossaryTerm,
  onValidationSuccess,
  onCancel,
  updatedTags,
}: GlossaryUpdateConfirmationModalProps) => {
  const [failedStatus, setFailedStatus] = useState<BulkOperationResult>();
  const [tagError, setTagError] = useState<{ code: number; message: string }>();
  const [updateState, setUpdateState] = useState(UpdateState.INITIAL);
  const { t } = useTranslation();

  const handleUpdateConfirmation = async () => {
    setUpdateState(UpdateState.VALIDATING);

    try {
      // dryRun validations so that we can list failures if any
      const res = await validateTagAddtionToGlossary(
        { ...glossaryTerm, tags: updatedTags } as GlossaryTerm,
        true
      );

      if (res.status === Status.Success) {
        setUpdateState(UpdateState.UPDATING);
        try {
          await onValidationSuccess();
          setUpdateState(UpdateState.SUCCESS);
        } catch (err) {
          // Error
        } finally {
          setTimeout(onCancel, 500);
        }
      } else {
        setUpdateState(UpdateState.FAILED);
        setFailedStatus(res);
      }
    } catch (err) {
      // error
      setTagError(
        (err as AxiosError).response?.data as { code: number; message: string }
      );
      setUpdateState(UpdateState.FAILED);
    }
  };

  let progress = 100;
  if (updateState === UpdateState.VALIDATING) {
    progress = 10;
  } else if (updateState === UpdateState.UPDATING) {
    progress = 60;
  }

  const data = useMemo(() => {
    const footer = renderFooter(failedStatus, onCancel, t);

    const progressBar = (
      <div className="tw:flex tw:justify-center">
        <ProgressBarCircle size="sm" value={progress} />
      </div>
    );

    switch (updateState) {
      case UpdateState.INITIAL:
        return {
          footer: null,
          content: (
            <div className="tw:flex tw:flex-col tw:items-center tw:gap-2">
              <FeaturedIcon
                className="tw:mb-4"
                color="warning"
                icon={AlertCircle}
                size="xl"
                theme="light"
              />
              <Typography as="h5" size="text-md" weight="semibold">
                {t('message.tag-update-confirmation')}
              </Typography>
              <Typography className="tw:text-center">
                {t('message.glossary-tag-update-description')}{' '}
                <span className="tw:font-medium">
                  {getEntityName(glossaryTerm)}
                </span>
              </Typography>
              <div className="tw:mt-6 tw:flex tw:items-center tw:gap-2">
                <Button color="secondary" onPress={onCancel}>
                  {t('label.no-comma-cancel')}
                </Button>
                <Button color="primary" onPress={handleUpdateConfirmation}>
                  {t('label.yes-comma-confirm')}
                </Button>
              </div>
            </div>
          ),
        };
      case UpdateState.VALIDATING:
        return {
          content: progressBar,
          footer: footer,
        };
      case UpdateState.FAILED:
        return {
          content: renderFailedContent(failedStatus, tagError, t),
          footer: renderFooter(failedStatus, onCancel, t),
        };
      case UpdateState.UPDATING:
      case UpdateState.SUCCESS:
        return {
          content: progressBar,
          footer: (
            <Button color="secondary" onPress={onCancel}>
              {t('label.cancel')}
            </Button>
          ),
        };
    }
  }, [updateState, failedStatus]);

  const modalTitle = useMemo(() => {
    switch (updateState) {
      case UpdateState.VALIDATING:
      case UpdateState.UPDATING:
      case UpdateState.SUCCESS:
        return t('message.glossary-tag-update-modal-title-validating');
      case UpdateState.FAILED:
        return t('message.glossary-tag-update-modal-title-failed');
      default:
        return undefined;
    }
  }, [updateState]);

  return (
    <ModalOverlay
      isOpen
      isDismissable={false}
      onOpenChange={(open) => !open && onCancel()}>
      <Modal>
        <Dialog
          dividers="scroll"
          title={modalTitle}
          width={updateState === UpdateState.FAILED ? 750 : 520}>
          <Dialog.Content>{data.content}</Dialog.Content>
          {data.footer && <Dialog.Footer>{data.footer}</Dialog.Footer>}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
