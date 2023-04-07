/*
 *  Copyright 2022 Collate.
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
import GlossaryHeader from 'components/Glossary/GlossaryHeader/GlossaryHeader.component';
import GlossaryTabs from 'components/GlossaryTabs/GlossaryTabs.component';
import { PAGE_SIZE } from 'constants/constants';
import { myDataSearchIndex } from 'constants/Mydata.constants';
import { AssetsDataType } from 'Models';
import React, { useEffect, useState } from 'react';
import { searchData } from 'rest/miscAPI';
import { formatDataResponse, SearchEntityHits } from 'utils/APIUtils';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import jsonData from '../../jsons/en';
import { showErrorToast } from '../../utils/ToastUtils';
import { OperationPermission } from '../PermissionProvider/PermissionProvider.interface';

type Props = {
  permissions: OperationPermission;
  glossaryTerm: GlossaryTerm;
  childGlossaryTerms: GlossaryTerm[];
  handleGlossaryTermUpdate: (data: GlossaryTerm) => Promise<void>;
  handleGlossaryTermDelete: (id: string) => void;
  refreshGlossaryTerms: () => void;
};

const GlossaryTermsV1 = ({
  glossaryTerm,
  childGlossaryTerms,
  handleGlossaryTermUpdate,
  handleGlossaryTermDelete,
  permissions,
  refreshGlossaryTerms,
}: Props) => {
  const [assetData, setAssetData] = useState<AssetsDataType>({
    isLoading: true,
    data: [],
    total: 0,
    currPage: 1,
  });

  const fetchGlossaryTermAssets = async (fqn: string, currentPage = 1) => {
    setAssetData((pre) => ({
      ...pre,
      isLoading: true,
    }));
    if (fqn) {
      try {
        const res = await searchData(
          '',
          currentPage,
          PAGE_SIZE,
          `(tags.tagFQN:"${fqn}")`,
          '',
          '',
          myDataSearchIndex
        );

        const hits = res?.data?.hits?.hits as SearchEntityHits;
        const isData = hits?.length > 0;
        setAssetData(() => {
          const data = isData ? formatDataResponse(hits) : [];
          const total = isData ? res.data.hits.total.value : 0;

          return {
            isLoading: false,
            data,
            total,
            currPage: currentPage,
          };
        });
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          jsonData['api-error-messages']['elastic-search-error']
        );
      }
    } else {
      setAssetData({ data: [], total: 0, currPage: 1, isLoading: false });
    }
  };

  useEffect(() => {
    fetchGlossaryTermAssets(
      glossaryTerm.fullyQualifiedName || glossaryTerm.name
    );
  }, [glossaryTerm.fullyQualifiedName]);

  return (
    <Row data-testid="glossary-term" gutter={[0, 8]}>
      <Col span={24}>
        <GlossaryHeader
          isGlossary={false}
          permissions={permissions}
          selectedData={glossaryTerm}
          onAssetsUpdate={() =>
            glossaryTerm.fullyQualifiedName &&
            fetchGlossaryTermAssets(glossaryTerm.fullyQualifiedName)
          }
          onDelete={handleGlossaryTermDelete}
          onUpdate={(data) => handleGlossaryTermUpdate(data as GlossaryTerm)}
        />
      </Col>

      <Col span={24}>
        <GlossaryTabs
          assetData={assetData}
          childGlossaryTerms={childGlossaryTerms}
          isGlossary={false}
          permissions={permissions}
          refreshGlossaryTerms={refreshGlossaryTerms}
          selectedData={glossaryTerm}
          onUpdate={(data) => handleGlossaryTermUpdate(data as GlossaryTerm)}
        />
      </Col>
    </Row>
  );
};

export default GlossaryTermsV1;
