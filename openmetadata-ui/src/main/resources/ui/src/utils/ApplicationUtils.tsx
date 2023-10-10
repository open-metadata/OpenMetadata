import { StatusType } from '../components/common/StatusBadge/StatusBadge.interface';
import { Status } from '../generated/entity/applications/appRunRecord';

export const getStatusTypeForApplication = (status: Status) => {
  if (status === Status.Failed) {
    return StatusType.Failure;
  } else if (status === Status.Success) {
    return StatusType.Success;
  } else if (status === Status.Running) {
    return StatusType.Warning;
  }
  return StatusType.Failure;
};
