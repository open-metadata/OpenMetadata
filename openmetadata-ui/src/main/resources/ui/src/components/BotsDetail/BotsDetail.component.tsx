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

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { FC, Fragment, HTMLAttributes, useState } from 'react';
import { ROUTES } from '../../constants/constants';
import { Bots } from '../../generated/entity/bots';
import { EntityReference } from '../../generated/type/entityReference';
import { getEntityName } from '../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { Button } from '../buttons/Button/Button';
import Description from '../common/description/Description';
import TitleBreadcrumb from '../common/title-breadcrumb/title-breadcrumb.component';
import PageLayout from '../containers/PageLayout';

interface BotsDetailProp extends HTMLAttributes<HTMLDivElement> {
  botsData: Bots;
}

const BotsDetail: FC<BotsDetailProp> = ({ botsData }) => {
  const [displayName, setDisplayName] = useState(botsData.displayName);
  const [isDisplayNameEdit, setIsDisplayNameEdit] = useState(false);
  const [isDescriptionEdit, setIsDescriptionEdit] = useState(false);

  const onDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayName(e.target.value);
  };

  const handleDisplayNameChange = () => {
    if (displayName !== botsData.displayName) {
      // updateUserDetails({ displayName: displayName || '' });
    }
    setIsDisplayNameEdit(false);
  };

  const handleDescriptionChange = (description: string) => {
    if (description !== botsData.description) {
      // updateUserDetails({ description });
    }
    setIsDescriptionEdit(false);
  };

  const getDisplayNameComponent = () => {
    return (
      <div className="tw-mt-4 tw-w-full">
        {isDisplayNameEdit ? (
          <div className="tw-flex tw-items-center tw-gap-1">
            <input
              className="tw-form-inputs tw-px-3 tw-py-0.5 tw-w-64"
              data-testid="displayName"
              id="displayName"
              name="displayName"
              placeholder="displayName"
              type="text"
              value={displayName}
              onChange={onDisplayNameChange}
            />
            <div className="tw-flex tw-justify-end" data-testid="buttons">
              <Button
                className="tw-px-1 tw-py-1 tw-rounded tw-text-sm tw-mr-1"
                data-testid="cancel-displayName"
                size="custom"
                theme="primary"
                variant="contained"
                onMouseDown={() => setIsDisplayNameEdit(false)}>
                <FontAwesomeIcon className="tw-w-3.5 tw-h-3.5" icon="times" />
              </Button>
              <Button
                className="tw-px-1 tw-py-1 tw-rounded tw-text-sm"
                data-testid="save-displayName"
                size="custom"
                theme="primary"
                variant="contained"
                onClick={handleDisplayNameChange}>
                <FontAwesomeIcon className="tw-w-3.5 tw-h-3.5" icon="check" />
              </Button>
            </div>
          </div>
        ) : (
          <Fragment>
            {displayName ? (
              <span className="tw-text-base tw-font-medium tw-mr-2">
                {displayName}
              </span>
            ) : (
              <span className="tw-no-description tw-text-sm">
                Add display name
              </span>
            )}

            <button
              className="tw-ml-2 focus:tw-outline-none"
              data-testid="edit-displayName"
              onClick={() => setIsDisplayNameEdit(true)}>
              <SVGIcons alt="edit" icon="icon-edit" title="Edit" width="12px" />
            </button>
          </Fragment>
        )}
      </div>
    );
  };

  const getDescriptionComponent = () => {
    return (
      <div className="tw--ml-5">
        <Description
          hasEditAccess
          description={botsData.description || ''}
          entityName={getEntityName(botsData as unknown as EntityReference)}
          isEdit={isDescriptionEdit}
          onCancel={() => setIsDescriptionEdit(false)}
          onDescriptionEdit={() => setIsDescriptionEdit(true)}
          onDescriptionUpdate={handleDescriptionChange}
        />
      </div>
    );
  };

  const fetchLeftPanel = () => {
    return (
      <div data-testid="left-panel">
        <div className="tw-pb-4 tw-mb-4 tw-border-b tw-flex tw-flex-col">
          <div className="tw-h-28 tw-w-28">
            <SVGIcons
              alt="bot-profile"
              icon={Icons.BOT_PROFILE}
              width="112px"
            />
          </div>
          {getDisplayNameComponent()}

          {getDescriptionComponent()}
        </div>
      </div>
    );
  };

  return (
    <Fragment>
      <TitleBreadcrumb
        className="tw-py-4 tw-px-6"
        titleLinks={[
          {
            name: 'Bots',
            url: ROUTES.BOTS,
          },
          { name: botsData.name || '', url: '', activeTitle: true },
        ]}
      />
      <PageLayout classes="tw-h-full tw-px-4" leftPanel={fetchLeftPanel()}>
        <></>
      </PageLayout>
    </Fragment>
  );
};

export default BotsDetail;
