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
  createContext,
  FunctionComponent,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import LogViewerModal from '../../components/common/LogViewerModal/LogViewerModal.component';
import { useIngestionPipelineLogs } from '../../hooks/useIngestionPipelineLogs';

export interface OpenLogsParams {
  logEntityType: string;
  fqn: string;
  runId?: string;
}

interface LogsViewerModalContextType {
  openLogs: (params: OpenLogsParams) => void;
}

const LogsViewerModalContext = createContext<LogsViewerModalContextType>({
  openLogs: () => undefined,
});

export const useLogsViewerModal = (): LogsViewerModalContextType =>
  useContext(LogsViewerModalContext);

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
  } = useIngestionPipelineLogs({ logEntityType, fqn, runId });

  return (
    <LogViewerModal
      open
      downloading={downloading}
      hasMore={hasMore}
      loading={loading}
      loadingMore={loadingMore}
      logs={logs}
      mode={isLive ? 'stream' : 'static'}
      title={`${title} · ${t('label.log-plural')}`}
      totalLines={totalLines}
      onClose={onClose}
      onDownload={download}
      onLoadMore={loadMore}
    />
  );
};

export const LogsViewerModalProvider: FunctionComponent<{
  children: ReactNode;
}> = ({ children }) => {
  const [params, setParams] = useState<OpenLogsParams | null>(null);

  const openLogs = useCallback((next: OpenLogsParams) => {
    setParams(next);
  }, []);

  const handleClose = useCallback(() => {
    setParams(null);
  }, []);

  const contextValue = useMemo(() => ({ openLogs }), [openLogs]);

  return (
    <LogsViewerModalContext.Provider value={contextValue}>
      {children}
      {params && <LogsViewerModalContainer {...params} onClose={handleClose} />}
    </LogsViewerModalContext.Provider>
  );
};
