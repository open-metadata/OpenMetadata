/*
 *  Copyright 2022 Collate.
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
import { User } from '../../../generated/entity/teams/user';
import userClassBase, { type BotIcon } from '../../../utils/UserClassBase';

export interface BotAvatar {
  initials?: string;
  placeholderIcon?: BotIcon;
  src?: string;
}

// A bot draws its registered icon, else its logo; `undefined` means not a bot
// avatar. Initials stay off the icon case: Avatar draws them ahead of the icon.
export const getBotAvatar = (
  profileURL: string | null,
  initials: string,
  user?: User
): BotAvatar | undefined => {
  if (!user?.isBot) {
    return undefined;
  }
  const placeholderIcon = userClassBase.getBotIcon(user.name);
  if (placeholderIcon) {
    return { placeholderIcon };
  }

  return profileURL ? { src: profileURL, initials } : undefined;
};
