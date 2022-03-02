import { AxiosError, AxiosResponse } from 'axios';
import { FormatedUsersData, LoadingState } from 'Models';
import React, { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import {
  addGlossaryTerm,
  getGlossariesByName,
  getGlossaryTermsByFQN,
} from '../../axiosAPIs/glossaryAPI';
import { getUserByName } from '../../axiosAPIs/userAPI';
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
  const { isAuthDisabled, isAdminUser } = useAuth();
  const [status, setStatus] = useState<LoadingState>('initial');
  const [isLoading, setIsLoading] = useState(true);
  const [glossaryData, setGlossaryData] = useState<Glossary>();
  const [users, setUsers] = useState<Array<FormatedUsersData>>([]);
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

  const getUserObject = async (reviewers: string[]) => {
    setIsLoading(true);
    const promiseArr = reviewers.map((reviewer) => getUserByName(reviewer));

    await Promise.allSettled(promiseArr).then(
      (res: PromiseSettledResult<AxiosResponse>[]) => {
        if (res.length) {
          const usersObj = res.map((r) => {
            if (r.status === 'fulfilled') {
              return { ...r.value.data, type: 'user' };
            }
          });

          setUsers(usersObj);
        }
        setIsLoading(false);
      }
    );
  };

  const fetchGlossaryData = () => {
    getGlossariesByName(glossaryName, ['tags', 'owner'])
      .then((res: AxiosResponse) => {
        setGlossaryData(res.data);
        if (res.data.reviewers.length) {
          getUserObject(res.data.reviewers);
        }
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
    getGlossaryTermsByFQN(name, [
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
          users={users}
          onCancel={handleCancel}
          onSave={onSave}
        />
      )}
    </PageContainerV1>
  );
};

export default AddGlossaryTermPage;
