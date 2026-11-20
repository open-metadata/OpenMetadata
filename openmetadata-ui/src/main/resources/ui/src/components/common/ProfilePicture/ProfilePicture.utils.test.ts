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
import userClassBase from '../../../utils/UserClassBase';
import { getBotAvatar } from './ProfilePicture.utils';

const bot = { name: 'collateaiapplicationbot', isBot: true } as User;

describe('getBotAvatar', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is undefined for a person', () => {
    expect(
      getBotAvatar('/photo.jpg', 'J', { name: 'jane', isBot: false } as User)
    ).toBeUndefined();
  });

  it('draws a bot with its logo and initials when no icon is registered', () => {
    expect(getBotAvatar('/bot-logo.svg', 'C', bot)).toEqual({
      src: '/bot-logo.svg',
      initials: 'C',
    });
  });

  it('is undefined for a bot with neither an icon nor a logo', () => {
    expect(getBotAvatar(null, 'C', bot)).toBeUndefined();
  });

  it('draws a registered icon with no logo and no initials', () => {
    const BotIcon = () => null;
    jest.spyOn(userClassBase, 'getBotIcon').mockReturnValue(BotIcon);

    expect(getBotAvatar('/bot-logo.svg', 'C', bot)).toEqual({
      placeholderIcon: BotIcon,
    });
  });
});
