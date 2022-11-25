import { CustomProperty, Type } from '../../generated/entity/type';

export interface CustomPropertyTableProp {
  hasAccess: boolean;
  customProperties: CustomProperty[];
  updateEntityType: (
    customProperties: Type['customProperties']
  ) => Promise<void>;
}

export type Operation = 'delete' | 'update' | 'no-operation';
