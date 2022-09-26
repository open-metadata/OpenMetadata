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
import { Card, Input, Select } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import React, {
  FC,
  Fragment,
  HTMLAttributes,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import { getUserToken, updateUser } from '../../axiosAPIs/userAPI';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/globalSettings.constants';
import {
  AuthType,
  JWTTokenExpiry,
  SsoServiceType,
  User,
} from '../../generated/entity/teams/user';
import { EntityReference } from '../../generated/type/entityReference';
import {
  getAuthMechanismTypeOptions,
  getJWTTokenExpiryOptions,
  getTokenExpiryDate,
  getTokenExpiryText,
} from '../../utils/BotsUtils';
import { getEntityName, requiredField } from '../../utils/CommonUtils';
import { getSettingPath } from '../../utils/RouterUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { Button } from '../buttons/Button/Button';
import CopyToClipboardButton from '../buttons/CopyToClipboardButton/CopyToClipboardButton';
import Description from '../common/description/Description';
import TitleBreadcrumb from '../common/title-breadcrumb/title-breadcrumb.component';
import PageLayout, { leftPanelAntCardStyle } from '../containers/PageLayout';
import { Field } from '../Field/Field';
import Loader from '../Loader/Loader';
import ConfirmationModal from '../Modals/ConfirmationModal/ConfirmationModal';
import { OperationPermission } from '../PermissionProvider/PermissionProvider.interface';
import { UserDetails } from '../Users/Users.interface';
const { Option } = Select;
interface BotsDetailProp extends HTMLAttributes<HTMLDivElement> {
  botsData: User;
  botPermission: OperationPermission;
  updateBotsDetails: (data: UserDetails) => Promise<void>;
  revokeTokenHandler: () => void;
}

interface Option {
  value: string;
  label: string;
}

const BotDetails: FC<BotsDetailProp> = ({
  botsData,
  updateBotsDetails,
  revokeTokenHandler,
  botPermission,
}) => {
  const { authConfig } = useAuthContext();
  const [displayName, setDisplayName] = useState(botsData.displayName);
  const [isDisplayNameEdit, setIsDisplayNameEdit] = useState(false);
  const [isDescriptionEdit, setIsDescriptionEdit] = useState(false);
  const [botsToken, setBotsToken] = useState<string>('');
  const [botsTokenExpiry, setBotsTokenExpiry] = useState<number>();
  const [isRevokingToken, setIsRevokingToken] = useState<boolean>(false);
  const [generateToken, setGenerateToken] = useState<boolean>(false);

  const [authMechanism, setAuthMechanism] = useState<AuthType>(AuthType.Jwt);
  const [tokenExpiry, setTokenExpiry] = useState<JWTTokenExpiry>(
    JWTTokenExpiry.OneHour
  );
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

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

  const fetchBotsToken = () => {
    getUserToken(botsData.id)
      .then((res) => {
        const { JWTToken, JWTTokenExpiresAt } = res;
        setBotsToken(JWTToken);
        setBotsTokenExpiry(JWTTokenExpiresAt);
        setTokenExpiry(res.JWTTokenExpiry ?? JWTTokenExpiry.OneHour);
      })
      .catch((err: AxiosError) => {
        showErrorToast(err);
      });
  };

  const handleBotTokenDetailUpdate = async () => {
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
          authType: authMechanism,
          config:
            authMechanism === AuthType.Jwt
              ? {
                  JWTTokenExpiry: tokenExpiry,
                }
              : {
                  ssoServiceType: SsoServiceType.Google,
                  authConfig: {},
                },
        },
      } as User);
      if (response.data) {
        fetchBotsToken();
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsUpdating(false);
      setGenerateToken(false);
    }
  };

  const handleTokenGeneration = () => setGenerateToken(true);

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

  const fetchRightPanel = () => {
    return (
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
              Anyone who has your JWT Token will be able to send REST API
              requests to the OpenMetadata Server. Do not expose the JWT Token
              in your application code. Do not share it on GitHub or anywhere
              else online.
            </p>
          </div>
        </div>
      </Card>
    );
  };

  const getCopyComponent = () => {
    if (botsToken) {
      return <CopyToClipboardButton copyText={botsToken} />;
    } else {
      return null;
    }
  };

  const getBotsTokenExpiryDate = () => {
    if (botsTokenExpiry) {
      // get the current date timestamp
      const currentTimeStamp = Date.now();

      const isTokenExpired = currentTimeStamp >= botsTokenExpiry;

      // get the token expiry date
      const tokenExpiryDate = getTokenExpiryDate(botsTokenExpiry);

      return (
        <p
          className="tw-text-grey-muted tw-mt-2 tw-italic"
          data-testid="token-expiry">
          {isTokenExpired
            ? `Expired on ${tokenExpiryDate}`
            : `Expires on ${tokenExpiryDate}`}
          .
        </p>
      );
    } else {
      return (
        <p
          className="tw-text-grey-muted tw-mt-2 tw-italic"
          data-testid="token-expiry">
          <SVGIcons alt="warning" icon="error" />
          <span className="tw-ml-1 tw-align-middle">
            This token has no expiration date.
          </span>
        </p>
      );
    }
  };

  const centerLayout = () => {
    if (generateToken) {
      return (
        <div className="tw-mt-4" data-testid="generate-token-form">
          <Field>
            <label
              className="tw-block tw-form-label tw-mb-0"
              htmlFor="auth-mechanism">
              {requiredField('Auth Mechanism')}
            </label>
            <Select
              className="w-full"
              data-testid="auth-mechanism"
              defaultValue={authMechanism}
              placeholder="Select Auth Mechanism"
              onChange={(value) => setAuthMechanism(value)}>
              {getAuthMechanismTypeOptions(authConfig).map((option) => (
                <Option key={option.value}>{option.label}</Option>
              ))}
            </Select>
          </Field>
          <Field>
            <label
              className="tw-block tw-form-label tw-mb-0"
              htmlFor="token-expiry">
              {requiredField('Token Expiration')}
            </label>
            <Select
              className="w-full"
              data-testid="token-expiry"
              defaultValue={tokenExpiry}
              placeholder="Select Token Expiration"
              onChange={(value) => setTokenExpiry(value)}>
              {getJWTTokenExpiryOptions().map((option) => (
                <Option key={option.value}>{option.label}</Option>
              ))}
            </Select>
            <p className="tw-mt-2">{getTokenExpiryText(tokenExpiry)}</p>
          </Field>

          <div className="tw-flex tw-justify-end">
            <Button
              className={classNames('tw-mr-2')}
              data-testid="discard-button"
              size="regular"
              theme="primary"
              variant="text"
              onClick={() => setGenerateToken(false)}>
              Cancel
            </Button>
            <Button
              data-testid="generate-button"
              size="regular"
              theme="primary"
              type="submit"
              variant="contained"
              onClick={handleBotTokenDetailUpdate}>
              {isUpdating ? <Loader size="small" /> : 'Save'}
            </Button>
          </div>
        </div>
      );
    } else {
      if (botsToken) {
        return (
          <Fragment>
            <div className="tw-flex tw-justify-between tw-items-center tw-mt-4">
              <Input.Password
                contentEditable={false}
                data-testid="token"
                placeholder="Generate new token..."
                value={botsToken}
              />
              {getCopyComponent()}
            </div>
            {getBotsTokenExpiryDate()}
          </Fragment>
        );
      } else {
        return (
          <div
            className="tw-no-description tw-text-sm tw-mt-4"
            data-testid="no-token">
            No token available
          </div>
        );
      }
    }
  };

  const getCenterLayout = () => {
    return (
      <div
        className="tw-w-full tw-bg-white tw-shadow tw-rounded tw-p-4 tw-mt-4"
        data-testid="center-panel">
        <div className="tw-flex tw-justify-between tw-items-center">
          <h6 className="tw-mb-2 tw-self-center">
            {generateToken ? 'Generate JWT token' : 'JWT Token'}
          </h6>
          {!generateToken && editAllPermission ? (
            <>
              {botsToken ? (
                <Button
                  className="tw-px-2 tw-py-0.5 tw-font-medium tw-ml-2 tw-rounded-md tw-border-error hover:tw-border-error tw-text-error hover:tw-text-error focus:tw-outline-none"
                  data-testid="revoke-button"
                  size="custom"
                  variant="outlined"
                  onClick={() => setIsRevokingToken(true)}>
                  Revoke token
                </Button>
              ) : (
                <Button
                  data-testid="generate-token"
                  size="small"
                  theme="primary"
                  variant="outlined"
                  onClick={() => handleTokenGeneration()}>
                  Generate new token
                </Button>
              )}
            </>
          ) : null}
        </div>
        <hr className="tw-mt-2" />
        <p className="tw-mt-4">
          Token you have generated that can be used to access the OpenMetadata
          API.
        </p>
        {centerLayout()}
      </div>
    );
  };

  useEffect(() => {
    if (botsData.id) {
      fetchBotsToken();
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
      rightPanel={fetchRightPanel()}>
      {getCenterLayout()}
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
            handleTokenGeneration();
          }}
        />
      ) : null}
    </PageLayout>
  );
};

export default BotDetails;
