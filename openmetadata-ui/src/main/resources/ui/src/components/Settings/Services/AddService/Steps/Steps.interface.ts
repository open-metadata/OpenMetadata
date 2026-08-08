import { ServiceCategoryParam } from '../../../../../constants/ServiceType.constant';
import { ServiceCategory } from '../../../../../enums/service.enum';

export type SelectServiceTypeProps = {
  showError: boolean;
  /**
   * May be the `all` sentinel, in which case the step shows every category's connectors in one
   * grid with no category pre-selected (reached from a category-agnostic Add Service entry point).
   */
  serviceCategory: ServiceCategoryParam;
  serviceCategoryHandler: (category: ServiceCategory) => void;
  /**
   * `category` is the category the clicked connector belongs to — the same as `serviceCategory`
   * for a single-category grid, but any category when the flattened `all` grid is showing.
   */
  handleServiceTypeClick: (type: string, category: ServiceCategory) => void;
};
