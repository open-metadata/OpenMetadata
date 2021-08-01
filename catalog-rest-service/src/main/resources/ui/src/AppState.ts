import { makeAutoObservable } from 'mobx';
import { ClientAuth, NewUser, User } from 'Models';

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
  userTeams = [];

  inPageSearchText = '';

  constructor() {
    makeAutoObservable(this);
  }
}

export default new AppState();
