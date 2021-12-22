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

import { makeAutoObservable } from 'mobx';
import { ClientAuth, NewUser } from 'Models';
import { CurrentTourPageType } from './enums/tour.enum';
import { User } from './generated/entity/teams/user';
import { UserTeam } from './interface/team.interface';

class AppState {
  users: Array<User> = [];
  newUser: NewUser = {} as NewUser;
  authDisabled = false;
  authProvider: ClientAuth = {
    authority: '',
    // eslint-disable-next-line @typescript-eslint/camelcase
    client_id: '',
    signingIn: false,
  };
  userDetails: User = {} as User;
  userTeams: Array<UserTeam> = [];

  inPageSearchText = '';
  explorePageTab = 'tables';

  isTourOpen = false;
  currentTourPage: CurrentTourPageType = CurrentTourPageType.MY_DATA_PAGE;
  activeTabforTourDatasetPage = 1;

  constructor() {
    makeAutoObservable(this);
  }
}

export default new AppState();
