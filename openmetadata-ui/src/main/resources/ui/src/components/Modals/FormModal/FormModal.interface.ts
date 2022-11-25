import { FormErrorData } from 'Models';
import { Team } from '../../../generated/entity/teams/team';
import { TagsCategory } from '../../../pages/tags/tagsTypes';

export type FormData = TagsCategory | Team;
export type FormModalProp = {
  onCancel: () => void;
  onChange?: (data: TagsCategory | Team) => void;
  onSave: (data: TagsCategory | Team) => void;
  form: React.ElementType;
  header: string;
  initialData: FormData;
  errorData?: FormErrorData;
  isSaveButtonDisabled?: boolean;
  visible: boolean;
};
export type FormRef = {
  fetchMarkDownData: () => string;
};
