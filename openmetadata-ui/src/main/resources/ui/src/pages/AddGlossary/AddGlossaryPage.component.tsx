import { AxiosError } from 'axios';
import { LoadingState } from 'Models';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import { addGlossaries } from '../../axiosAPIs/glossaryAPI';
import AddGlossary from '../../components/AddGlossary/AddGlossary.component';
import { TitleBreadcrumbProps } from '../../components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import { CreateGlossary } from '../../generated/api/data/createGlossary';
import { useAuth } from '../../hooks/authHooks';
import jsonData from '../../jsons/en';
import { getGlossaryPath } from '../../utils/RouterUtils';
import { getTagCategories, getTaglist } from '../../utils/TagsUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const AddGlossaryPage: FunctionComponent = () => {
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const history = useHistory();
  const [tagList, setTagList] = useState<Array<string>>([]);
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<LoadingState>('initial');
  const [slashedBreadcrumb, setSlashedBreadcrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);

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
          handleSaveFailure(
            jsonData['api-error-messages']['add-glossary-error']
          );
        }
      })
      .catch((err: AxiosError) => {
        handleSaveFailure(
          err,
          jsonData['api-error-messages']['add-glossary-error']
        );
      });
  };

  const fetchTags = () => {
    setIsTagLoading(true);
    getTagCategories()
      .then((res) => {
        if (res.data) {
          setTagList(getTaglist(res.data));
        } else {
          showErrorToast(jsonData['api-error-messages']['fetch-tags-error']);
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(err, jsonData['api-error-messages']['fetch-tags-error']);
      })
      .finally(() => {
        setIsTagLoading(false);
      });
  };

  useEffect(() => {
    setSlashedBreadcrumb([
      {
        name: 'Glossary',
        url: getGlossaryPath(),
      },
      {
        name: 'Add Glossary',
        url: '',
        activeTitle: true,
      },
    ]);
  }, []);

  return (
    <PageContainerV1>
      <AddGlossary
        allowAccess={isAdminUser || isAuthDisabled}
        fetchTags={fetchTags}
        header="Add Glossary"
        isTagLoading={isTagLoading}
        saveState={status}
        slashedBreadcrumb={slashedBreadcrumb}
        tagList={tagList}
        onCancel={handleCancel}
        onSave={onSave}
      />
    </PageContainerV1>
  );
};

export default AddGlossaryPage;
