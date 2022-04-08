import { AxiosError } from 'axios';
import { LoadingState } from 'Models';
import React, { FunctionComponent, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import { addGlossaries } from '../../axiosAPIs/glossaryAPI';
import AddGlossary from '../../components/AddGlossary/AddGlossary.component';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import { getGlossaryPath } from '../../constants/constants';
import { CreateGlossary } from '../../generated/api/data/createGlossary';
import { useAuth } from '../../hooks/authHooks';
import useToastContext from '../../hooks/useToastContext';
import jsonData from '../../jsons/en';
import { getTagCategories, getTaglist } from '../../utils/TagsUtils';

const AddGlossaryPage: FunctionComponent = () => {
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const history = useHistory();
  const showToast = useToastContext();
  const [tagList, setTagList] = useState<Array<string>>([]);
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<LoadingState>('initial');

  const goToGlossary = (name = '') => {
    history.push(getGlossaryPath(name));
  };

  const handleCancel = () => {
    goToGlossary();
  };

  const handleShowErrorToast = (errMessage: string) => {
    showToast({
      variant: 'error',
      body: errMessage,
    });
  };

  const handleSaveFailure = (errorMessage = '') => {
    handleShowErrorToast(
      errorMessage || jsonData['api-error-messages']['add-glossary-error']
    );
    setStatus('initial');
  };

  const onSave = (data: CreateGlossary) => {
    setStatus('waiting');
    addGlossaries(data)
      .then((res) => {
        if (res.data) {
          setStatus('success');
          setTimeout(() => {
            setStatus('initial');
            goToGlossary(res.data.name);
          }, 500);
        } else {
          handleSaveFailure();
        }
      })
      .catch((err: AxiosError) => {
        handleSaveFailure(err.response?.data?.message);
      });
  };

  const fetchTags = () => {
    setIsTagLoading(true);
    getTagCategories()
      .then((res) => {
        if (res.data) {
          setTagList(getTaglist(res.data));
        } else {
          handleShowErrorToast(
            jsonData['api-error-messages']['fetch-tags-error']
          );
        }
      })
      .catch((err: AxiosError) => {
        handleShowErrorToast(
          err.response?.data?.message ||
            jsonData['api-error-messages']['fetch-tags-error']
        );
      })
      .finally(() => {
        setIsTagLoading(false);
      });
  };

  return (
    <PageContainerV1>
      <AddGlossary
        allowAccess={isAdminUser || isAuthDisabled}
        fetchTags={fetchTags}
        header="Add Glossary"
        isTagLoading={isTagLoading}
        saveState={status}
        tagList={tagList}
        onCancel={handleCancel}
        onSave={onSave}
      />
    </PageContainerV1>
  );
};

export default AddGlossaryPage;
