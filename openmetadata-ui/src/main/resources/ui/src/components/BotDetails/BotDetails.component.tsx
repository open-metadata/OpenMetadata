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
import { Card } from 'antd';
import { AxiosError } from 'axios';
import React, {
  FC,
  Fragment,
  HTMLAttributes,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  getAuthMechanismForBotUser,
  updateUser,
} from '../../axiosAPIs/userAPI';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/globalSettings.constants';
import {
  AuthenticationMechanism,
  AuthType,
  User,
} from '../../generated/entity/teams/user';
import { EntityReference } from '../../generated/type/entityReference';
import { getEntityName } from '../../utils/CommonUtils';
import { getSettingPath } from '../../utils/RouterUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { Button } from '../buttons/Button/Button';
import Description from '../common/description/Description';
import TitleBreadcrumb from '../common/title-breadcrumb/title-breadcrumb.component';
import PageLayout, { leftPanelAntCardStyle } from '../containers/PageLayout';
import ConfirmationModal from '../Modals/ConfirmationModal/ConfirmationModal';
import { OperationPermission } from '../PermissionProvider/PermissionProvider.interface';
import { UserDetails } from '../Users/Users.interface';
import AuthMechanism from './AuthMechanism';
import AuthMechanismForm from './AuthMechanismForm';

interface BotsDetailProp extends HTMLAttributes<HTMLDivElement> {
  botsData: User;
  botPermission: OperationPermission;
  updateBotsDetails: (data: UserDetails) => Promise<void>;
  revokeTokenHandler: () => void;
}

