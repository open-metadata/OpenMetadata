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
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { createElement } from 'react';
import InterfaceModeMenuItem from '../components/AppModeSwitcher/InterfaceModeMenuItem';
import { HELP_ITEMS } from '../constants/Navbar.constants';

class NavbarUtilClassBase {
  public getHelpItems() {
    return HELP_ITEMS;
  }

  // The Classic->AI interface switch ships through this hook (rather than
  // hardcoded in UserProfileIcon) so white-label builds can replace it with a
  // gated variant by overriding this method.
  public getUserProfileExtraItems(): ItemType[] {
    return [
      {
        key: 'app-mode',
        icon: '',
        label: createElement(InterfaceModeMenuItem),
        type: 'group',
      },
    ];
  }
}

const navbarUtilClassBase = new NavbarUtilClassBase();

export default navbarUtilClassBase;
export { NavbarUtilClassBase };
