export type EditorContentRef = {
  getEditorContent: () => string;
};

export type ModalWithMarkdownEditorProps = {
  isExpandable?: boolean;
  header: string;
  value: string;
  placeholder: string;
  onSave?: (text: string) => Promise<void>;
  onCancel?: () => void;
  visible: boolean;
};
