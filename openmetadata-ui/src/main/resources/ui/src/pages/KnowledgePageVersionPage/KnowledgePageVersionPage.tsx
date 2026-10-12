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

import {
  Box,
  Skeleton,
  SkeletonParagraph,
} from '@openmetadata/ui-core-components';

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
  }, [knowledgePage, version]);

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
  }, [fqn]);

  useEffect(() => {
    fetchVersionsInfo();
  }, [knowledgePage?.id]);

  useEffect(() => {
    if (knowledgePage) {
      fetchActiveVersion();
    }
  }, [version, knowledgePage?.id]);

  useEffect(() => {
    onPageChange({
      rightPanel: null,
      title: getKnowledgePageName(selectedData, t),
      data: knowledgePage,
    });
  }, [selectedData, loading, versionList, version, knowledgePage]);

  if (loading) {
    return (
      <>
        <div className="version-data">
          <Box
            inline
            align="stretch"
            className="layout-space"
            direction="col"
            gap={2}
            itemClassName="layout-space-item"
            style={{ width: '650px' }}>
            <div className="tw:flex tw:gap-4">
              <Skeleton className="tw:shrink-0" variant="circular" width={40} />
              <div className="tw:flex-1">
                <SkeletonParagraph rows={2} title={false} />
              </div>
            </div>
            <SkeletonParagraph className="m-t-sm" rows={8} title={false} />
          </Box>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="version-data">
        {selectedData && (
          <KnowledgePageVersion
            knowledgePage={selectedData}
            loading={loading}
          />
        )}
      </div>
      {getVersionTimeLineElement()}
    </>
  );
};

export default KnowledgePageVersionPage;
