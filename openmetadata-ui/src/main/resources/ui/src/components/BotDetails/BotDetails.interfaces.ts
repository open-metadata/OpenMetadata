import { HTMLAttributes } from 'react';
import { Bot } from '../../generated/entity/bot';
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
  updateUserDetails: (data: UserDetails) => Promise<void>;
}

export interface DescriptionComponentProps {
  botData: Bot;
}

export interface InheritedRolesComponentProps {
  botUserData: User;
}
