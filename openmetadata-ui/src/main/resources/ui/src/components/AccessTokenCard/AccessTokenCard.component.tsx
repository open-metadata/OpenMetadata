/*
 *  Copyright 2023 Collate.
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
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { FC } from 'react';
import { AuthenticationMechanism } from '../../generated/entity/teams/user';
import AuthMechanism from '../BotDetails/AuthMechanism';
import AuthMechanismForm from '../BotDetails/AuthMechanismForm';
import { MockProps } from './AccessTokenCard.interfaces';

const AccessTokenCard: FC<MockProps> = ({
  authenticationMechanism,
  isUpdating,
  isAuthMechanismEdit,
  hasPermission,
  onEdit,
  onTokenRevoke,
  onCancel,
  onSave,
  isBot,
}) => {
  return (
    <>
      {authenticationMechanism ? (
        <>
          {isAuthMechanismEdit ? (
            <AuthMechanismForm
              authenticationMechanism={authenticationMechanism}
              isBot={isBot}
              isUpdating={isUpdating}
              onCancel={onCancel}
              onSave={onSave}
            />
          ) : (
            <AuthMechanism
              authenticationMechanism={authenticationMechanism}
              hasPermission={hasPermission}
              isBot={isBot}
              onEdit={onEdit}
              onTokenRevoke={onTokenRevoke}
            />
          )}
        </>
      ) : (
        <AuthMechanismForm
          authenticationMechanism={{} as AuthenticationMechanism}
          isBot={isBot}
          isUpdating={isUpdating}
          onCancel={onCancel}
          onSave={onSave}
        />
      )}
    </>
  );
};

export default AccessTokenCard;
