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

import { Button } from 'antd';
import { AxiosError } from 'axios';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import PageContainerV1 from 'components/containers/PageContainerV1';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import GlossaryV1 from 'components/Glossary/GlossaryV1.component';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from 'components/PermissionProvider/PermissionProvider.interface';
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import { PAGE_SIZE_LARGE } from 'constants/constants';
import { GLOSSARIES_DOCS } from 'constants/docs.constants';
import { LOADING_STATE } from 'enums/common.enum';
import { compare } from 'fast-json-patch';
import { Glossary } from 'generated/entity/data/glossary';
import { GlossaryTerm } from 'generated/entity/data/glossaryTerm';
import { Operation } from 'generated/entity/policies/policy';
import jsonData from 'jsons/en';
import { isUndefined } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import {
  deleteGlossary,
  getGlossariesList,
  patchGlossaries,
} from 'rest/glossaryAPI';
import { checkPermission } from 'utils/PermissionsUtils';
import { getGlossaryPath } from 'utils/RouterUtils';
import { showErrorToast, showSuccessToast } from 'utils/ToastUtils';
import GlossaryLeftPanel from '../GlossaryLeftPanel/GlossaryLeftPanel.component';

const GlossaryPage = () => {
  const { permissions } = usePermissionProvider();
  const { glossaryName: glossaryFqn } = useParams<{ glossaryName: string }>();
  const history = useHistory();

  const [glossaries, setGlossaries] = useState<Glossary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteStatus, setDeleteStatus] = useState<LOADING_STATE>(
    LOADING_STATE.INITIAL
  );

  const isGlossaryActive = useMemo(() => {
    if (glossaryFqn) {
      return glossaryFqn.split(FQN_SEPARATOR_CHAR).length === 1;
    }

    return true;
  }, [glossaryFqn]);
  const selectedData = useMemo(() => {
    if (isGlossaryActive && glossaries.length) {
      if (glossaryFqn) {
        return (
          glossaries.find((glossary) => glossary.name === glossaryFqn) ||
          glossaries[0]
        );
      }

      return glossaries[0];
    }

    return undefined;
  }, [glossaryFqn, glossaries, isGlossaryActive]);

  const createGlossaryPermission = useMemo(
    () =>
      checkPermission(Operation.Create, ResourceEntity.GLOSSARY, permissions),
    [permissions]
  );

  const handleAddGlossaryClick = () => {
    history.push(getGlossaryPath());
  };

  const fetchGlossaryList = async () => {
    setIsLoading(true);
    try {
      const { data } = await getGlossariesList({
        fields: 'owner,tags,reviewers',
        limit: PAGE_SIZE_LARGE,
      });
      setGlossaries(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    fetchGlossaryList();
  }, []);

  const updateGlossary = async (updatedData: Glossary) => {
    const jsonPatch = compare(selectedData as Glossary, updatedData);

    try {
      const response = await patchGlossaries(
        selectedData?.id as string,
        jsonPatch
      );

      setGlossaries((pre) => {
        return pre.map((item) => {
          if (item.name === response.name) {
            return response;
          } else {
            return item;
          }
        });
      });

      if (selectedData?.name !== updatedData.name) {
        history.push(getGlossaryPath(response.name));
        fetchGlossaryList();
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleGlossaryDelete = (id: string) => {
    setDeleteStatus(LOADING_STATE.WAITING);
    deleteGlossary(id)
      .then(() => {
        setDeleteStatus(LOADING_STATE.SUCCESS);
        showSuccessToast(
          jsonData['api-success-messages']['delete-glossary-success']
        );
        history.push(getGlossaryPath());
        fetchGlossaryList();
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['delete-glossary-error']
        );
      })
      .finally(() => setDeleteStatus(LOADING_STATE.INITIAL));
  };

  if (isLoading || isUndefined(selectedData)) {
    return <Loader />;
  }

  if (glossaries.length === 0 && !isLoading) {
    return (
      <ErrorPlaceHolder
        buttons={
          <Button
            ghost
            className="tw-h-8 tw-rounded tw-my-3"
            data-testid="add-new-glossary"
            disabled={!createGlossaryPermission}
            type="primary"
            onClick={handleAddGlossaryClick}>
            Add New Glossary
          </Button>
        }
        doc={GLOSSARIES_DOCS}
        heading="Glossary"
        type="ADD_DATA"
      />
    );
  }

  return (
    <PageContainerV1>
      <PageLayoutV1 leftPanel={<GlossaryLeftPanel glossaries={glossaries} />}>
        <GlossaryV1
          assetData={{
            data: [],
            total: 1,
            currPage: 1,
          }}
          currentPage={0}
          deleteStatus={deleteStatus}
          handleGlossaryTermUpdate={function (
            value: GlossaryTerm
          ): Promise<void> {
            throw new Error('Function not implemented.');
          }}
          isChildLoading={false}
          isGlossaryActive={isGlossaryActive}
          selectedData={selectedData}
          updateGlossary={updateGlossary}
          onAssetPaginate={function (
            num: string | number,
            activePage?: number | undefined
          ): void {
            throw new Error('Function not implemented.');
          }}
          onGlossaryDelete={handleGlossaryDelete}
          onGlossaryTermDelete={function (id: string): void {
            throw new Error('Function not implemented.');
          }}
        />
      </PageLayoutV1>
    </PageContainerV1>
  );
};

export default GlossaryPage;
