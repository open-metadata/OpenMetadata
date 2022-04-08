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

import { faArrowLeft, faSyncAlt } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import cryptoRandomString from 'crypto-random-string-with-promisify-polyfill';
import { cloneDeep, isEmpty, isNil, startCase } from 'lodash';
import { EditorContentRef } from 'Models';
import React, { FunctionComponent, useRef, useState } from 'react';
import { WILD_CARD_CHAR } from '../../constants/char.constants';
import { UrlEntityCharRegEx } from '../../constants/regex.constants';
import { EntityType } from '../../enums/entity.enum';
import { FormSubmitType } from '../../enums/form.enum';
import { PageLayoutType } from '../../enums/layout.enum';
import {
  CreateWebhook,
  EventFilter,
  EventType,
} from '../../generated/api/events/createWebhook';
import {
  errorMsg,
  getDocButton,
  getSeparator,
  isValidUrl,
  requiredField,
} from '../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { Button } from '../buttons/Button/Button';
import CopyToClipboardButton from '../buttons/CopyToClipboardButton/CopyToClipboardButton';
import RichTextEditor from '../common/rich-text-editor/RichTextEditor';
import PageLayout from '../containers/PageLayout';
import DropDown from '../dropdown/DropDown';
import Loader from '../Loader/Loader';
import ConfirmationModal from '../Modals/ConfirmationModal/ConfirmationModal';
import { AddWebhookProps } from './AddWebhook.interface';

const Field = ({ children }: { children: React.ReactNode }) => {
  return <div className="tw-mt-4">{children}</div>;
};

const getEntitiesList = () => {
  const retVal: Array<{ name: string; value: string }> = [
    EntityType.TABLE,
    EntityType.TOPIC,
    EntityType.DASHBOARD,
    EntityType.PIPELINE,
  ].map((item) => {
    return {
      name: startCase(item),
      value: item,
    };
  });
  retVal.unshift({ name: 'All entities', value: WILD_CARD_CHAR });

  return retVal;
};

const getHiddenEntitiesList = (entities: Array<string> = []) => {
  if (entities.includes(WILD_CARD_CHAR)) {
    return entities.filter((item) => item !== WILD_CARD_CHAR);
  } else {
    return undefined;
  }
};

const getSelectedEvents = (prev: EventFilter, value: string) => {
  let entities = prev.entities || [];
  if (entities.includes(value)) {
    if (value === WILD_CARD_CHAR) {
      entities = [];
    } else {
      if (entities.includes(WILD_CARD_CHAR)) {
        const allIndex = entities.indexOf(WILD_CARD_CHAR);
        entities.splice(allIndex, 1);
      }
      const index = entities.indexOf(value);
      entities.splice(index, 1);
    }
  } else {
    if (value === WILD_CARD_CHAR) {
      entities = getEntitiesList().map((item) => item.value);
    } else {
      entities.push(value);
    }
  }

  return { ...prev, entities };
};

const getEventFilterByType = (
  filters: Array<EventFilter>,
  type: EventType
): EventFilter => {
  let eventFilter =
    filters.find((item) => item.eventType === type) || ({} as EventFilter);
  if (eventFilter.entities?.includes(WILD_CARD_CHAR)) {
    eventFilter = getSelectedEvents(
      { ...eventFilter, entities: [] },
      WILD_CARD_CHAR
    );
  }

  return eventFilter;
};

