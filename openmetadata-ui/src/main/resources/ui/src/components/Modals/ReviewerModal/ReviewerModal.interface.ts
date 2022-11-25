import { FormattedUsersData } from 'Models';

export type ReviewerModalProp = {
  reviewer?: Array<FormattedUsersData>;
  onCancel: () => void;
  onSave: (reviewer: Array<FormattedUsersData>) => void;
  header: string;
  visible: boolean;
};
