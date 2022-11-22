import { HTMLAttributes } from 'react';
import { Bot } from '../../generated/entity/bot';
import { Role } from '../../generated/entity/teams/role';
import { User } from '../../generated/entity/teams/user';
import { OperationPermission } from '../PermissionProvider/PermissionProvider.interface';
import { UserDetails } from '../Users/Users.interface';

export interface BotsDetailProps extends HTMLAttributes<HTMLDivElement> {
  botUserData: User;
  botData: Bot;
  botPermission: OperationPermission;
  updateBotsDetails: (data: UserDetails) => Promise<void>;
  revokeTokenHandler: () => void;
  onEmailChange: () => void;
  isAdminUser: boolean;
  isAuthDisabled: boolean;
  updateUserDetails: (data: UserDetails) => Promise<void>;
}

export interface DisplayNameComponentProps {
  isDisplayNameEdit: boolean;
  displayName: string | undefined;
  onDisplayNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setIsDisplayNameEdit: (value: boolean) => void;
  handleDisplayNameChange: () => void;
  displayNamePermission: boolean;
  editAllPermission: boolean;
}

export interface DescriptionComponentProps {
  botData: Bot;
}

export interface RolesComponentProps {
  roles: Array<Role>;
  botUserData: User;
}

export interface InheritedRolesComponentProps {
  botUserData: User;
}

export interface RolesElementProps {
  botUserData: User;
}
