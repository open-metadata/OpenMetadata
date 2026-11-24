/*
 *  Copyright 2026 Collate.
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
import { ReactNode } from 'react';
import { getEntityName } from '../../utils/EntityNameUtils';
import { useUserProfile } from './useUserProfile';

/**
 * Label for a user reference: a non-empty displayName, else the user's resolved display name,
 * else the login. Fetches the user through useUserProfile, which shares its cache with
 * ProfilePicture, so a card that also shows the avatar makes no extra request.
 */
export const useUserLabel = ({
  userName,
  displayName,
  enabled,
}: {
  userName: string;
  displayName?: ReactNode;
  enabled: boolean;
}): ReactNode => {
  // A passed displayName is the label, so there is nothing to look up.
  const [, , storedUser] = useUserProfile({
    permission: enabled && !displayName,
    name: userName,
  });

  return displayName || getEntityName(storedUser) || userName;
};
