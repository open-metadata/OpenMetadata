import { EntityReference } from '../../../generated/type/entityReference';

export type ReviewerModalProp = {
  reviewer?: Array<EntityReference>;
  onCancel: () => void;
  onSave: (reviewer: Array<EntityReference>) => void;
  header: string;
  visible: boolean;
};
