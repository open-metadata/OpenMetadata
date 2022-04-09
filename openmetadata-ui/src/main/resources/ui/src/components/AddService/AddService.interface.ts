import { ServiceCategory } from '../../enums/service.enum';
import { DataObj } from '../../interface/service.interface';

export interface AddServiceProps {
  serviceCategory: ServiceCategory;
  onSave: (service: DataObj) => void;
  handleAddIngestion: () => void;
}
