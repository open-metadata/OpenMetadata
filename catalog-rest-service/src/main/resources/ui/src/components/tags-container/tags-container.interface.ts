import { ColumnTags } from 'Models';
import { ReactNode } from 'react';

export type TagsContainerProps = {
  children?: ReactNode;
  editable?: boolean;
  selectedTags: Array<ColumnTags>;
  tagList: Array<string>;
  onSelectionChange: (selectedTags: Array<ColumnTags>) => void;
  onCancel: (event: React.MouseEvent<HTMLElement, MouseEvent>) => void;
};
