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
import classNames from 'classnames';
import { cloneDeep, isEmpty, isUndefined } from 'lodash';
import { EditorContentRef } from 'Models';
import React, { useRef, useState } from 'react';
import { validEmailRegEx } from '../../constants/regex.constants';
import { CreateUser as CreateUserSchema } from '../../generated/api/teams/createUser';
import { Role } from '../../generated/entity/teams/role';
import { EntityReference as UserTeams } from '../../generated/entity/teams/user';
import jsonData from '../../jsons/en';
import { errorMsg, requiredField } from '../../utils/CommonUtils';
import { Button } from '../buttons/Button/Button';
import RichTextEditor from '../common/rich-text-editor/RichTextEditor';
import PageLayout from '../containers/PageLayout';
import DropDown from '../dropdown/DropDown';
import { DropDownListItem } from '../dropdown/types';
import { Field } from '../Field/Field';
import Loader from '../Loader/Loader';
import { CreateUserProps } from './CreateUser.interface';

const CreateUser = ({
  allowAccess,
  roles,
  teams,
  saveState = 'initial',
  onCancel,
  onSave,
}: CreateUserProps) => {
  const markdownRef = useRef<EditorContentRef>();
  const [description] = useState<string>('');
  const [email, setEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBot, setIsBot] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<Array<string | undefined>>(
    []
  );
  const [selectedTeams, setSelectedTeams] = useState<Array<string | undefined>>(
    []
  );
  const [showErrorMsg, setShowErrorMsg] = useState({
    email: false,
    validEmail: false,
  });

  /**
   * common function to update user input in to the state
   * @param event change event for input/selection field
   * @returns if user dont have access to the page it will not update data.
   */
  const handleValidation = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    if (!allowAccess) {
      return;
    }

    const value = event.target.value;
    const eleName = event.target.name;

    switch (eleName) {
      case 'email':
        setEmail(value);
        setShowErrorMsg({ ...showErrorMsg, email: false });

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
   * Dropdown option selector.
   * @param id of selected option from dropdown.
   */
  const selectedTeamsHandler = (id?: string) => {
    setSelectedTeams((prevState: Array<string | undefined>) => {
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
        roles: validRole.length ? validRole : undefined,
        teams: validTeam.length ? validTeam : undefined,
        email: email,
        isAdmin: isAdmin,
        isBot: isBot,
      };
      onSave(userProfile);
    }
  };

  /**
   * Dynamic button provided as per its state, useful for micro interaction
   * @returns Button
   */
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
            data-testid="save-user"
            size="regular"
            theme="primary"
            variant="contained"
            onClick={handleSave}>
            Create
          </Button>
        )}
      </>
    ) : null;
  };

  return (
    <PageLayout classes="tw-max-w-full-hd tw-h-full tw-bg-white tw-py-4">
      <h6 className="tw-heading tw-text-base">Create User</h6>
      <Field>
        <label className="tw-block tw-form-label tw-mb-0" htmlFor="email">
          {requiredField('Email:')}
        </label>
        <input
          className="tw-form-inputs tw-px-3 tw-py-1"
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
        <label className="tw-block tw-form-label tw-mb-0" htmlFor="description">
          Description:
        </label>
        <RichTextEditor initialValue={description} ref={markdownRef} />
      </Field>
      <Field>
        <label className="tw-block tw-form-label tw-mb-0">Teams:</label>
        <DropDown
          className={classNames('tw-bg-white', {
            'tw-bg-gray-100 tw-cursor-not-allowed': teams.length === 0,
          })}
          dropDownList={getDropdownOptions(teams) as DropDownListItem[]}
          label="Teams"
          selectedItems={selectedTeams as Array<string>}
          type="checkbox"
          onSelect={(_e, value) => selectedTeamsHandler(value)}
        />
      </Field>
      <Field>
        <label className="tw-block tw-form-label tw-mb-0" htmlFor="role">
          Roles:
        </label>
        <DropDown
          className={classNames('tw-bg-white', {
            'tw-bg-gray-100 tw-cursor-not-allowed': roles.length === 0,
          })}
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
              if (allowAccess) {
                setIsAdmin((prev) => !prev);
                setIsBot(false);
              }
            }}>
            <div className="switch" />
          </div>
        </div>
        <div className="tw-flex tw-pt-1">
          <label>Bot</label>
          <div
            className={classNames('toggle-switch', { open: isBot })}
            data-testid="bot"
            onClick={() => {
              if (allowAccess) {
                setIsBot((prev) => !prev);
                setIsAdmin(false);
              }
            }}>
            <div className="switch" />
          </div>
        </div>
      </Field>
      <Field className="tw-flex tw-justify-end">
        <Button
          data-testid="cancel-user"
          size="regular"
          theme="primary"
          variant="text"
          onClick={onCancel}>
          Discard
        </Button>
        {getSaveButton()}
      </Field>
    </PageLayout>
  );
};

export default CreateUser;