const BotDetails: FC<BotsDetailProp> = ({
  botsData,
  updateBotsDetails,
  revokeTokenHandler,
  botPermission,
}) => {
  const [displayName, setDisplayName] = useState(botsData.displayName);
  const [isDisplayNameEdit, setIsDisplayNameEdit] = useState(false);
  const [isDescriptionEdit, setIsDescriptionEdit] = useState(false);
  const [isRevokingToken, setIsRevokingToken] = useState<boolean>(false);

  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const [authenticationMechanism, setAuthenticationMechanism] =
    useState<AuthenticationMechanism>();

  const [isAuthMechanismEdit, setIsAuthMechanismEdit] =
    useState<boolean>(false);

  const editAllPermission = useMemo(
    () => botPermission.EditAll,
    [botPermission]
  );
  const displayNamePermission = useMemo(
    () => botPermission.EditDisplayName,
    [botPermission]
  );

  const descriptionPermission = useMemo(
    () => botPermission.EditDescription,
    [botPermission]
  );

  const fetchAuthMechanismForBot = async () => {
    try {
      const response = await getAuthMechanismForBotUser(botsData.id);
      setAuthenticationMechanism(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleAuthMechanismUpdate = async (
    updatedAuthMechanism: AuthenticationMechanism
  ) => {
    setIsUpdating(true);
    try {
      const {
        isAdmin,
        teams,
        timezone,
        name,
        description,
        displayName,
        profile,
        email,
        isBot,
        roles,
      } = botsData;
      const response = await updateUser({
        isAdmin,
        teams,
        timezone,
        name,
        description,
        displayName,
        profile,
        email,
        isBot,
        roles,
        authenticationMechanism: {
          ...botsData.authenticationMechanism,
          authType: updatedAuthMechanism.authType,
          config:
            updatedAuthMechanism.authType === AuthType.Jwt
              ? {
                  JWTTokenExpiry: updatedAuthMechanism.config?.JWTTokenExpiry,
                }
              : {
                  ssoServiceType: updatedAuthMechanism.config?.ssoServiceType,
                  authConfig: updatedAuthMechanism.config?.authConfig,
                },
        },
      } as User);
      if (response.data) {
        fetchAuthMechanismForBot();
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsUpdating(false);
      setIsAuthMechanismEdit(false);
    }
  };

  const handleAuthMechanismEdit = () => setIsAuthMechanismEdit(true);

  const onDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayName(e.target.value);
  };

  const handleDisplayNameChange = () => {
    if (displayName !== botsData.displayName) {
      updateBotsDetails({ displayName: displayName || '' });
    }
    setIsDisplayNameEdit(false);
  };

  const handleDescriptionChange = async (description: string) => {
    await updateBotsDetails({ description });

    setIsDescriptionEdit(false);
  };

  const getDisplayNameComponent = () => {
    return (
      <div className="tw-mt-4 tw-w-full">
        {isDisplayNameEdit ? (
          <div className="tw-flex tw-items-center tw-gap-2">
            <input
              className="tw-form-inputs tw-form-inputs-padding tw-py-0.5 tw-w-full"
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
              <span
                className="tw-text-base tw-font-medium tw-mr-2"
                data-testid="bot-displayName">
                {displayName}
              </span>
            ) : (
              <span className="tw-no-description tw-text-sm">
                Add display name
              </span>
            )}
            {(displayNamePermission || editAllPermission) && (
              <button
                className="tw-ml-2 focus:tw-outline-none"
                data-testid="edit-displayName"
                onClick={() => setIsDisplayNameEdit(true)}>
                <SVGIcons
                  alt="edit"
                  icon="icon-edit"
                  title="Edit"
                  width="16px"
                />
              </button>
            )}
          </Fragment>
        )}
      </div>
    );
  };

  const getDescriptionComponent = () => {
    return (
      <div className="tw--ml-5">
        <Description
          description={botsData.description || ''}
          entityName={getEntityName(botsData as unknown as EntityReference)}
          hasEditAccess={descriptionPermission || editAllPermission}
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
      <Card
        className="ant-card-feed"
        style={{
          ...leftPanelAntCardStyle,
          marginTop: '16px',
        }}>
        <div data-testid="left-panel">
          <div className="tw-flex tw-flex-col">
            <div>
              <SVGIcons
                alt="bot-profile"
                icon={Icons.BOT_PROFILE}
                width="280px"
              />
            </div>
            {getDisplayNameComponent()}

            {getDescriptionComponent()}
          </div>
        </div>
      </Card>
    );
  };

  const rightPanel = (
    <Card
      className="ant-card-feed"
      style={{
        ...leftPanelAntCardStyle,
        marginTop: '16px',
      }}>
      <div data-testid="right-panel">
        <div className="tw-flex tw-flex-col">
          <h6 className="tw-mb-2 tw-text-lg">Token Security</h6>
          <p className="tw-mb-2">
            Anyone who has your JWT Token will be able to send REST API requests
            to the OpenMetadata Server. Do not expose the JWT Token in your
            application code. Do not share it on GitHub or anywhere else online.
          </p>
        </div>
      </div>
    </Card>
  );

  useEffect(() => {
    if (botsData.id) {
      fetchAuthMechanismForBot();
    }
  }, [botsData]);

  return (
    <PageLayout
      classes="tw-h-full tw-px-4"
      header={
        <TitleBreadcrumb
          className="tw-px-6"
          titleLinks={[
            {
              name: 'Bots',
              url: getSettingPath(
                GlobalSettingsMenuCategory.INTEGRATIONS,
                GlobalSettingOptions.BOTS
              ),
            },
            { name: botsData.name || '', url: '', activeTitle: true },
          ]}
        />
      }
      leftPanel={fetchLeftPanel()}
      rightPanel={rightPanel}>
      {authenticationMechanism && (
        <Card
          data-testid="center-panel"
          style={{
            ...leftPanelAntCardStyle,
            marginTop: '16px',
          }}>
          {isAuthMechanismEdit ? (
            <AuthMechanismForm
              authenticationMechanism={authenticationMechanism}
              isUpdating={isUpdating}
              onCancel={() => setIsAuthMechanismEdit(false)}
              onSave={handleAuthMechanismUpdate}
            />
          ) : (
            <AuthMechanism
              authenticationMechanism={authenticationMechanism}
              hasPermission={editAllPermission}
              onEdit={handleAuthMechanismEdit}
              onTokenRevoke={() => setIsRevokingToken(true)}
            />
          )}
        </Card>
      )}

      {isRevokingToken ? (
        <ConfirmationModal
          bodyText="Are you sure you want to revoke access for JWT token?"
          cancelText="Cancel"
          confirmText="Confirm"
          header="Are you sure?"
          onCancel={() => setIsRevokingToken(false)}
          onConfirm={() => {
            revokeTokenHandler();
            setIsRevokingToken(false);
            handleAuthMechanismEdit();
          }}
        />
      ) : null}
    </PageLayout>
  );
};

export default BotDetails;
