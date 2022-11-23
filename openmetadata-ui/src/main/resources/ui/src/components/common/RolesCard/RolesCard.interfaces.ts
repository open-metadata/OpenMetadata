import { Role } from '../../../generated/entity/teams/role';
import { User } from '../../../generated/entity/teams/user';
import { UserDetails } from '../../Users/Users.interface';

export interface RolesComponentProps {
  roles: Array<Role>;
  userData: User;
  updateUserDetails: (data: UserDetails) => Promise<void>;
  selectedRoles: Array<string>;
  setSelectedRoles: (selectedRoles: string[]) => void;
}
