import {
  Operation,
  Permission,
} from '../../generated/entity/policies/accessControl/resourcePermission';

export interface PermissionMap {
  [key: string]: Permission[];
}

export type OperationPermission = {
  [key in Operation]: boolean;
};
