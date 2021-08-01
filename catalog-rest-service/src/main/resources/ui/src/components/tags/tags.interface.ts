export type TagProps = {
  className?: string;
  editable?: boolean;
  tag: string;
  type?: 'contained' | 'outlined';
  removeTag?: (
    event: React.MouseEvent<HTMLElement, MouseEvent>,
    removedTag: string
  ) => void;
};
