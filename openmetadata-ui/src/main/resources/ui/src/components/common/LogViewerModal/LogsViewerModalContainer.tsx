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

import { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { useEntityLogs } from '../../../hooks/useEntityLogs';
import { OpenLogsParams } from '../../../hooks/useLogsModal';
import LogViewerModal from './LogViewerModal.component';

/**
 * Fetches the logs for `params` and renders the modal. Kept in its own module
 * so it can be lazy-loaded (see `useLogsModal`) — the modal, the logs hook and
 * their REST deps stay out of the initial bundle.
 */
const LogsViewerModalContainer: FunctionComponent<
  OpenLogsParams & { onClose: () => void }
> = ({ logEntityType, fqn, runId, onClose }) => {
  const { t } = useTranslation();
  const {
    logs,
    loading,
    loadingMore,
    hasMore,
    totalLines,
    title,
    downloading,
    isLive,
    loadMore,
    download,
  } = useEntityLogs({ logEntityType, fqn, runId });

  return (
    <LogViewerModal
      open
      downloading={downloading}
      hasMore={hasMore}
      loading={loading}
      loadingMore={loadingMore}
      logs={logs}
      mode={isLive ? 'stream' : 'static'}
      title={
        title ? `${title} · ${t('label.log-plural')}` : t('label.log-plural')
      }
      totalLines={totalLines}
      onClose={onClose}
      onDownload={download}
      onLoadMore={loadMore}
    />
  );
};

export default LogsViewerModalContainer;
