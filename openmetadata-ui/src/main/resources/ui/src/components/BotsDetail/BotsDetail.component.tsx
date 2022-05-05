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
import { AxiosError, AxiosResponse } from 'axios';
import React, {
  FC,
  Fragment,
  HTMLAttributes,
  useEffect,
  useState,
} from 'react';
import { getUserToken } from '../../axiosAPIs/userAPI';
import { ROUTES } from '../../constants/constants';
import { User } from '../../generated/entity/teams/user';
import { EntityReference } from '../../generated/type/entityReference';
import { getEntityName } from '../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { Button } from '../buttons/Button/Button';
import CopyToClipboardButton from '../buttons/CopyToClipboardButton/CopyToClipboardButton';
import Description from '../common/description/Description';
import TitleBreadcrumb from '../common/title-breadcrumb/title-breadcrumb.component';
import PageContainerV1 from '../containers/PageContainerV1';
import PageLayout from '../containers/PageLayout';
import { UserDetails } from '../Users/Users.interface';

interface BotsDetailProp extends HTMLAttributes<HTMLDivElement> {
  botsData: User;
  updateBotsDetails: (data: UserDetails) => void;
}

const BotsDetail: FC<BotsDetailProp> = ({ botsData, updateBotsDetails }) => {
  const [displayName, setDisplayName] = useState(botsData.displayName);
  const [isDisplayNameEdit, setIsDisplayNameEdit] = useState(false);
  const [isDescriptionEdit, setIsDescriptionEdit] = useState(false);
  const [userToken, setUserToken] = useState<string>('');

  const onDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayName(e.target.value);
  };

  const handleDisplayNameChange = () => {
    if (displayName !== botsData.displayName) {
      updateBotsDetails({ displayName: displayName || '' });
    }
    setIsDisplayNameEdit(false);
  };

  const handleDescriptionChange = (description: string) => {
    if (description !== botsData.description) {
      updateBotsDetails({ description });
    }
    setIsDescriptionEdit(false);
  };

  const getTokenValue = () => {
    return userToken;
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

  const fetchRightPanel = () => {
    return (
      <div data-testid="right-panel">
        <div className="tw-pb-4 tw-mb-4 tw-border-b tw-flex tw-flex-col">
          <h6 className="tw-mb-2 tw-text-lg">Token Security</h6>
          <p className="tw-mb-2">
            Anyone who has your REST API key will be able to send notifications
            from your app. Do not expose the REST API key in your application
            code. Do not share it on GitHub or anywhere else online.
          </p>
        </div>
      </div>
    );
  };

  const getCopyComponent = () => {
    const token = getTokenValue();
    if (token) {
      return <CopyToClipboardButton copyText={token} />;
    } else {
      return null;
    }
  };

  const getCenterLayout = () => {
    return (
      <div className="tw-w-full tw-bg-white tw-shadow tw-rounded tw-p-4">
        <div className="tw-flex tw-justify-between tw-items-center">
          <h6 className="tw-mb-2 tw-self-center">JWT Token</h6>
          <Button size="small" theme="primary" variant="outlined">
            Generate new token
          </Button>
        </div>
        <hr className="tw-mt-2" />
        <p className="tw-mt-4">
          Token you have generated that can be used to access the OpenMetadata
          API.
        </p>
        <div className="tw-flex tw-justify-between tw-items-center tw-mt-4">
          <input
            readOnly
            className="tw-form-inputs tw-p-1.5"
            placeholder="Generate new token..."
            type="password"
            value={getTokenValue()}
          />
          {getCopyComponent()}
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (botsData.id) {
      getUserToken(botsData.id)
        .then((res: AxiosResponse) => {
          const { JWTToken } = res.data;
          setUserToken(JWTToken);
        })
        .catch((err: AxiosError) => {
          showErrorToast(err);
        });
    }
  }, [botsData]);

  return (
    <PageContainerV1 className="tw-py-4">
      <TitleBreadcrumb
        className="tw-px-6"
        titleLinks={[
          {
            name: 'Bots',
            url: ROUTES.BOTS,
          },
          { name: botsData.name || '', url: '', activeTitle: true },
        ]}
      />
      <PageLayout
        classes="tw-h-full tw-px-4"
        leftPanel={fetchLeftPanel()}
        rightPanel={fetchRightPanel()}>
        {getCenterLayout()}
      </PageLayout>
    </PageContainerV1>
  );
};

export default BotsDetail;
