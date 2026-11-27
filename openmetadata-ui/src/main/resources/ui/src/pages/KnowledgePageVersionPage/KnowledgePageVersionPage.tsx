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
import { FC, useCallback, useEffect, useRef, useState } from 'react';
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
import { File06 as Articles } from '@openmetadata/ui-core-components/icons';

import NoDataPlaceholder from '../../components/common/EmptyPlaceholder/NoDataPlaceholder';
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
  const [isVersionListLoading, setIsVersionListLoading] = useState(true);
  const [isVersionDataLoading, setIsVersionDataLoading] = useState(true);
  const [knowledgePage, setKnowledgePage] = useState<KnowledgePage>();
  const [versionList, setVersionList] = useState<EntityHistory>(
    {} as EntityHistory
  );
  const [selectedData, setSelectedData] = useState<KnowledgePage>();

  // Guards against a stale version-data response overwriting a newer one when
  // the user switches versions while a previous request is still in flight.
  const activeVersionReqId = useRef(0);

  const fetchActiveVersion = useCallback(async () => {
    if (!knowledgePage) {
      return;
    }
    const reqId = ++activeVersionReqId.current;
    setIsVersionDataLoading(true);
    try {
      const res = await getKnowledgePageVersionData(knowledgePage.id, version);
      if (reqId !== activeVersionReqId.current) {
        return;
      }
      setSelectedData(res);
    } catch (error) {
      if (reqId !== activeVersionReqId.current) {
        return;
      }
      setSelectedData(undefined);
      showErrorToast(error as AxiosError);
    } finally {
      if (reqId === activeVersionReqId.current) {
        setIsVersionDataLoading(false);
      }
    }
  }, [knowledgePage, version]);

  const fetchKnowledgePage = useCallback(async () => {
    setIsVersionListLoading(true);
    try {
      const res = await getKnowledgePageByFqn(fqn);
      setKnowledgePage(res);
    } catch (error) {
      showErrorToast(error as AxiosError);
      setIsVersionListLoading(false);
      // No knowledgePage means no version-data request will start, so the
      // content skeleton would otherwise hang — clear it here too.
      setIsVersionDataLoading(false);
    }
  }, [fqn]);

  const fetchVersionsInfo = useCallback(async () => {
    if (!knowledgePage) {
      return;
    }
    setIsVersionListLoading(true);
    try {
      const res = await getKnowledgePageVersionsList(knowledgePage.id);
      setVersionList(res);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsVersionListLoading(false);
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
  }, [
    selectedData,
    isVersionListLoading,
    isVersionDataLoading,
    versionList,
    version,
    knowledgePage,
  ]);

  const versionDataSkeleton = (
    <Box
      inline
      align="stretch"
      className="layout-space tw:w-[650px]"
      direction="col"
      gap={2}
      itemClassName="layout-space-item">
      <Box gap={4}>
        <Skeleton className="tw:shrink-0" variant="circular" width={40} />
        <SkeletonParagraph rows={2} title={false} />
      </Box>
      <SkeletonParagraph className="m-t-sm" rows={8} title={false} />
    </Box>
  );

  if (isVersionListLoading) {
    return <div className="version-data">{versionDataSkeleton}</div>;
  }

  const versionDataContent = selectedData ? (
    <KnowledgePageVersion knowledgePage={selectedData} />
  ) : (
    <Box className="tw:relative tw:min-h-60">
      <NoDataPlaceholder
        icon={<Articles />}
        title={t('label.no-entity', { entity: t('label.version') })}
      />
    </Box>
  );

  return (
    <>
      <div className="version-data">
        {isVersionDataLoading ? versionDataSkeleton : versionDataContent}
      </div>
      {getVersionTimeLineElement()}
    </>
  );
};

export default KnowledgePageVersionPage;
