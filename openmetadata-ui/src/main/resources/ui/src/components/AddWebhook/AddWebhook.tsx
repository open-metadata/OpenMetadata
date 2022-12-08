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

import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Tooltip } from 'antd';
import classNames from 'classnames';
import cryptoRandomString from 'crypto-random-string-with-promisify-polyfill';
import { t } from 'i18next';
import { cloneDeep, isEmpty, isNil, toLower, trim } from 'lodash';
import { EditorContentRef } from 'Models';
import React, {
  FunctionComponent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants/constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import { UrlEntityCharRegEx } from '../../constants/regex.constants';
import { LOADING_STATE } from '../../enums/common.enum';
import { FormSubmitType } from '../../enums/form.enum';
import { PageLayoutType } from '../../enums/layout.enum';
import {
  CreateWebhook,
  EventFilter,
} from '../../generated/api/events/createWebhook';
import { WebhookType } from '../../generated/entity/events/webhook';
import { Operation } from '../../generated/entity/policies/policy';
import {
  errorMsg,
  getSeparator,
  isValidUrl,
  requiredField,
} from '../../utils/CommonUtils';
import { checkPermission } from '../../utils/PermissionsUtils';
import { getSettingPath } from '../../utils/RouterUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { Button } from '../buttons/Button/Button';
import CopyToClipboardButton from '../buttons/CopyToClipboardButton/CopyToClipboardButton';
import CardV1 from '../common/Card/CardV1';
import RichTextEditor from '../common/rich-text-editor/RichTextEditor';
import TitleBreadcrumb from '../common/title-breadcrumb/title-breadcrumb.component';
import PageLayout from '../containers/PageLayout';
import Loader from '../Loader/Loader';
import ConfirmationModal from '../Modals/ConfirmationModal/ConfirmationModal';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../PermissionProvider/PermissionProvider.interface';
import { AddWebhookProps } from './AddWebhook.interface';
import EventFilterTree from './EventFilterTree.component';

const CONFIGURE_TEXT: { [key: string]: { body: string; heading: string } } = {
  msteams: {
    body: t('message.configure-webhook-name-message', {
      webhookType: t('label.ms-teams'),
    }),
    heading: t('label.configure-webhook-type', {
      webhookType: t('label.ms-team'),
    }),
  },
  slack: {
    body: t('message.configure-webhook-name-message', {
      webhookType: t('label.slack'),
    }),
    heading: t('label.configure-webhook-type', {
      webhookType: t('label.slack'),
    }),
  },
  generic: {
    body: t('message.configure-webhook-message'),
    heading: t('label.configure-webhook-type', {
      webhookType: '',
    }),
  },
};

const Field = ({ children }: { children: React.ReactNode }) => {
  return <div className="tw-mt-4">{children}</div>;
};

const AddWebhook: FunctionComponent<AddWebhookProps> = ({
  data,
  header,
  mode = FormSubmitType.ADD,
  saveState = LOADING_STATE.INITIAL,
  deleteState = LOADING_STATE.INITIAL,
  allowAccess = true,
  webhookType = WebhookType.Generic,
  onCancel,
  onDelete,
  onSave,
}: AddWebhookProps) => {
  const markdownRef = useRef<EditorContentRef>();
  const [eventFilterFormData, setEventFilterFormData] = useState<
    EventFilter[] | undefined
  >(data?.eventFilters);
  const [name, setName] = useState<string>(data?.name || '');
  const [endpointUrl, setEndpointUrl] = useState<string>(data?.endpoint || '');
  const [description] = useState<string>(data?.description || '');
  const [active, setActive] = useState<boolean>(
    !isNil(data?.enabled) ? Boolean(data?.enabled) : true
  );
  const [showAdv, setShowAdv] = useState<boolean>(false);

  const [secretKey, setSecretKey] = useState<string>(data?.secretKey || '');
  const [batchSize, setBatchSize] = useState<number | undefined>(
    data?.batchSize
  );
  const [connectionTimeout, setConnectionTimeout] = useState<
    number | undefined
  >(data?.timeout);
  const [showErrorMsg, setShowErrorMsg] = useState<{ [key: string]: boolean }>({
    name: false,
    endpointUrl: false,
    eventFilters: false,
    invalidName: false,
    invalidEndpointUrl: false,
    invalidEventFilters: false,
  });
  const [generatingSecret, setGeneratingSecret] = useState<boolean>(false);
  const [isDelete, setIsDelete] = useState<boolean>(false);

  const { permissions } = usePermissionProvider();
  const { t } = useTranslation();
  const editWebhookPermission = useMemo(
    () =>
      !isEmpty(permissions) &&
      checkPermission(Operation.EditAll, ResourceEntity.WEBHOOK, permissions),
    [permissions]
  );

  const addWebhookPermission = useMemo(
    () =>
      !isEmpty(permissions) &&
      checkPermission(Operation.Create, ResourceEntity.WEBHOOK, permissions),
    [permissions]
  );

  const deleteWebhookPermission = useMemo(
    () =>
      !isEmpty(permissions) &&
      checkPermission(Operation.Delete, ResourceEntity.WEBHOOK, permissions),
    [permissions]
  );

  const handleDelete = () => {
    if (data) {
      onDelete && onDelete(data.id);
    }
    setIsDelete(false);
  };

  const handleValidation = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    if (!allowAccess) {
      return;
    }
    const value = event.target.value;
    const eleName = event.target.name;
    let { name, endpointUrl, invalidEndpointUrl, invalidName } =
      cloneDeep(showErrorMsg);

    switch (eleName) {
      case 'name': {
        setName(value);
        name = false;
        invalidName = false;

        break;
      }
      case 'endpoint-url': {
        setEndpointUrl(value);
        endpointUrl = false;
        invalidEndpointUrl = false;

        break;
      }
      case 'batch-size': {
        setBatchSize(value as unknown as number);

        break;
      }
      case 'connection-timeout': {
        setConnectionTimeout(value as unknown as number);

        break;
      }
    }
    setShowErrorMsg((prev) => {
      return { ...prev, name, endpointUrl, invalidEndpointUrl, invalidName };
    });
  };

  const generateSecret = () => {
    if (!allowAccess) {
      return;
    }
    const apiKey = cryptoRandomString({ length: 50, type: 'alphanumeric' });
    setGeneratingSecret(true);
    setTimeout(() => {
      setSecretKey(apiKey);
      setGeneratingSecret(false);
    }, 500);
  };

  const resetSecret = () => {
    setSecretKey('');
  };

  const validateForm = () => {
    const errMsg = {
      name: !name.trim(),
      endpointUrl: !endpointUrl.trim(),
      invalidName: UrlEntityCharRegEx.test(name.trim()),
      invalidEndpointUrl: !isValidUrl(endpointUrl.trim()),
    };
    setShowErrorMsg(errMsg);

    return !Object.values(errMsg).includes(true);
  };

  const handleSave = () => {
    if (validateForm()) {
      const oData: CreateWebhook = {
        name: trim(name),
        description: markdownRef.current?.getEditorContent() || undefined,
        endpoint: endpointUrl,
        eventFilters: eventFilterFormData ?? ([] as EventFilter[]),
        batchSize,
        timeout: connectionTimeout,
        enabled: active,
        secretKey,
        webhookType,
      };

      onSave(oData);
    }
  };

  const getDeleteButton = () => {
    return (
      <>
        {deleteState === LOADING_STATE.WAITING ? (
          <Button
            disabled
            className="tw-w-16 tw-h-10 disabled:tw-opacity-100"
            size="regular"
            theme="primary"
            variant="text">
            <Loader size="small" type="default" />
          </Button>
        ) : (
          <Tooltip
            placement="left"
            title={
              deleteWebhookPermission
                ? t('label.delete')
                : t('label.no-permission-for-action')
            }>
            <Button
              data-testid="delete-webhook"
              disabled={!deleteWebhookPermission}
              size="regular"
              theme="primary"
              variant="text"
              onClick={() => setIsDelete(true)}>
              {t('label.delete')}
            </Button>
          </Tooltip>
        )}
      </>
    );
  };

  const getSaveButton = () => {
    const savePermission = addWebhookPermission || editWebhookPermission;

    return (
      <>
        {saveState === LOADING_STATE.WAITING ? (
          <Button
            disabled
            className="tw-w-16 tw-h-10 disabled:tw-opacity-100"
            size="regular"
            theme="primary"
            variant="contained">
            <Loader size="small" type="white" />
          </Button>
        ) : saveState === LOADING_STATE.SUCCESS ? (
          <Button
            disabled
            className="tw-w-16 tw-h-10 disabled:tw-opacity-100"
            size="regular"
            theme="primary"
            variant="contained">
            <FontAwesomeIcon icon="check" />
          </Button>
        ) : (
          <Tooltip
            placement="left"
            title={
              savePermission
                ? t('label.save')
                : t('label.no-permission-for-action')
            }>
            <Button
              className={classNames('tw-w-16 tw-h-10')}
              data-testid="save-webhook"
              disabled={!savePermission}
              size="regular"
              theme="primary"
              variant="contained"
              onClick={handleSave}>
              {t('label.save')}
            </Button>
          </Tooltip>
        )}
      </>
    );
  };

  const fetchRightPanel = useCallback(() => {
    return (
      <div className="tw-px-2">
        <CardV1 heading={CONFIGURE_TEXT[webhookType].heading} id="webhook">
          {CONFIGURE_TEXT[webhookType].body}
        </CardV1>
      </div>
    );
  }, [webhookType]);

  return (
    <div className="add-webhook-container">
      <PageLayout
        classes="tw-max-w-full-hd tw-h-full tw-pt-4"
        header={
          <TitleBreadcrumb
            titleLinks={[
              {
                name: t('label.settings'),
                url: ROUTES.SETTINGS,
              },
              {
                name:
                  webhookType === WebhookType.Slack
                    ? t('label.slack')
                    : t('label.webhook'),
                url: getSettingPath(
                  GlobalSettingsMenuCategory.INTEGRATIONS,
                  webhookType === WebhookType.Slack
                    ? GlobalSettingOptions.SLACK
                    : GlobalSettingOptions.WEBHOOK
                ),
              },
              {
                name: header,
                url: '',
                activeTitle: true,
              },
            ]}
          />
        }
        layout={PageLayoutType['2ColRTL']}
        rightPanel={fetchRightPanel()}>
        <div className="tw-form-container tw-p">
          <h6 className="tw-heading tw-text-base" data-testid="header">
            {header}
          </h6>
          <div className="tw-pb-3" data-testid="formContainer">
            <Field>
              <label className="tw-block tw-form-label" htmlFor="name">
                {requiredField('Name:')}
              </label>
              {!data?.name ? (
                <input
                  className="tw-form-inputs tw-form-inputs-padding"
                  data-testid="name"
                  id="name"
                  name="name"
                  placeholder={toLower(t('label.name'))}
                  type="text"
                  value={name}
                  onChange={handleValidation}
                />
              ) : (
                <input
                  disabled
                  className="tw-form-inputs tw-form-inputs-padding tw-cursor-not-allowed"
                  id="name"
                  name={toLower(t('label.name'))}
                  value={name}
                />
              )}
              {showErrorMsg.name
                ? errorMsg(
                    t('message.field-text-is-required', {
                      fieldText: 'Webhook name',
                    })
                  )
                : showErrorMsg.invalidName
                ? errorMsg(
                    t('message.field-text-is-invalid', {
                      fieldText: 'Webhook name',
                    })
                  )
                : null}
            </Field>
            <Field>
              <label
                className="tw-block tw-form-label tw-mb-0"
                htmlFor="description">
                {t('label.description')}:
              </label>
              <RichTextEditor
                data-testid="description"
                initialValue={description}
                readonly={!allowAccess}
                ref={markdownRef}
              />
            </Field>
            <Field>
              <label className="tw-block tw-form-label" htmlFor="endpoint-url">
                {requiredField(`${t('label.endpoint-url')}:`)}
              </label>
              <input
                className="tw-form-inputs tw-form-inputs-padding"
                data-testid="endpoint-url"
                disabled={!allowAccess}
                id="endpoint-url"
                name="endpoint-url"
                placeholder="http(s)://www.example.com"
                type="text"
                value={endpointUrl}
                onChange={handleValidation}
              />
              {showErrorMsg.endpointUrl
                ? errorMsg(
                    t('message.field-text-is-required', {
                      fieldText: 'Webhook endpoint',
                    })
                  )
                : showErrorMsg.invalidEndpointUrl
                ? errorMsg(
                    t('message.field-text-is-invalid', {
                      fieldText: 'Webhook endpoint',
                    })
                  )
                : null}
            </Field>
            <Field>
              <div className="tw-flex tw-pt-1">
                <label>{t('label.active')}</label>
                <div
                  className={classNames('toggle-switch', { open: active })}
                  data-testid="active"
                  onClick={() => {
                    allowAccess && setActive((prev) => !prev);
                  }}>
                  <div className="switch" />
                </div>
              </div>
            </Field>
            {getSeparator(
              <span className="tw-text-base tw-px-0.5">
                {requiredField(t('label.event-filters'), true)}
              </span>,
              'tw-mt-3'
            )}
            <EventFilterTree
              value={eventFilterFormData || []}
              onChange={setEventFilterFormData}
            />
            <Field>
              <div className="tw-flex tw-justify-end tw-pt-1">
                <Button
                  data-testid="show-advanced"
                  size="regular"
                  theme="primary"
                  variant="text"
                  onClick={() => setShowAdv((prev) => !prev)}>
                  {showAdv
                    ? t('label.show-or-hide-advanced-config', {
                        showAdv: 'Hide',
                      })
                    : t('label.show-or-hide-advanced-config', {
                        showAdv: 'Show',
                      })}
                </Button>
              </div>
            </Field>

            {showAdv ? (
              <>
                {getSeparator(
                  <span className="tw-text-base tw-px-0.5">
                    {t('label.advanced-config')}
                  </span>,
                  'tw-mt-3'
                )}
                <Field>
                  <div className="tw-flex tw-gap-4 tw-w-full">
                    <div className="tw-flex-1">
                      <label
                        className="tw-block tw-form-label"
                        htmlFor="batch-size">
                        {t('label.batch-size')}:
                      </label>
                      <input
                        className="tw-form-inputs tw-form-inputs-padding"
                        data-testid="batch-size"
                        disabled={!allowAccess}
                        id="batch-size"
                        name="batch-size"
                        placeholder="10"
                        type="number"
                        value={batchSize}
                        onChange={handleValidation}
                      />
                    </div>
                    <div className="tw-flex-1">
                      <label
                        className="tw-block tw-form-label"
                        htmlFor="connection-timeout">
                        {t('message.field-timeout-description')} (s):
                      </label>
                      <input
                        className="tw-form-inputs tw-form-inputs-padding"
                        data-testid="connection-timeout"
                        disabled={!allowAccess}
                        id="connection-timeout"
                        name="connection-timeout"
                        placeholder="10"
                        type="number"
                        value={connectionTimeout}
                        onChange={handleValidation}
                      />
                    </div>
                  </div>
                </Field>
                <Field>
                  {allowAccess ? (
                    !data ? (
                      <>
                        <label
                          className="tw-block tw-form-label tw-my-0"
                          htmlFor="secret-key">
                          {t('label.secret-key')}:
                        </label>
                        <div className="tw-flex tw-items-center">
                          <input
                            readOnly
                            className="tw-form-inputs tw-form-inputs-padding"
                            data-testid="secret-key"
                            id="secret-key"
                            name="secret-key"
                            placeholder={toLower(t('label.secret-key'))}
                            type="text"
                            value={secretKey}
                          />
                          <Button
                            className="tw-w-8 tw-h-8 tw--ml-8 tw-rounded-md"
                            data-testid="generate-secret"
                            size="custom"
                            theme="default"
                            variant="text"
                            onClick={generateSecret}>
                            {generatingSecret ? (
                              <Loader size="small" type="default" />
                            ) : (
                              <SVGIcons
                                alt="generate"
                                icon={Icons.SYNC}
                                width="16"
                              />
                            )}
                          </Button>
                          {secretKey ? (
                            <>
                              <CopyToClipboardButton copyText={secretKey} />
                              <Button
                                className="tw-h-8 tw-ml-4"
                                data-testid="clear-secret"
                                size="custom"
                                theme="default"
                                variant="text"
                                onClick={resetSecret}>
                                <SVGIcons
                                  alt="Delete"
                                  icon={Icons.DELETE}
                                  width="16px"
                                />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </>
                    ) : data.secretKey ? (
                      <div className="tw-flex tw-items-center">
                        <input
                          readOnly
                          className="tw-form-inputs tw-form-inputs-padding"
                          data-testid="secret-key"
                          id="secret-key"
                          name="secret-key"
                          placeholder="secret key"
                          type="text"
                          value={secretKey}
                        />
                        <CopyToClipboardButton copyText={secretKey} />
                      </div>
                    ) : null
                  ) : null}
                </Field>
              </>
            ) : null}
            <Field>
              {data && mode === 'edit' ? (
                <div className="tw-flex tw-justify-between">
                  <Button
                    data-testid="cancel-webhook"
                    size="regular"
                    theme="primary"
                    variant="outlined"
                    onClick={onCancel}>
                    <FontAwesomeIcon
                      className="tw-text-sm tw-align-middle tw-pr-1.5"
                      icon={faArrowLeft}
                    />{' '}
                    <span>{t('label.back')}</span>
                  </Button>
                  <div className="tw-flex tw-justify-end">
                    {getDeleteButton()}
                    {getSaveButton()}
                  </div>
                </div>
              ) : (
                <div className="tw-flex tw-justify-end">
                  <Button
                    data-testid="cancel-webhook"
                    size="regular"
                    theme="primary"
                    variant="text"
                    onClick={onCancel}>
                    {t('label.cancel')}
                  </Button>
                  {getSaveButton()}
                </div>
              )}
            </Field>
            <ConfirmationModal
              bodyText={t('message.delete-webhook-permanently', {
                webhookName: data ? data.name : '',
              })}
              cancelText={t('label.cancel')}
              confirmText={t('label.delete')}
              header={t('label.are-you-sure')}
              visible={isDelete && deleteWebhookPermission}
              onCancel={() => setIsDelete(false)}
              onConfirm={handleDelete}
            />
          </div>
        </div>
      </PageLayout>
    </div>
  );
};

export default AddWebhook;
