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

import { AxiosError } from 'axios';
import { LoadingState } from 'Models';
import React, { FunctionComponent, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import { addWebhook } from '../../axiosAPIs/webhookAPI';
import AddWebhook from '../../components/AddWebhook/AddWebhook';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import { ROUTES } from '../../constants/constants';
import { FormSubmitType } from '../../enums/form.enum';
import { CreateWebhook } from '../../generated/api/events/createWebhook';
import { useAuth } from '../../hooks/authHooks';
import useToastContext from '../../hooks/useToastContext';

const AddWebhookPage: FunctionComponent = () => {
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const history = useHistory();
  const showToast = useToastContext();
  const [status, setStatus] = useState<LoadingState>('initial');

  const goToWebhooks = () => {
    history.push(ROUTES.WEBHOOKS);
  };

  const handleCancel = () => {
    goToWebhooks();
  };

  const handleSave = (data: CreateWebhook) => {
    setStatus('waiting');
    addWebhook(data)
      .then(() => {
        setStatus('success');
        setTimeout(() => {
          setStatus('initial');
          goToWebhooks();
        }, 500);
      })
      .catch((err: AxiosError) => {
        showToast({
          variant: 'error',
          body: err.response?.data?.message || 'Something went wrong!',
        });
        setStatus('initial');
      });
  };

  return (
    <PageContainerV1>
      <AddWebhook
        allowAccess={isAdminUser || isAuthDisabled}
        header="Add Webhook"
        mode={FormSubmitType.ADD}
        saveState={status}
        onCancel={handleCancel}
        onSave={handleSave}
      />
    </PageContainerV1>
  );
};

export default AddWebhookPage;
