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

import { AxiosError, AxiosResponse } from 'axios';
import { compare } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import { Key } from 'rc-tree/lib/interface';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import {
  getGlossariesByName,
  getGlossaryTermByFQN,
  getGlossaryTerms,
  patchGlossaries,
  patchGlossaryTerm,
} from '../../axiosAPIs/glossaryAPI';
import { TitleBreadcrumbProps } from '../../components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainer from '../../components/containers/PageContainer';
import GlossaryTerms from '../../components/GlossaryTerms/GlossaryTerms.component';
import Loader from '../../components/Loader/Loader';
import { Glossary } from '../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { useAuth } from '../../hooks/authHooks';
import jsonData from '../../jsons/en';
import { getTagCategories, getTaglist } from '../../utils/TagsUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const GlossaryTermPage: FunctionComponent = () => {
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const { glossaryName, glossaryTermsFQN } =
    useParams<{ [key: string]: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [glossaryData, setGlossaryData] = useState<Glossary>();
  const [glossaryTerms, setGlossaryTerms] = useState<Array<GlossaryTerm>>([]);
  const [activeGlossaryTerm, setActiveGlossaryTerm] = useState<GlossaryTerm>();
  const [slashedTableName, setSlashedTableName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [activeTab, setActiveTab] = useState<number>(1);
  const [selectedKeys, setSelectedKeys] = useState<string>('');
  const [expandedKeys, setExpandedKeys] = useState<Array<string>>([]);
  const [queryParams, setQueryParams] = useState<string>(glossaryTermsFQN);
  const [showGlossaryDetails, setShowGlossaryDetails] = useState(
    !glossaryTermsFQN
  );

  const [tagList, setTagList] = useState<Array<string>>([]);
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);

  const location = useLocation();

  const activeTabHandler = (value: number) => {
    setActiveTab(value);
  };

  const fetchGlossaryTermsData = (id?: string) => {
    setIsLoading(true);
    getGlossaryTerms(id, ['children', 'relatedTerms', 'reviewers', 'tags'])
      .then((res: AxiosResponse) => {
        const { data } = res.data;
        setGlossaryTerms(data);
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-glossary-terms-error']
        );
      })
      .finally(() => setIsLoading(false));
  };

  const fetchGlossaryTermsByName = (name: string) => {
    getGlossaryTermByFQN(name, [
      'children',
      'relatedTerms',
      'reviewers',
      'tags',
    ])
      .then((res: AxiosResponse) => {
        setActiveGlossaryTerm(res.data);
      })
      .catch((err: AxiosError) => {
        setActiveGlossaryTerm(undefined);
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-glossary-terms-error']
        );
      });
  };

  const fetchGlossaryData = () => {
    setIsLoading(true);
    getGlossariesByName(glossaryName, ['tags', 'owner', 'reviewers'])
      .then((res: AxiosResponse) => {
        setGlossaryData(res.data);
        setSlashedTableName([
          {
            name: glossaryName,
            url: '',
            activeTitle: true,
          },
        ]);
        fetchGlossaryTermsData(res.data.id);
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-glossary-error']
        );
        setIsLoading(false);
      });
  };

  const handleActiveGlossaryTerm = (
    term: GlossaryTerm | undefined,
    id: string
  ) => {
    if (term) {
      setActiveGlossaryTerm(term);
    } else {
      fetchGlossaryTermsByName(id);
    }
  };

  const handleSelectedKey = (key: string) => {
    setSelectedKeys(key);
  };

  const handleExpand = (key: Key[]) => {
    setExpandedKeys(key as string[]);
  };

  const saveUpdatedGlossaryTermData = (
    updatedData: GlossaryTerm
  ): Promise<AxiosResponse> => {
    const jsonPatch = compare(activeGlossaryTerm as GlossaryTerm, updatedData);

    return patchGlossaryTerm(
      activeGlossaryTerm?.id as string,
      jsonPatch
    ) as unknown as Promise<AxiosResponse>;
  };

  const handleGlossaryTermUpdate = (updatedData: GlossaryTerm) => {
    saveUpdatedGlossaryTermData(updatedData)
      .then((res: AxiosResponse) => {
        setActiveGlossaryTerm(res.data);
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['update-glossary-term-error']
        );
      });
  };

  const saveUpdatedGlossaryData = (
    updatedData: Glossary
  ): Promise<AxiosResponse> => {
    const jsonPatch = compare(glossaryData as Glossary, updatedData);

    return patchGlossaries(
      glossaryData?.id as string,
      jsonPatch
    ) as unknown as Promise<AxiosResponse>;
  };

  const updateGlossaryDescription = (updatedData: Glossary) => {
    saveUpdatedGlossaryData(updatedData)
      .then((res: AxiosResponse) => {
        setGlossaryData(res.data);
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['update-description-error']
        );
      });
  };

  const updateReviewer = (updatedData: Glossary) => {
    saveUpdatedGlossaryData(updatedData)
      .then((res: AxiosResponse) => {
        setGlossaryData(res.data);
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['update-reviewer-error']
        );
      });
  };

  const fetchTags = () => {
    setIsTagLoading(true);
    getTagCategories()
      .then((res) => {
        setTagList(getTaglist(res.data));
      })
      .catch((err: AxiosError) => {
        showErrorToast(err, jsonData['api-error-messages']['fetch-tags-error']);
      })
      .finally(() => {
        setIsTagLoading(false);
      });
  };

  useEffect(() => {
    if (!isEmpty(glossaryTermsFQN)) {
      setQueryParams(glossaryTermsFQN);
    }

    setShowGlossaryDetails(!glossaryTermsFQN);
  }, [location.pathname]);

  useEffect(() => {
    fetchGlossaryData();
  }, [glossaryName]);

  return (
    <PageContainer className="tw-pt-4">
      {isLoading ? (
        <Loader />
      ) : (
        <GlossaryTerms
          activeGlossaryTerm={activeGlossaryTerm}
          activeTab={activeTab}
          activeTabHandler={activeTabHandler}
          allowAccess={isAdminUser || isAuthDisabled}
          expandedKeys={expandedKeys}
          fetchTags={fetchTags}
          glossaryDetails={glossaryData as Glossary}
          glossaryTermsDetails={glossaryTerms}
          handleActiveGlossaryTerm={handleActiveGlossaryTerm}
          handleExpand={handleExpand}
          handleGlossaryTermUpdate={handleGlossaryTermUpdate}
          handleSelectedKey={handleSelectedKey}
          isTagLoading={isTagLoading}
          queryParams={queryParams}
          selectedKeys={selectedKeys}
          showGlossaryDetails={showGlossaryDetails}
          slashedTableName={slashedTableName}
          tagList={tagList}
          updateGlossaryDescription={updateGlossaryDescription}
          updateReviewer={updateReviewer}
        />
      )}
    </PageContainer>
  );
};

export default GlossaryTermPage;
