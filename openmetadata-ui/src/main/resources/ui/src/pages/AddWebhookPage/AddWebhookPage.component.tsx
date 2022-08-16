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
import { useHistory, useParams } from 'react-router-dom';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import { addWebhook } from '../../axiosAPIs/webhookAPI';
import AddWebhook from '../../components/AddWebhook/AddWebhook';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/globalSettings.constants';
import { FormSubmitType } from '../../enums/form.enum';
import {
  CreateWebhook,
  WebhookType,
} from '../../generated/api/events/createWebhook';
import { useAuth } from '../../hooks/authHooks';
import jsonData from '../../jsons/en';
import { getSettingPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const AddWebhookPage: FunctionComponent = () => {
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const history = useHistory();
  const params = useParams<{ webhookType?: WebhookType }>();

  const webhookType: WebhookType = params.webhookType ?? WebhookType.Generic;
  const [status, setStatus] = useState<LoadingState>('initial');

  const goToWebhooks = () => {
    if (webhookType === WebhookType.Slack) {
      history.push(
        getSettingPath(
          GlobalSettingsMenuCategory.INTEGRATIONS,
          GlobalSettingOptions.SLACK
        )
      );
    } else {
      history.push(
        getSettingPath(
          GlobalSettingsMenuCategory.INTEGRATIONS,
          GlobalSettingOptions.WEBHOOK
        )
      );
    }
  };

  const handleCancel = () => {
    goToWebhooks();
  };

  const handleSave = (data: CreateWebhook) => {
    setStatus('waiting');
    addWebhook(data)
      .then((res) => {
        if (res) {
          setStatus('success');
          setTimeout(() => {
            setStatus('initial');
            goToWebhooks();
          }, 500);
        } else {
          throw jsonData['api-error-messages']['unexpected-error'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(err, jsonData['api-error-messages']['unexpected-error']);
        setStatus('initial');
      });
  };

  return (
    <PageContainerV1>
      <div className="tw-self-center">
        <AddWebhook
          allowAccess={isAdminUser || isAuthDisabled}
          header={`Add ${
            webhookType === WebhookType.Slack ? 'Slack' : ''
          }  Webhook`}
          mode={FormSubmitType.ADD}
          saveState={status}
          webhookType={webhookType}
          onCancel={handleCancel}
          onSave={handleSave}
        />
      </div>
    </PageContainerV1>
  );
};

export default AddWebhookPage;
