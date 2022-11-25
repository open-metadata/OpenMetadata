import { HTMLAttributes } from 'react';

export interface EntityDeleteModalProp extends HTMLAttributes<HTMLDivElement> {
  onConfirm: () => void;
  onCancel: () => void;
  entityName: string;
  entityType: string;
  loadingState: string;
  bodyText?: string;
  softDelete?: boolean;
  visible: boolean;
}
