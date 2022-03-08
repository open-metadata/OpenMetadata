import { LoadingState } from 'Models';
import { CreateGlossary } from '../../generated/api/data/createGlossary';

export interface AddGlossaryProps {
  header: string;
  saveState?: LoadingState;
  allowAccess?: boolean;
  isTagLoading: boolean;
  tagList: string[];
  onCancel: () => void;
  onSave: (data: CreateGlossary) => void;
  fetchTags: () => void;
}
