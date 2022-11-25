import { LoadingState } from 'Models';
import { ReactNode } from 'react';

export interface ConfirmationModalProps {
  className?: string;
  loadingState?: LoadingState;
  cancelText: string | ReactNode;
  confirmText: string | ReactNode;
  bodyText: string | ReactNode;
  header: string;
  visible: boolean;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  confirmButtonCss?: string;
  cancelButtonCss?: string;
  onConfirm: () => void;
  onCancel: () => void;
}
