import { AxiosError } from 'axios';
import { LoadingState } from 'Models';
import React, { FunctionComponent, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { addGlossaries } from '../../axiosAPIs/glossaryAPI';
import AddGlossary from '../../components/AddGlossary/AddGlossary.component';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import { ROUTES } from '../../constants/constants';
import { CreateGlossary } from '../../generated/api/data/createGlossary';
import { useAuth } from '../../hooks/authHooks';
import useToastContext from '../../hooks/useToastContext';
import { getTagCategories, getTaglist } from '../../utils/TagsUtils';

const AddGlossaryPage: FunctionComponent = () => {
  const { isAuthDisabled, isAdminUser } = useAuth();
  const history = useHistory();
  const showToast = useToastContext();
  const [tagList, setTagList] = useState<Array<string>>([]);
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<LoadingState>('initial');

  const goToGlossary = () => {
    history.push(ROUTES.GLOSSARY);
  };

  const handleCancel = () => {
    goToGlossary();
  };

  const onSave = (data: CreateGlossary) => {
    setStatus('waiting');
    addGlossaries(data)
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

  const fetchTags = () => {
    setIsTagLoading(true);
    getTagCategories()
      .then((res) => {
        setTagList(getTaglist(res.data));
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
