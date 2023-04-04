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
import { Col, Row } from 'antd';
import { AxiosError } from 'axios';
import PageContainer from 'components/containers/PageContainer';
import EntityVersionTimeLine from 'components/EntityVersionTimeLine/EntityVersionTimeLine';
import GlossaryV1 from 'components/Glossary/GlossaryV1.component';
import { LOADING_STATE } from 'enums/common.enum';
import { Glossary } from 'generated/entity/data/glossary';
import { GlossaryTerm } from 'generated/entity/data/glossaryTerm';
import { EntityHistory } from 'generated/type/entityHistory';
import GlossaryRightPanel from 'pages/Glossary/GlossaryRightPanel/GlossaryRightPanel.component';
import React, { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { getGlossaryVersion, getGlossaryVersionsList } from 'rest/glossaryAPI';
import { getGlossaryVersionsPath } from 'utils/RouterUtils';
import { showErrorToast } from 'utils/ToastUtils';

const GlossaryVersion: React.FC = () => {
  const history = useHistory();
  const { glossaryName, version } =
    useParams<{ glossaryName: string; version: string }>();
  const [versionList, setVersionList] = useState<EntityHistory>(
    {} as EntityHistory
  );
  const [selectedData, setSelectedData] = useState<Glossary | GlossaryTerm>();

  const fetchVersionsInfo = async () => {
    try {
      const res = await getGlossaryVersionsList(glossaryName);
      setVersionList(res);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchActiveVersion = async () => {
    try {
      const res = await getGlossaryVersion(glossaryName, version);
      setSelectedData(res);
      console.log(res);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const mockFnGlossary = async (value: Glossary) => {
    console.debug('On back', value);
  };

  const mockFn = () => {
    console.debug('mock fn');
  };
  const onVersionHandler = (selectedVersion: string) => {
    const path = getGlossaryVersionsPath(glossaryName, selectedVersion);
    history.push(path);
  };

  useEffect(() => {
    fetchVersionsInfo();
    fetchActiveVersion();
  }, [glossaryName, version]);

  return (
    <PageContainer>
      <div className="version-data p-l-lg">
        <Row gutter={[16, 0]} wrap={false}>
          <Col flex="auto">
            <GlossaryV1
              isGlossaryActive
              deleteStatus={LOADING_STATE.INITIAL}
              selectedData={selectedData as Glossary}
              updateGlossary={mockFnGlossary}
              onGlossaryDelete={mockFn}
              onGlossaryTermDelete={mockFn}
              onGlossaryTermUpdate={mockFnGlossary}
            />
          </Col>
          {selectedData && (
            <Col flex="400px">
              <GlossaryRightPanel
                isGlossary
                entityDetails={selectedData as Glossary}
                onGlossaryTermUpdate={mockFnGlossary}
                onGlossaryUpdate={mockFnGlossary}
              />
            </Col>
          )}
        </Row>
      </div>
      <EntityVersionTimeLine
        show
        currentVersion={version}
        versionHandler={onVersionHandler}
        versionList={versionList}
        onBack={mockFn}
      />
    </PageContainer>
  );
};

export default GlossaryVersion;
