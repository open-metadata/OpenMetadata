import { AppMarketPlaceDefinition } from '../../../generated/entity/applications/marketplace/appMarketPlaceDefinition';

export interface AppInstallVerifyCardProps {
  appData: AppMarketPlaceDefinition;
  onSave: () => void;
  onCancel: () => void;
}
