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
import { useAuthContext } from '../../auth-provider/AuthProvider';
import {
  addGlossaryTerm,
  getGlossariesByName,
  getGlossaryTermByFQN,
} from '../../axiosAPIs/glossaryAPI';
import { ROUTES } from '../../constants/constants';
import { CreateGlossaryTerm } from '../../generated/api/data/createGlossaryTerm';
import { Glossary } from '../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { useAuth } from '../../hooks/authHooks';
import useToastContext from '../../hooks/useToastContext';
import AddGlossaryTerm from '../AddGlossaryTerm/AddGlossaryTerm.component';
import PageContainerV1 from '../containers/PageContainerV1';
import Loader from '../Loader/Loader';

const AddGlossaryTermPage = () => {
  const { glossaryName, glossaryTermsFQN } =
    useParams<{ [key: string]: string }>();
  const showToast = useToastContext();
  const history = useHistory();
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const [status, setStatus] = useState<LoadingState>('initial');
  const [isLoading, setIsLoading] = useState(true);
  const [glossaryData, setGlossaryData] = useState<Glossary>();

  const [parentGlossaryData, setParentGlossaryData] = useState<GlossaryTerm>();

  const goToGlossary = () => {
    history.push(ROUTES.GLOSSARY);
  };

  const handleCancel = () => {
    goToGlossary();
  };

  const onSave = (data: CreateGlossaryTerm) => {
    setStatus('waiting');
    addGlossaryTerm(data)
      .then(() => {
        setStatus('success');
        setTimeout(() => {
          setStatus('initial');
          goToGlossary();
        }, 500);
      })
      .catch((err: AxiosError) => {
        showToast({
          variant: 'error',
          body: err.message || 'Something went wrong!',
        });
        setStatus('initial');
      });
  };

  const fetchGlossaryData = () => {
    getGlossariesByName(glossaryName, ['tags', 'owner', 'reviewers'])
      .then((res: AxiosResponse) => {
        setGlossaryData(res.data);
      })
      .catch((err: AxiosError) => {
        showToast({
          variant: 'error',
          body: err.message || 'Error while fetching glossary!',
        });
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
        setParentGlossaryData(res.data);
      })
      .catch((err: AxiosError) => {
        setParentGlossaryData(undefined);
        showToast({
          variant: 'error',
          body: err.message || 'Error while fetching glossary terms!',
        });
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
