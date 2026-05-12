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
import { toString, uniqueId } from 'lodash';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
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

import { Col, Row, Skeleton, Space } from 'antd';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { ROUTES } from '../../constants/constants';
import i18n from '../../utils/i18next/LocalUtil';
import {
  getKnowledgePagePath,
  getKnowledgeVersionsPath,
} from '../../utils/KnowledgePageUtils';
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

  const breadcrumbs = useMemo(
    () => [
      {
        name: t('label.home'),
        url: ROUTES.HOME,
      },
      {
        name: t('label.knowledge-center'),
        url: ROUTES.KNOWLEDGE_CENTER,
      },
      {
        name: (knowledgePage?.displayName ?? '') || t('label.untitled'),
        url: '',
        activeTitle: false,
      },
    ],
    [knowledgePage?.displayName]
  );

  const onVersionChange = (selectedVersion: string) => {
    const path = getKnowledgeVersionsPath(fqn, selectedVersion);
    navigate(path);
  };

  const onBackHandler = () => {
    const path = getKnowledgePagePath(selectedData?.fullyQualifiedName ?? '');
    navigate(path);
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

  const getHeaderElement = useCallback(
    () => (
      <div className="p-y-sm p-x-sm w-full border-bottom bg-white">
        <Row>
          {loading ? (
            Array(3)
              .fill(null)
              .map(() => (
                <Col key={uniqueId()}>
                  <Skeleton
                    active
                    className="m-r-xs m-b-xss"
                    paragraph={{ rows: 1, width: 100 }}
                    title={false}
                  />
                </Col>
              ))
          ) : (
            <Col className="d-flex items-center" span={16}>
              <TitleBreadcrumb titleLinks={breadcrumbs} />
            </Col>
          )}
        </Row>
      </div>
    ),
    [breadcrumbs, loading]
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
      title: selectedData?.displayName || t('label.untitled'),
      data: knowledgePage,
      header: getHeaderElement(),
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
