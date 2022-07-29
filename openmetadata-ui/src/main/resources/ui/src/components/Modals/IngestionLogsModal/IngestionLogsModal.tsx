/*
 *  Copyright 2021 Collate
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

import { Viewer } from '@toast-ui/react-editor';
import { Button, Empty, Modal } from 'antd';
import { AxiosError, AxiosResponse } from 'axios';
import classNames from 'classnames';
import { isNil } from 'lodash';
import React, { FC, Fragment, useEffect, useState } from 'react';
import { getIngestionPipelineLogById } from '../../../axiosAPIs/ingestionPipelineAPI';
import { PipelineType } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { gzipToStringConverter } from '../../../utils/ingestionutils';
import { showErrorToast } from '../../../utils/ToastUtils';
import CopyToClipboardButton from '../../buttons/CopyToClipboardButton/CopyToClipboardButton';
import Loader from '../../Loader/Loader';

interface IngestionLogsModalProps {
  pipelineId: string;
  pipelinName: string;
  pipelineType: PipelineType;
  isModalOpen: boolean;
  onClose: () => void;
}

const IngestionLogsModal: FC<IngestionLogsModalProps> = ({
  pipelineId,
  pipelinName,
  pipelineType,
  isModalOpen,
  onClose,
}) => {
  const [logs, setLogs] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLogNotFound, setIsLogNotFound] = useState<boolean>(false);

  const fetchLogs = (id: string) => {
    setIsLoading(true);
    getIngestionPipelineLogById(id)
      .then((res: AxiosResponse) => {
        switch (pipelineType) {
          case PipelineType.Metadata:
            setLogs(gzipToStringConverter(res.data?.ingestion_task || ''));

            break;
          case PipelineType.Profiler:
            setLogs(gzipToStringConverter(res.data?.profiler_task || ''));

            break;
          case PipelineType.Usage:
            setLogs(gzipToStringConverter(res.data?.usage_task || ''));

            break;

          default:
            setLogs('');

            break;
        }
      })
      .catch((err: AxiosError) => {
        if (err.response?.status === 404) {
          setIsLogNotFound(true);
        } else {
          showErrorToast(err);
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const handleJumpToEnd = () => {
    const logsBody = document.getElementById('logs-body') as HTMLElement;
    if (!isNil(logsBody)) {
      logsBody.scrollTop = logsBody.scrollHeight;
    }
  };

  const modalTitle = (
    <div className="tw-flex tw-justify-between tw-mr-8">
      {`Logs for ${pipelinName}`} <CopyToClipboardButton copyText={logs} />
    </div>
  );

  useEffect(() => {
    fetchLogs(pipelineId);
  }, [pipelineId]);

  return (
    <Modal
      destroyOnClose
      afterClose={() => setLogs('')}
      data-testid="logs-modal"
      footer={null}
      title={modalTitle}
      visible={isModalOpen}
      width={1200}
      onCancel={onClose}>
      {isLoading ? (
        <Loader />
      ) : (
        <Fragment>
          {logs ? (
            <Fragment>
              <Button
                className="tw-mb-2 ant-btn-primary-custom"
                data-testid="jump-to-end-button"
                type="primary"
                onClick={handleJumpToEnd}>
                Jump to end
              </Button>
              <div
                className={classNames('tw-overflow-y-auto', {
                  'tw-h-100': logs,
                })}
                data-testid="logs-body"
                id="logs-body">
                <Viewer initialValue={logs} />
              </div>
            </Fragment>
          ) : (
            <Empty
              data-testid="empty-logs"
              description={
                isLogNotFound
                  ? `No logs yet found for the latest execution of ${pipelinName}`
                  : 'No logs data available'
              }
            />
          )}
        </Fragment>
      )}
    </Modal>
  );
};

export default IngestionLogsModal;