const AddWebhook: FunctionComponent<AddWebhookProps> = ({
  data,
  header,
  mode = FormSubmitType.ADD,
  saveState = 'initial',
  deleteState = 'initial',
  allowAccess = true,
  onCancel,
  onDelete,
  onSave,
}: AddWebhookProps) => {
  const markdownRef = useRef<EditorContentRef>();
  const [name, setName] = useState<string>(data?.name || '');
  const [endpointUrl, setEndpointUrl] = useState<string>(data?.endpoint || '');
  const [description] = useState<string>(data?.description || '');
  const [active, setActive] = useState<boolean>(
    !isNil(data?.enabled) ? Boolean(data?.enabled) : true
  );
  const [showAdv, setShowAdv] = useState<boolean>(false);
  const [createEvents, setCreateEvents] = useState<EventFilter>(
    data
      ? getEventFilterByType(data.eventFilters, EventType.EntityCreated)
      : ({} as EventFilter)
  );
  const [updateEvents, setUpdateEvents] = useState<EventFilter>(
    data
      ? getEventFilterByType(data.eventFilters, EventType.EntityUpdated)
      : ({} as EventFilter)
  );
  const [deleteEvents, setDeleteEvents] = useState<EventFilter>(
    data
      ? getEventFilterByType(data.eventFilters, EventType.EntityDeleted)
      : ({} as EventFilter)
  );
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

  const toggleEventFilters = (type: EventType, value: boolean) => {
    if (!allowAccess) {
      return;
    }
    let setter;
    switch (type) {
      case EventType.EntityCreated: {
        setter = setCreateEvents;

        break;
      }
      case EventType.EntityUpdated: {
        setter = setUpdateEvents;

        break;
      }
      case EventType.EntityDeleted: {
        setter = setDeleteEvents;

        break;
      }
    }
    if (setter) {
      setter(
        value
          ? {
              eventType: type,
            }
          : ({} as EventFilter)
      );
      setShowErrorMsg((prev) => {
        return { ...prev, eventFilters: false, invalidEventFilters: false };
      });
    }
  };

  const handleEntitySelection = (type: EventType, value: string) => {
    let setter;
    switch (type) {
      case EventType.EntityCreated: {
        setter = setCreateEvents;

        break;
      }
      case EventType.EntityUpdated: {
        setter = setUpdateEvents;

        break;
      }
      case EventType.EntityDeleted: {
        setter = setDeleteEvents;

        break;
      }
    }
    if (setter) {
      setter((prev) => getSelectedEvents(prev, value));
      setShowErrorMsg((prev) => {
        return { ...prev, eventFilters: false, invalidEventFilters: false };
      });
    }
  };

  const getEventFiltersData = () => {
    const eventFilters: Array<EventFilter> = [];
    if (!isEmpty(createEvents)) {
      const event = createEvents.entities?.includes(WILD_CARD_CHAR)
        ? { ...createEvents, entities: [WILD_CARD_CHAR] }
        : createEvents;
      eventFilters.push(event);
    }
    if (!isEmpty(updateEvents)) {
      const event = updateEvents.entities?.includes(WILD_CARD_CHAR)
        ? { ...updateEvents, entities: [WILD_CARD_CHAR] }
        : updateEvents;
      eventFilters.push(event);
    }
    if (!isEmpty(deleteEvents)) {
      const event = deleteEvents.entities?.includes(WILD_CARD_CHAR)
        ? { ...deleteEvents, entities: [WILD_CARD_CHAR] }
        : deleteEvents;
      eventFilters.push(event);
    }

    return eventFilters;
  };

  const validateEventFilters = () => {
    const isValid = [];
    if (!isEmpty(createEvents)) {
      isValid.push(Boolean(createEvents.entities?.length));
    }
    if (!isEmpty(updateEvents)) {
      isValid.push(Boolean(updateEvents.entities?.length));
    }
    if (!isEmpty(deleteEvents)) {
      isValid.push(Boolean(deleteEvents.entities?.length));
    }

    return (
      isValid.length > 0 &&
      isValid.reduce((prev, curr) => {
        return prev && curr;
      }, isValid[0])
    );
  };

  const validateForm = () => {
    const errMsg = {
      name: !name.trim(),
      endpointUrl: !endpointUrl.trim(),
      eventFilters: isEmpty({
        ...createEvents,
        ...updateEvents,
        ...deleteEvents,
      }),
      invalidName: UrlEntityCharRegEx.test(name.trim()),
      invalidEndpointUrl: !isValidUrl(endpointUrl.trim()),
      invalidEventFilters: !validateEventFilters(),
    };
    setShowErrorMsg(errMsg);

    return !Object.values(errMsg).includes(true);
  };

  const handleSave = () => {
    if (validateForm()) {
      const oData: CreateWebhook = {
        name,
        description: markdownRef.current?.getEditorContent() || undefined,
        endpoint: endpointUrl,
        eventFilters: getEventFiltersData(),
        batchSize,
        timeout: connectionTimeout,
        enabled: active,
        secretKey,
      };
      onSave(oData);
    }
  };

  const getDeleteButton = () => {
    return allowAccess ? (
      <>
        {deleteState === 'waiting' ? (
          <Button
            disabled
            className="tw-w-16 tw-h-10 disabled:tw-opacity-100"
            size="regular"
            theme="primary"
            variant="text">
            <Loader size="small" type="default" />
          </Button>
        ) : (
          <Button
            className={classNames({
              'tw-opacity-40': !allowAccess,
            })}
            data-testid="delete-webhook"
            size="regular"
            theme="primary"
            variant="text"
            onClick={() => setIsDelete(true)}>
            Delete
          </Button>
        )}
      </>
    ) : null;
  };

  const getSaveButton = () => {
    return allowAccess ? (
      <>
        {saveState === 'waiting' ? (
          <Button
            disabled
            className="tw-w-16 tw-h-10 disabled:tw-opacity-100"
            size="regular"
            theme="primary"
            variant="contained">
            <Loader size="small" type="white" />
          </Button>
        ) : saveState === 'success' ? (
          <Button
            disabled
            className="tw-w-16 tw-h-10 disabled:tw-opacity-100"
            size="regular"
            theme="primary"
            variant="contained">
            <FontAwesomeIcon icon="check" />
          </Button>
        ) : (
          <Button
            className={classNames('tw-w-16 tw-h-10', {
              'tw-opacity-40': !allowAccess,
            })}
            data-testid="save-webhook"
            size="regular"
            theme="primary"
            variant="contained"
            onClick={handleSave}>
            Save
          </Button>
        )}
      </>
    ) : null;
  };

  const fetchRightPanel = () => {
    return (
      <>
        <h6 className="tw-heading tw-text-base">Configure Webhooks</h6>
        <div className="tw-mb-5">
          OpenMetadata can be configured to automatically send out event
          notifications to registered webhooks. Enter the webhook name, and an
          Endpoint URL to receive the HTTP call back on. Use Event Filters to
          only receive notifications based on events of interest, like when an
          entity is created, updated, or deleted; and for the entities your
          application is interested in. Add a description to help people
          understand the purpose of the webhook and to keep track of the use
          case. Use advanced configuration to set up a shared secret key to
          verify the webhook events using HMAC signature.
        </div>
        {getDocButton('Read Webhook Doc', '', 'webhook-doc')}
      </>
    );
  };

  return (
    <PageLayout
      classes="tw-max-w-full-hd tw-bg-white tw-pt-4"
      layout={PageLayoutType['2ColRTL']}
      rightPanel={fetchRightPanel()}>
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
              className="tw-form-inputs tw-px-3 tw-py-1"
              data-testid="name"
              id="name"
              name="name"
              placeholder="name"
              type="text"
              value={name}
              onChange={handleValidation}
            />
          ) : (
            <input
              disabled
              className="tw-form-inputs tw-px-3 tw-py-1 tw-cursor-not-allowed"
              id="name"
              name="name"
              value={name}
            />
          )}
          {showErrorMsg.name
            ? errorMsg('Webhook name is required.')
            : showErrorMsg.invalidName
            ? errorMsg('Webhook name is invalid.')
            : null}
        </Field>
        <Field>
          <label
            className="tw-block tw-form-label tw-mb-0"
            htmlFor="description">
            Description:
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
            {requiredField('Endpoint URL:')}
          </label>
          <input
            className="tw-form-inputs tw-px-3 tw-py-1"
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
            ? errorMsg('Webhook endpoint is required.')
            : showErrorMsg.invalidEndpointUrl
            ? errorMsg('Webhook endpoint is invalid.')
            : null}
        </Field>
        <Field>
          <div className="tw-flex tw-pt-1">
            <label>Active</label>
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
            {requiredField('Event Filters', true)}
          </span>,
          'tw-mt-3'
        )}
        <Field>
          <div
            className="filter-group tw-justify-between tw-mb-3"
            data-testid="cb-entity-created">
            <div className="tw-flex">
              <input
                checked={!isEmpty(createEvents)}
                className="tw-mr-1 custom-checkbox"
                data-testid="entity-created-checkbox"
                disabled={!allowAccess}
                type="checkbox"
                onChange={(e) => {
                  toggleEventFilters(EventType.EntityCreated, e.target.checked);
                }}
              />
              <div
                className="tw-flex tw-items-center filters-title tw-truncate custom-checkbox-label"
                data-testid="checkbox-label">
                <div className="tw-ml-1">Trigger when entity is created</div>
              </div>
            </div>
          </div>
          <DropDown
            className="tw-bg-white"
            disabled={!allowAccess || isEmpty(createEvents)}
            dropDownList={getEntitiesList()}
            hiddenItems={getHiddenEntitiesList(createEvents.entities)}
            label="select entities"
            selectedItems={createEvents.entities}
            type="checkbox"
            onSelect={(_e, value) =>
              handleEntitySelection(EventType.EntityCreated, value as string)
            }
          />
        </Field>
        <Field>
          <div
            className="filter-group tw-justify-between tw-mb-3"
            data-testid="cb-entity-created">
            <div className="tw-flex">
              <input
                checked={!isEmpty(updateEvents)}
                className="tw-mr-1 custom-checkbox"
                data-testid="entity-updated-checkbox"
                disabled={!allowAccess}
                type="checkbox"
                onChange={(e) => {
                  toggleEventFilters(EventType.EntityUpdated, e.target.checked);
                }}
              />
              <div
                className="tw-flex tw-items-center filters-title tw-truncate custom-checkbox-label"
                data-testid="checkbox-label">
                <div className="tw-ml-1">Trigger when entity is updated</div>
              </div>
            </div>
          </div>
          <DropDown
            className="tw-bg-white"
            disabled={!allowAccess || isEmpty(updateEvents)}
            dropDownList={getEntitiesList()}
            hiddenItems={getHiddenEntitiesList(updateEvents.entities)}
            label="select entities"
            selectedItems={updateEvents.entities}
            type="checkbox"
            onSelect={(_e, value) =>
              handleEntitySelection(EventType.EntityUpdated, value as string)
            }
          />
        </Field>
        <Field>
          <div
            className="filter-group tw-justify-between tw-mb-3"
            data-testid="cb-entity-created">
            <div className="tw-flex">
              <input
                checked={!isEmpty(deleteEvents)}
                className="tw-mr-1 custom-checkbox"
                data-testid="entity-deleted-checkbox"
                disabled={!allowAccess}
                type="checkbox"
                onChange={(e) => {
                  toggleEventFilters(EventType.EntityDeleted, e.target.checked);
                }}
              />
              <div
                className="tw-flex tw-items-center filters-title tw-truncate custom-checkbox-label"
                data-testid="checkbox-label">
                <div className="tw-ml-1">Trigger when entity is deleted</div>
              </div>
            </div>
          </div>
          <DropDown
            className="tw-bg-white"
            disabled={!allowAccess || isEmpty(deleteEvents)}
            dropDownList={getEntitiesList()}
            hiddenItems={getHiddenEntitiesList(deleteEvents.entities)}
            label="select entities"
            selectedItems={deleteEvents.entities}
            type="checkbox"
            onSelect={(_e, value) =>
              handleEntitySelection(EventType.EntityDeleted, value as string)
            }
          />
          {showErrorMsg.eventFilters
            ? errorMsg('Webhook event filters are required.')
            : showErrorMsg.invalidEventFilters
            ? errorMsg('Webhook event filters are invalid.')
            : null}
        </Field>
        <Field>
          <div className="tw-flex tw-justify-end tw-pt-1">
            <Button
              data-testid="show-advanced"
              size="regular"
              theme="primary"
              variant="text"
              onClick={() => setShowAdv((prev) => !prev)}>
              {showAdv ? 'Hide Advanced Config' : 'Show Advanced Config'}
            </Button>
          </div>
        </Field>
        {showAdv ? (
          <>
            {getSeparator(
              <span className="tw-text-base tw-px-0.5">Advanced Config</span>,
              'tw-mt-3'
            )}
            <Field>
              <div className="tw-flex tw-gap-4 tw-w-full">
                <div className="tw-flex-1">
                  <label
                    className="tw-block tw-form-label"
                    htmlFor="batch-size">
                    Batch Size:
                  </label>
                  <input
                    className="tw-form-inputs tw-px-3 tw-py-1"
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
                    Connection Timeout (s):
                  </label>
                  <input
                    className="tw-form-inputs tw-px-3 tw-py-1"
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
                      Secret Key:
                    </label>
                    <div className="tw-flex tw-items-center">
                      <input
                        readOnly
                        className="tw-form-inputs tw-px-3 tw-py-1"
                        data-testid="secret-key"
                        id="secret-key"
                        name="secret-key"
                        placeholder="secret key"
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
                          <FontAwesomeIcon icon={faSyncAlt} />
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
                      className="tw-form-inputs tw-px-3 tw-py-1"
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
                <span>Back</span>
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
                Discard
              </Button>
              {getSaveButton()}
            </div>
          )}
        </Field>
        {data && isDelete && (
          <ConfirmationModal
            bodyText={`You want to delete webhook ${data.name} permanently? This action cannot be reverted.`}
            cancelText="Discard"
            confirmButtonCss="tw-bg-error hover:tw-bg-error focus:tw-bg-error"
            confirmText="Delete"
            header="Are you sure?"
            onCancel={() => setIsDelete(false)}
            onConfirm={handleDelete}
          />
        )}
      </div>
    </PageLayout>
  );
};

export default AddWebhook;
