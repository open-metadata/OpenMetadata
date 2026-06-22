export interface LogViewerModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  logs: string;
  loading?: boolean;
  theme?: 'dark' | 'light';
  follow?: boolean;
  enableSearch?: boolean;
  enableCopy?: boolean;
  onDownload?: () => void;
}
