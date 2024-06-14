/*
 *  Copyright 2024 Collate.
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
import { Page } from '@playwright/test';
import { GlobalSettingOptions } from '../../constant/settings';
import { settingClick } from '../../utils/sidebar';
import {
  hardDeleteUserProfilePage,
  restoreUserProfilePage,
  softDeleteUserProfilePage,
} from '../../utils/user';

class UserEntityClass {
  async visitUserListPage(page: Page) {
    await settingClick(page, GlobalSettingOptions.USERS);
  }
  async softDeleteUserProfilePage(
    page: Page,
    userName: string,
    displayName: string
  ) {
    await softDeleteUserProfilePage(page, userName, displayName);
  }

  async restoreUserProfilePage(page: Page, fqn: string) {
    await restoreUserProfilePage(page, fqn);
  }
  async hardDeleteUserProfilePage(page: Page, displayName: string) {
    await hardDeleteUserProfilePage(page, displayName);
  }
}

export default UserEntityClass;
