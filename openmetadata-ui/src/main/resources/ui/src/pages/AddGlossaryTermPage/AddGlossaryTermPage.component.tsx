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
import { LoadingState } from 'Models';
import React, { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import {
  addGlossaryTerm,
  getGlossariesByName,
  getGlossaryTermByFQN,
} from '../../axiosAPIs/glossaryAPI';
import AddGlossaryTerm from '../../components/AddGlossaryTerm/AddGlossaryTerm.component';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import Loader from '../../components/Loader/Loader';
import { getGlossaryPath } from '../../constants/constants';
import { CreateGlossaryTerm } from '../../generated/api/data/createGlossaryTerm';
import { Glossary } from '../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { useAuth } from '../../hooks/authHooks';
import jsonData from '../../jsons/en';
import { showErrorToast } from '../../utils/ToastUtils';

const AddGlossaryTermPage = () => {
  const { glossaryName, glossaryTermsFQN } =
    useParams<{ [key: string]: string }>();
  const history = useHistory();
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const [status, setStatus] = useState<LoadingState>('initial');
  const [isLoading, setIsLoading] = useState(true);
  const [glossaryData, setGlossaryData] = useState<Glossary>();

  const [parentGlossaryData, setParentGlossaryData] = useState<GlossaryTerm>();

  const goToGlossary = (name = '') => {
    history.push(getGlossaryPath(name));
  };

  const handleCancel = () => {
    goToGlossary();
  };

  const handleSaveFailure = (
    error: AxiosError | string,
    fallbackText?: string
  ) => {
    showErrorToast(error, fallbackText);
    setStatus('initial');
  };

  const onSave = (data: CreateGlossaryTerm) => {
    setStatus('waiting');
    addGlossaryTerm(data)
      .then((res) => {
        if (res.data) {
          setStatus('success');
          setTimeout(() => {
            setStatus('initial');
            goToGlossary(res?.data?.fullyQualifiedName);
          }, 500);
        } else {
          handleSaveFailure(
            jsonData['api-error-messages']['add-glossary-term-error']
          );
        }
      })
      .catch((err: AxiosError) => {
        handleSaveFailure(
          err,
          jsonData['api-error-messages']['add-glossary-term-error']
        );
      });
  };

  const fetchGlossaryData = () => {
    getGlossariesByName(glossaryName, ['tags', 'owner', 'reviewers'])
      .then((res: AxiosResponse) => {
        if (res.data) {
          setGlossaryData(res.data);
        } else {
          setGlossaryData(undefined);
          showErrorToast(
            jsonData['api-error-messages']['fetch-glossary-error']
          );
        }
      })
      .catch((err: AxiosError) => {
        setGlossaryData(undefined);
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-glossary-error']
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
        if (res.data) {
          setParentGlossaryData(res.data);
        } else {
          setParentGlossaryData(undefined);
          showErrorToast(
            jsonData['api-error-messages']['fetch-glossary-term-error']
          );
        }
      })
      .catch((err: AxiosError) => {
        setParentGlossaryData(undefined);
        showErrorToast(
          err.response?.data?.message ||
            jsonData['api-error-messages']['fetch-glossary-term-error']
        );
      });
  };

  useEffect(() => {
    fetchGlossaryData();
  }, [glossaryName]);

  useEffect(() => {
    if (glossaryTermsFQN) {
      fetchGlossaryTermsByName(glossaryTermsFQN);
    }
  }, [glossaryTermsFQN]);

  return (
    <PageContainerV1>
      {isLoading ? (
        <Loader />
      ) : (
        <AddGlossaryTerm
          allowAccess={isAdminUser || isAuthDisabled}
          glossaryData={glossaryData as Glossary}
          parentGlossaryData={parentGlossaryData}
          saveState={status}
          onCancel={handleCancel}
          onSave={onSave}
        />
      )}
    </PageContainerV1>
  );
};

export default AddGlossaryTermPage;
