import { EntityReference } from '../../../generated/type/entityReference';

export type FollowersModalProps = {
  header: string | React.ReactElement;
  list: EntityReference[];
  onCancel: () => void;
  visible: boolean;
};
