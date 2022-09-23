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
import { Input, Select } from 'antd';
import classNames from 'classnames';
import { cloneDeep, isEmpty, isUndefined } from 'lodash';
import { EditorContentRef } from 'Models';
import React, { useRef, useState } from 'react';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import { getBotsPagePath, getUsersPagePath } from '../../constants/constants';
import { validEmailRegEx } from '../../constants/regex.constants';
import { PageLayoutType } from '../../enums/layout.enum';
import { CreateUser as CreateUserSchema } from '../../generated/api/teams/createUser';
import { GoogleSSOClientConfig } from '../../generated/configuration/airflowConfiguration';
import { Role } from '../../generated/entity/teams/role';
import {
  AuthType,
  EntityReference as UserTeams,
  JWTTokenExpiry,
  SsoServiceType,
} from '../../generated/entity/teams/user';
import jsonData from '../../jsons/en';
import {
  DEFAULT_GOOGLE_SSO_CLIENT_CONFIG,
  getAuthMechanismTypeOptions,
  getJWTTokenExpiryOptions,
  SECRET_KEY_ERROR_MSG,
} from '../../utils/BotsUtils';
import { errorMsg, requiredField } from '../../utils/CommonUtils';
import { Button } from '../buttons/Button/Button';
import RichTextEditor from '../common/rich-text-editor/RichTextEditor';
import TitleBreadcrumb from '../common/title-breadcrumb/title-breadcrumb.component';
import PageLayout from '../containers/PageLayout';
import DropDown from '../dropdown/DropDown';
import { DropDownListItem } from '../dropdown/types';
import { Field } from '../Field/Field';
import Loader from '../Loader/Loader';
import TeamsSelectable from '../TeamsSelectable/TeamsSelectable';
import { CreateUserProps } from './CreateUser.interface';

const { Option } = Select;

