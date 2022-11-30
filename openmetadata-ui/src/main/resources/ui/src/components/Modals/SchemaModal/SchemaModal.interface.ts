import { HTMLAttributes } from 'react';

export interface SchemaModalProp extends HTMLAttributes<HTMLDivElement> {
  onClose: () => void;
  // eslint-disable-next-line
  data: any;
  visible: boolean;
}
