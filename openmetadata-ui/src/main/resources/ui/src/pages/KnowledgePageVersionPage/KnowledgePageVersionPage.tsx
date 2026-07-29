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
import { AxiosError } from 'axios';
import { toString } from 'lodash';
import { FC, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EntityVersionTimeLine from '../../components/Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import KnowledgePageVersion from '../../components/KnowledgeCenter/KnowledgePageVersion/KnowledgePageVersion';
import { EntityHistory } from '../../generated/type/entityHistory';
import {
  KnowledgeCenterPageProps,
  KnowledgePage,
} from '../../interface/knowledge-center.interface';
import {
  getKnowledgePageByFqn,
  getKnowledgePageVersionData,
  getKnowledgePageVersionsList,
} from '../../rest/knowledgeCenterAPI';

import { Skeleton, Space } from 'antd';
import contextCenterClassBase from '../../utils/ContextCenterClassBase';
import i18n from '../../utils/i18next/LocalUtil';
import { getKnowledgePageName } from '../../utils/KnowledgePagePureUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';

interface KnowledgePageVersionPageProps {
  onPageChange: (page: Partial<KnowledgeCenterPageProps>) => void;
}

const KnowledgePageVersionPage: FC<KnowledgePageVersionPageProps> = ({
  onPageChange,
}) => {
  const { t } = i18n;
  const navigate = useNavigate();
  const { fqn, version } = useRequiredParams<{
    fqn: string;
    version: string;
  }>();
  const [loading, setLoading] = useState(false);
  const [knowledgePage, setKnowledgePage] = useState<KnowledgePage>();
  const [versionList, setVersionList] = useState<EntityHistory>(
    {} as EntityHistory
  );
  const [selectedData, setSelectedData] = useState<KnowledgePage>();

  const fetchVersionsInfo = useCallback(async () => {
    if (!knowledgePage) {
      return;
    }
    try {
      setLoading(true);
      const res = await getKnowledgePageVersionsList(knowledgePage.id);
      setVersionList(res);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  }, [knowledgePage]);

  const fetchActiveVersion = useCallback(async () => {
    if (!knowledgePage) {
      return;
    }
    setLoading(true);
    try {
      const res = await getKnowledgePageVersionData(knowledgePage.id, version);
      setSelectedData(res);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  }, [knowledgePage]);

  const fetchKnowledgePage = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getKnowledgePageByFqn(fqn);
      setKnowledgePage(res);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  }, [fqn]);

  const onVersionChange = (selectedVersion: string) => {
    navigate(
      contextCenterClassBase.getArticleVersionPath(fqn, selectedVersion)
    );
  };

  const onBackHandler = () => {
    navigate(
      contextCenterClassBase.getArticlePath(
        knowledgePage?.fullyQualifiedName ??
          selectedData?.fullyQualifiedName ??
          fqn
      )
    );
  };

  const getVersionTimeLineElement = useCallback(
    () => (
      <EntityVersionTimeLine
        currentVersion={toString(version)}
        versionHandler={onVersionChange}
        versionList={versionList}
        onBack={onBackHandler}
      />
    ),
    [version, versionList, onVersionChange, onBackHandler]
  );

  useEffect(() => {
    fetchKnowledgePage();
  }, [fqn, version]);

  useEffect(() => {
    fetchVersionsInfo();
    fetchActiveVersion();
  }, [knowledgePage]);

  useEffect(() => {
    onPageChange({
      rightPanel: getVersionTimeLineElement(),
      title: getKnowledgePageName(selectedData, t),
      data: knowledgePage,
    });
  }, [selectedData, loading, versionList, version, knowledgePage]);

  if (loading) {
    return (
      <div className="knowledge-version-page-container">
        <Space direction="vertical" style={{ width: '650px' }}>
          <Skeleton active avatar paragraph={{ rows: 2 }} title={false} />
          <Skeleton
            active
            className="m-t-sm"
            paragraph={{ rows: 8 }}
            title={false}
          />
        </Space>
      </div>
    );
  }

  return (
    <>
      {selectedData && (
        <KnowledgePageVersion knowledgePage={selectedData} loading={loading} />
      )}
    </>
  );
};

export default KnowledgePageVersionPage;
