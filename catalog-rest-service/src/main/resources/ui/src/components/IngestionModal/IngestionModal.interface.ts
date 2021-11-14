interface ServiceData {
  serviceType: string;
  name: string;
}

export interface IngestionModalProps {
  serviceList: Array<ServiceData>;
  header: string;
  onSave: () => void;
  onCancel: () => void;
}
