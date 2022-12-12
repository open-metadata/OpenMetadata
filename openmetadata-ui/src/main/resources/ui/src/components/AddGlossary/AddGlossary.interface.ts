import { LoadingState } from 'Models';
import { CreateGlossary } from '../../generated/api/data/createGlossary';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';

export interface AddGlossaryProps {
  header: string;
  saveState?: LoadingState;
  allowAccess?: boolean;
  isTagLoading?: boolean;
  tagList?: string[];
  slashedBreadcrumb: TitleBreadcrumbProps['titleLinks'];
  onCancel: () => void;
  onSave: (data: CreateGlossary) => void;
  fetchTags?: () => void;
}

export enum AddGlossaryError {
  NAME_REQUIRED = 'name required',
  NAME_INVALID = 'name invalid',
  DESCRIPTION_REQUIRED = 'description required',
}
