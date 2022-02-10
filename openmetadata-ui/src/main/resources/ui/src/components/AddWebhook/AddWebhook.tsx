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

import classNames from 'classnames';
import { cloneDeep, isEmpty, isNil, startCase } from 'lodash';
import { EditorContentRef } from 'Models';
import React, { FunctionComponent, useRef, useState } from 'react';
import { EntityType } from '../../enums/entity.enum';
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
  requiredField,
} from '../../utils/CommonUtils';
import { Button } from '../buttons/Button/Button';
import MarkdownWithPreview from '../common/editor/MarkdownWithPreview';
import PageLayout from '../containers/PageLayout';
import DropDown from '../dropdown/DropDown';
import { AddWebhookProps } from './AddWebhook.interface';

const Field = ({ children }: { children: React.ReactNode }) => {
  return <div className="tw-mt-4">{children}</div>;
};

const getEventFilterByType = (
  filters: Array<EventFilter>,
  type: EventType
): EventFilter => {
  return filters.find((item) => item.eventType === type) || ({} as EventFilter);
};

const AddWebhook: FunctionComponent<AddWebhookProps> = ({
  data,
  header,
  onCancel,
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
  const [batchSize, setBatchSize] = useState<number>(data?.batchSize || 10);
  const [connectionTimeout, setConnectionTimeout] = useState<number>(
    data?.timeout || 10
  );
  const [showErrorMsg, setShowErrorMsg] = useState<{ [key: string]: boolean }>({
    name: false,
    endpointUrl: false,
    eventFilters: false,
  });

  const handleValidation = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = event.target.value;
    const eleName = event.target.name;
    let { name, endpointUrl } = cloneDeep(showErrorMsg);

    switch (eleName) {
      case 'name': {
        setName(value);
        name = false;

        break;
      }
      case 'endpoint-url': {
        setEndpointUrl(value);
        endpointUrl = false;

        break;
      }
      case 'secret-key': {
        setSecretKey(value);

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
      return { ...prev, name, endpointUrl };
    });
  };

  const getEntitiesList = () => {
    return [
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
  };

  const getSelectedEvents = (prev: EventFilter, value: string) => {
    const entities = prev.entities || [];
    if (entities.includes(value as string)) {
      const index = entities.indexOf(value as string);
      entities.splice(index, 1);
    } else {
      entities.push(value as string);
    }

    return { ...prev, entities };
  };

  const toggleEventFilters = (type: EventType, value: boolean) => {
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
        return { ...prev, eventFilters: false };
      });
    }
  };

  const getEventFiltersData = () => {
    const eventFilters: Array<EventFilter> = [];
    if (!isEmpty(createEvents)) {
      eventFilters.push(createEvents);
    }
    if (!isEmpty(updateEvents)) {
      eventFilters.push(updateEvents);
    }
    if (!isEmpty(deleteEvents)) {
      eventFilters.push(deleteEvents);
    }

    return eventFilters;
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

  const fetchRightPanel = () => {
    return (
      <>
        <h6 className="tw-heading tw-text-base">Configure Your Webhook</h6>
        <div className="tw-mb-5">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad
          minim veniam, quis nostrud exercitation ullamco laboris nisi ut
          aliquip ex ea commodo consequat. Duis aute irure dolor in
          reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
          pariatur. Excepteur sint occaecat cupidatat non proident, sunt in
          culpa qui officia deserunt mollit anim id est laborum.
          <br />
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad
          minim veniam, quis nostrud exercitation ullamco laboris nisi ut
          aliquip ex ea commodo consequat. Duis aute irure dolor in
          reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
          pariatur. Excepteur sint occaecat cupidatat non proident, sunt in
          culpa qui officia deserunt mollit anim id est laborum.
        </div>
        {getDocButton('Read Webhook Doc', '', 'webhook-doc')}
      </>
    );
  };

  return (
    <PageLayout
      classes="tw-w-full-hd"
      layout={PageLayoutType['2ColRTL']}
      rightPanel={fetchRightPanel()}>
      <h6 className="tw-heading tw-text-base">{header}</h6>
      <div className="tw-pb-3">
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
          {showErrorMsg.name && errorMsg('Webhook name is required.')}
        </Field>
        <Field>
          <label
            className="tw-block tw-form-label tw-mb-0"
            htmlFor="description">
            Description:
          </label>
          <MarkdownWithPreview
            data-testid="description"
            ref={markdownRef}
            value={description}
          />
        </Field>
        <Field>
          <label className="tw-block tw-form-label" htmlFor="endpoint-url">
            {requiredField('Endpoint URL:')}
          </label>
          <input
            className="tw-form-inputs tw-px-3 tw-py-1"
            data-testid="endpoint-url"
            id="endpoint-url"
            name="endpoint-url"
            placeholder="endpoint url"
            type="text"
            value={endpointUrl}
            onChange={handleValidation}
          />
          {showErrorMsg.endpointUrl &&
            errorMsg('Webhook endpoint is required.')}
        </Field>
        <Field>
          <div className="tw-flex tw-pt-1">
            <label>Active</label>
            <div
              className={classNames('toggle-switch', { open: active })}
              data-testid="active"
              onClick={() => {
                setActive((prev) => !prev);
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
                data-testid="checkbox"
                type="checkbox"
                onChange={(e) => {
                  toggleEventFilters(EventType.EntityCreated, e.target.checked);
                }}
              />
              <div
                className="tw-flex tw-items-center filters-title tw-truncate custom-checkbox-label"
                data-testid="checkbox-label">
                <div className="tw-ml-1">Entity Created</div>
              </div>
            </div>
          </div>
          <DropDown
            className={classNames('tw-bg-white', {
              'tw-bg-gray-100 tw-pointer-events-none tw-cursor-not-allowed':
                isEmpty(createEvents),
            })}
            dropDownList={getEntitiesList()}
            label="All Entities"
            selectedItems={createEvents.entities}
            type="checkbox"
            onSelect={(_e, value) =>
              setCreateEvents((prev) =>
                getSelectedEvents(prev, value as string)
              )
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
                data-testid="checkbox"
                type="checkbox"
                onChange={(e) => {
                  toggleEventFilters(EventType.EntityUpdated, e.target.checked);
                }}
              />
              <div
                className="tw-flex tw-items-center filters-title tw-truncate custom-checkbox-label"
                data-testid="checkbox-label">
                <div className="tw-ml-1">Entity Updated</div>
              </div>
            </div>
          </div>
          <DropDown
            className={classNames('tw-bg-white', {
              'tw-bg-gray-100 tw-pointer-events-none tw-cursor-not-allowed':
                isEmpty(updateEvents),
            })}
            dropDownList={getEntitiesList()}
            label="All Entities"
            selectedItems={updateEvents.entities}
            type="checkbox"
            onSelect={(_e, value) =>
              setUpdateEvents((prev) =>
                getSelectedEvents(prev, value as string)
              )
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
                data-testid="checkbox"
                type="checkbox"
                onChange={(e) => {
                  toggleEventFilters(EventType.EntityDeleted, e.target.checked);
                }}
              />
              <div
                className="tw-flex tw-items-center filters-title tw-truncate custom-checkbox-label"
                data-testid="checkbox-label">
                <div className="tw-ml-1">Entity Deleted</div>
              </div>
            </div>
          </div>
          <DropDown
            className={classNames('tw-bg-white', {
              'tw-bg-gray-100 tw-pointer-events-none tw-cursor-not-allowed':
                isEmpty(deleteEvents),
            })}
            dropDownList={getEntitiesList()}
            label="All Entities"
            selectedItems={deleteEvents.entities}
            type="checkbox"
            onSelect={(_e, value) =>
              setDeleteEvents((prev) =>
                getSelectedEvents(prev, value as string)
              )
            }
          />
          {showErrorMsg.eventFilters &&
            errorMsg('Webhook event filters are required.')}
        </Field>
        <Field>
          <div className="tw-flex tw-pt-1">
            <label>Advanced Config</label>
            <div
              className={classNames('toggle-switch', { open: showAdv })}
              data-testid="active"
              onClick={() => {
                setShowAdv((prev) => !prev);
              }}>
              <div className="switch" />
            </div>
          </div>
        </Field>
        {showAdv ? (
          <>
            <Field>
              <label className="tw-block tw-form-label" htmlFor="secret-key">
                Secret Key:
              </label>
              <input
                className="tw-form-inputs tw-px-3 tw-py-1"
                data-testid="secret-key"
                id="secret-key"
                name="secret-key"
                placeholder="secret key"
                type="text"
                value={secretKey}
                onChange={handleValidation}
              />
            </Field>
            <Field>
              <div className="tw-flex tw-gap-1 tw-w-full">
                <div className="tw-flex-1">
                  <label
                    className="tw-block tw-form-label"
                    htmlFor="batch-size">
                    Batch Size:
                  </label>
                  <input
                    className="tw-form-inputs tw-px-3 tw-py-1"
                    data-testid="batch-size"
                    id="batch-size"
                    name="batch-size"
                    placeholder="batch size"
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
                    id="connection-timeout"
                    name="connection-timeout"
                    placeholder="connection timeout"
                    type="number"
                    value={connectionTimeout}
                    onChange={handleValidation}
                  />
                </div>
              </div>
            </Field>
          </>
        ) : null}
        <Field>
          <div className="tw-flex tw-justify-end">
            <Button
              data-testid="cancel-webhook"
              size="regular"
              theme="primary"
              variant="text"
              onClick={onCancel}>
              Discard
            </Button>
            <Button
              className="tw-w-16 tw-h-10"
              data-testid="save-webhook"
              size="regular"
              theme="primary"
              variant="contained"
              onClick={handleSave}>
              Save
            </Button>
          </div>
        </Field>
      </div>
    </PageLayout>
  );
};

export default AddWebhook;
