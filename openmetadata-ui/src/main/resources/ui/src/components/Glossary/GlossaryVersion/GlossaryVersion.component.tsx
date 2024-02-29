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
import React, { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { Glossary } from '../../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { EntityHistory } from '../../../generated/type/entityHistory';
import {
  getGlossaryTermsVersion,
  getGlossaryTermsVersionsList,
  getGlossaryVersion,
  getGlossaryVersionsList,
} from '../../../rest/glossaryAPI';
import {
  getGlossaryPath,
  getGlossaryTermsVersionsPath,
  getGlossaryVersionsPath,
} from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import Loader from '../../common/Loader/Loader';
import EntityVersionTimeLine from '../../Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import GlossaryV1Component from '../GlossaryV1.component';

interface GlossaryVersionProps {
  isGlossary?: boolean;
}

const GlossaryVersion = ({ isGlossary = false }: GlossaryVersionProps) => {
  const history = useHistory();
  const {
    version,
    tab = 'overview',
    id,
  } = useParams<{ version: string; tab: string; id: string }>();
  const [versionList, setVersionList] = useState<EntityHistory>(
    {} as EntityHistory
  );
  const [selectedData, setSelectedData] = useState<Glossary | GlossaryTerm>();
  const [isVersionLoading, setIsVersionLoading] = useState<boolean>(true);

  const fetchVersionsInfo = async () => {
    try {
      const res = isGlossary
        ? await getGlossaryVersionsList(id)
        : await getGlossaryTermsVersionsList(id);

      setVersionList(res);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchActiveVersion = async () => {
    setIsVersionLoading(true);
    try {
      const res = isGlossary
        ? await getGlossaryVersion(id, version)
        : await getGlossaryTermsVersion(id, version);

      setSelectedData(res);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsVersionLoading(false);
    }
  };

  const onVersionChange = (selectedVersion: string) => {
    const path = isGlossary
      ? getGlossaryVersionsPath(id, selectedVersion)
      : getGlossaryTermsVersionsPath(id, selectedVersion, tab);
    history.push(path);
  };

  const onBackHandler = () => {
    const path = getGlossaryPath(selectedData?.fullyQualifiedName);
    history.push(path);
  };

  useEffect(() => {
    fetchVersionsInfo();
  }, [id]);

  useEffect(() => {
    fetchActiveVersion();
  }, [id, version]);

  return (
    <PageLayoutV1 pageTitle="Glossary version">
      <div className="version-data">
        {/* TODO: Need to implement version component for Glossary */}
        {isVersionLoading ? (
          <Loader />
        ) : (
          <GlossaryV1Component
            isVersionsView
            isGlossaryActive={isGlossary}
            isSummaryPanelOpen={false}
            selectedData={selectedData as Glossary}
            updateGlossary={() => Promise.resolve()}
            onGlossaryDelete={() => Promise.resolve()}
            onGlossaryTermDelete={() => Promise.resolve()}
            onGlossaryTermUpdate={() => Promise.resolve()}
          />
        )}
      </div>
      <EntityVersionTimeLine
        currentVersion={toString(version)}
        versionHandler={onVersionChange}
        versionList={versionList}
        onBack={onBackHandler}
      />
    </PageLayoutV1>
  );
};

export default GlossaryVersion;