const CreateUser = ({
  roles,
  saveState = 'initial',
  onCancel,
  onSave,
  forceBot,
}: CreateUserProps) => {
  const { authConfig } = useAuthContext();
  const markdownRef = useRef<EditorContentRef>();
  const [description] = useState<string>('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBot, setIsBot] = useState(forceBot);
  const [selectedRoles, setSelectedRoles] = useState<Array<string | undefined>>(
    []
  );
  const [selectedTeams, setSelectedTeams] = useState<Array<string | undefined>>(
    []
  );
  const [authMechanism, setAuthMechanism] = useState<AuthType>(AuthType.Jwt);
  const [tokenExpiry, setTokenExpiry] = useState<JWTTokenExpiry>(
    JWTTokenExpiry.OneHour
  );

  const [googleSSOClientConfig, setGoogleSSOClientConfig] =
    useState<GoogleSSOClientConfig>(DEFAULT_GOOGLE_SSO_CLIENT_CONFIG);

  const [showErrorMsg, setShowErrorMsg] = useState({
    email: false,
    displayName: false,
    validEmail: false,
    secretKey: false,
  });

  const slashedBreadcrumbList = [
    {
      name: forceBot ? 'Bots' : 'Users',
      url: forceBot ? getBotsPagePath() : getUsersPagePath(),
    },
    {
      name: `Create ${forceBot ? 'Bot' : 'User'}`,
      url: '',
      activeTitle: true,
    },
  ];

  /**
   * common function to update user input in to the state
   * @param event change event for input/selection field
   * @returns if user dont have access to the page it will not update data.
   */
  const handleValidation = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = event.target.value;
    const eleName = event.target.name;

    switch (eleName) {
      case 'email':
        setEmail(value);
        setShowErrorMsg({ ...showErrorMsg, email: false });

        break;

      case 'displayName':
        setDisplayName(value);
        setShowErrorMsg({ ...showErrorMsg, displayName: false });

        break;
      case 'secretKey':
        setGoogleSSOClientConfig((previous) => ({
          ...previous,
          secretKey: value,
        }));
        setShowErrorMsg({ ...showErrorMsg, secretKey: false });

        break;
      case 'audience':
        setGoogleSSOClientConfig((previous) => ({
          ...previous,
          audience: value,
        }));

        break;

      default:
        break;
    }
  };

  /**
   * Generate DropdownListItem
   * @param data Array containing object which must have name and id
   * @returns DropdownListItem[]
   */
  const getDropdownOptions = (
    data: Array<Role> | Array<UserTeams>
  ): DropDownListItem[] => {
    return [
      ...data.map((option) => {
        return {
          name: option.displayName || option.name || '',
          value: option.id,
        };
      }),
    ];
  };

  /**
   * Dropdown option selector
   * @param id of selected option from dropdown
   */
  const selectedRolesHandler = (id?: string) => {
    setSelectedRoles((prevState: Array<string | undefined>) => {
      if (prevState.includes(id as string)) {
        const selectedRole = [...prevState];
        const index = selectedRole.indexOf(id as string);
        selectedRole.splice(index, 1);

        return selectedRole;
      } else {
        return [...prevState, id];
      }
    });
  };

  /**
   * Validate if required value is provided or not.
   * @returns boolean
   */
  const validateForm = () => {
    const errMsg = cloneDeep(showErrorMsg);
    if (isEmpty(email)) {
      errMsg.email = true;
    } else {
      errMsg.validEmail = !validEmailRegEx.test(email);
    }
    if (isEmpty(googleSSOClientConfig.secretKey)) {
      errMsg.secretKey = true;
    }
    setShowErrorMsg(errMsg);

    return !Object.values(errMsg).includes(true);
  };

  /**
   * Form submit handler
   */
  const handleSave = () => {
    const validRole = selectedRoles.filter(
      (id) => !isUndefined(id)
    ) as string[];
    const validTeam = selectedTeams.filter(
      (id) => !isUndefined(id)
    ) as string[];
    if (validateForm()) {
      const userProfile: CreateUserSchema = {
        description: markdownRef.current?.getEditorContent() || undefined,
        name: email.split('@')[0],
        displayName,
        roles: validRole.length ? validRole : undefined,
        teams: validTeam.length ? validTeam : undefined,
        email: email,
        isAdmin: isAdmin,
        isBot: isBot,
        ...(forceBot
          ? {
              authenticationMechanism: {
                authType: authMechanism,
                config:
                  authMechanism === AuthType.Jwt
                    ? {
                        JWTTokenExpiry: tokenExpiry,
                      }
                    : {
                        ssoServiceType: SsoServiceType.Google,
                        authConfig: {
                          secretKey: googleSSOClientConfig.secretKey,
                          audience: googleSSOClientConfig.audience,
                        },
                      },
              },
            }
          : {}),
      };
      onSave(userProfile);
    }
  };

  /**
   * Dynamic button provided as per its state, useful for micro interaction
   * @returns Button
   */
  const getSaveButton = () => {
    return (
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
            className={classNames('tw-w-16 tw-h-10')}
            data-testid="save-user"
            size="regular"
            theme="primary"
            variant="contained"
            onClick={handleSave}>
            Create
          </Button>
        )}
      </>
    );
  };

  return (
    <PageLayout
      classes="tw-max-w-full-hd tw-h-full tw-pt-4"
      header={<TitleBreadcrumb titleLinks={slashedBreadcrumbList} />}
      layout={PageLayoutType['2ColRTL']}>
      <div className="tw-form-container">
        <h6 className="tw-heading tw-text-base">
          Create {forceBot ? 'Bot' : 'User'}
        </h6>
        <Field>
          <label className="tw-block tw-form-label tw-mb-0" htmlFor="email">
            {requiredField('Email')}
          </label>
          <input
            className="tw-form-inputs tw-form-inputs-padding"
            data-testid="email"
            id="email"
            name="email"
            placeholder="email"
            type="text"
            value={email}
            onChange={handleValidation}
          />

          {showErrorMsg.email
            ? errorMsg(jsonData['form-error-messages']['empty-email'])
            : showErrorMsg.validEmail
            ? errorMsg(jsonData['form-error-messages']['invalid-email'])
            : null}
        </Field>
        <Field>
          <label
            className="tw-block tw-form-label tw-mb-0"
            htmlFor="displayName">
            Display Name
          </label>
          <input
            className="tw-form-inputs tw-form-inputs-padding"
            data-testid="displayName"
            id="displayName"
            name="displayName"
            placeholder="displayName"
            type="text"
            value={displayName}
            onChange={handleValidation}
          />
        </Field>
        {forceBot && (
          <>
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
            {authMechanism === AuthType.Jwt && (
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
              </Field>
            )}
            {authMechanism === AuthType.Sso && (
              <>
                <Field>
                  <label
                    className="tw-block tw-form-label tw-mb-0"
                    htmlFor="secretKey">
                    {requiredField('SecretKey')}
                  </label>
                  <Input.Password
                    data-testid="secretKey"
                    id="secretKey"
                    name="secretKey"
                    placeholder="secretKey"
                    value={googleSSOClientConfig.secretKey}
                    onChange={handleValidation}
                  />
                  {showErrorMsg.secretKey && errorMsg(SECRET_KEY_ERROR_MSG)}
                </Field>
                <Field>
                  <label
                    className="tw-block tw-form-label tw-mb-0"
                    htmlFor="audience">
                    Audience
                  </label>
                  <Input
                    data-testid="audience"
                    id="audience"
                    name="audience"
                    placeholder="audience"
                    value={googleSSOClientConfig.audience}
                    onChange={handleValidation}
                  />
                </Field>
              </>
            )}
          </>
        )}
        <Field>
          <label
            className="tw-block tw-form-label tw-mb-0"
            htmlFor="description">
            Description
          </label>
          <RichTextEditor initialValue={description} ref={markdownRef} />
        </Field>
        {!forceBot && (
          <>
            <Field>
              <label className="tw-block tw-form-label tw-mb-0">Teams</label>
              <TeamsSelectable onSelectionChange={setSelectedTeams} />
            </Field>
            <Field>
              <label className="tw-block tw-form-label tw-mb-0" htmlFor="role">
                Roles
              </label>
              <DropDown
                className={classNames('tw-bg-white', {
                  'tw-bg-gray-100 tw-cursor-not-allowed': roles.length === 0,
                })}
                dataTestId="roles-dropdown"
                dropDownList={getDropdownOptions(roles) as DropDownListItem[]}
                label="Roles"
                selectedItems={selectedRoles as Array<string>}
                type="checkbox"
                onSelect={(_e, value) => selectedRolesHandler(value)}
              />
            </Field>

            <Field className="tw-flex tw-gap-5">
              <div className="tw-flex tw-pt-1">
                <label>Admin</label>
                <div
                  className={classNames('toggle-switch', { open: isAdmin })}
                  data-testid="admin"
                  onClick={() => {
                    setIsAdmin((prev) => !prev);
                    setIsBot(false);
                  }}>
                  <div className="switch" />
                </div>
              </div>
            </Field>
          </>
        )}
        <Field className="tw-flex tw-justify-end">
          <Button
            data-testid="cancel-user"
            size="regular"
            theme="primary"
            variant="text"
            onClick={onCancel}>
            Cancel
          </Button>
          {getSaveButton()}
        </Field>
      </div>
    </PageLayout>
  );
};

export default CreateUser;
