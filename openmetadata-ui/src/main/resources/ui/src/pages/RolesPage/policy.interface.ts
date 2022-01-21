import { Rule } from '../../generated/entity/policies/accessControl/rule';

export interface Policy {
  id: string;
  name: string;
  fullyQualifiedName: string;
  displayName: string;
  description: string;
  href: string;
  policyType: string;
  enabled: boolean;
  version: number;
  updatedAt: number;
  updatedBy: string;
  rules: Rule[];
  deleted: boolean;
}
