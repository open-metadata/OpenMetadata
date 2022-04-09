import { DynamicFormFieldType } from 'Models';
import { ServiceCategory } from '../../../enums/service.enum';

export type SelectServiceTypeProps = {
  showError: boolean;
  serviceCategory: ServiceCategory;
  serviceCategoryHandler: (category: ServiceCategory) => void;
  selectServiceType: string;
  handleServiceTypeClick: (type: string) => void;
  onCancel: () => void;
  onNext: () => void;
};

export type ConfigureServiceProps = {
  serviceName: string;
  description: string;
  showError: {
    name: boolean;
    duplicateName: boolean;
  };
  handleValidation: (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  onBack: () => void;
  onNext: (description: string) => void;
};

export type ConnectionDetailsProps = {
  serviceCategory: ServiceCategory;
  url: string;
  port: string;
  database: string;
  username: string;
  password: string;
  selectedService: string;
  warehouse: string;
  account: string;
  brokers: string;
  schemaRegistry: string;
  pipelineUrl: string;
  dashboardUrl: string;
  env: string;
  apiVersion: string;
  server: string;
  siteName: string;
  apiKey: string;
  connectionOptions: DynamicFormFieldType[];
  connectionArguments: DynamicFormFieldType[];
  addConnectionOptionFields: () => void;
  removeConnectionOptionFields: (id: number) => void;
  handleConnectionOptionFieldsChange: (
    i: number,
    field: keyof DynamicFormFieldType,
    value: string
  ) => void;
  addConnectionArgumentFields: () => void;
  removeConnectionArgumentFields: (id: number) => void;
  handleConnectionArgumentFieldsChange: (
    i: number,
    field: keyof DynamicFormFieldType,
    value: string
  ) => void;
  handleValidation: (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  onBack: () => void;
  onSubmit: () => void;
};
