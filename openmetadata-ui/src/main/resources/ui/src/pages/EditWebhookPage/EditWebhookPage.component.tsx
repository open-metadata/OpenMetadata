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
import React, { FunctionComponent, useEffect, useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import {
  deleteWebhook,
  getWebhookByName,
  updateWebhook,
} from '../../axiosAPIs/webhookAPI';
import AddWebhook from '../../components/AddWebhook/AddWebhook';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import Loader from '../../components/Loader/Loader';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../components/PermissionProvider/PermissionProvider.interface';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import { FormSubmitType } from '../../enums/form.enum';
import { CreateWebhook } from '../../generated/api/events/createWebhook';
import { Webhook, WebhookType } from '../../generated/entity/events/webhook';
import { Operation } from '../../generated/entity/policies/policy';
import jsonData from '../../jsons/en';
import { checkPermission } from '../../utils/PermissionsUtils';
import { getSettingPath } from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

const EDIT_HEADER_WEBHOOKS_TITLE: { [key: string]: string } = {
  msteams: 'MS Teams',
  slack: 'Edit Slack',
  generic: 'Edit Webhook',
};

const EditWebhookPage: FunctionComponent = () => {
  const { webhookName } = useParams<{ [key: string]: string }>();
  const history = useHistory();
  const { permissions } = usePermissionProvider();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [webhookData, setWebhookData] = useState<Webhook>();
  const [status, setStatus] = useState<LoadingState>('initial');
  const [deleteStatus, setDeleteStatus] = useState<LoadingState>('initial');

  const createPermission = useMemo(
    () =>
      checkPermission(Operation.Create, ResourceEntity.WEBHOOK, permissions),
    [permissions]
  );

  const editPermission = useMemo(
    () =>
      checkPermission(Operation.EditAll, ResourceEntity.WEBHOOK, permissions),
    [permissions]
  );

  const fetchWebhook = () => {
    setIsLoading(true);
    getWebhookByName(webhookName)
      .then((res) => {
        if (res) {
          setWebhookData(res);
        } else {
          throw jsonData['api-error-messages']['unexpected-error'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(err, jsonData['api-error-messages']['unexpected-error']);
      })
      .finally(() => setIsLoading(false));
  };

  const goToWebhooks = () => {
    let type = GlobalSettingOptions.WEBHOOK;
    switch (webhookData?.webhookType) {
      case WebhookType.Msteams:
        type = GlobalSettingOptions.MSTEAMS;

        break;
      case WebhookType.Slack:
        type = GlobalSettingOptions.SLACK;

        break;

      default:
        break;
    }

    history.push(
      `${getSettingPath(GlobalSettingsMenuCategory.INTEGRATIONS, type)}`
    );
  };

  const handleCancel = () => {
    goToWebhooks();
  };

  const handleSave = (data: CreateWebhook) => {
    setStatus('waiting');
    const { name, secretKey } = webhookData || data;
    updateWebhook({ ...data, name, secretKey })
      .then((res) => {
        if (res) {
          setStatus('success');
          setTimeout(() => {
            setStatus('initial');
            goToWebhooks();
          }, 500);
          showSuccessToast(
            jsonData['api-success-messages']['update-webhook-success']
          );
        } else {
          throw jsonData['api-error-messages']['unexpected-error'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(err, jsonData['api-error-messages']['unexpected-error']);
        setStatus('initial');
      });
  };

  const handleDelete = (id: string) => {
    setDeleteStatus('waiting');
    deleteWebhook(id)
      .then((res) => {
        if (res) {
          setDeleteStatus('initial');
          goToWebhooks();
        } else {
          throw jsonData['api-error-messages']['unexpected-error'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(err, jsonData['api-error-messages']['unexpected-error']);
        setDeleteStatus('initial');
      });
  };

  useEffect(() => {
    fetchWebhook();
  }, []);

  return (
    <PageContainerV1>
      <div className="self-center">
        {!isLoading ? (
          <AddWebhook
            allowAccess={createPermission || editPermission}
            data={webhookData}
            deleteState={deleteStatus}
            header={
              EDIT_HEADER_WEBHOOKS_TITLE[webhookData?.webhookType || 'generic']
            }
            mode={FormSubmitType.EDIT}
            saveState={status}
            webhookType={webhookData?.webhookType}
            onCancel={handleCancel}
            onDelete={handleDelete}
            onSave={handleSave}
          />
        ) : (
          <Loader />
        )}
      </div>
    </PageContainerV1>
  );
};

export default EditWebhookPage;
