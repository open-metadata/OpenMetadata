---
title: GKE Setup Troubleshooting
slug: /deployment/kubernetes/gke-troubleshooting
---

# GKE Setup Troubleshooting

If you came across `invalid access type while creating the pvc`, and the permission pod is stuck in "pending" state.

The above error might have occurred due to the pvc volumes not setup or pvc volumes are not mounted properly.

{% image
  src="/images/v1.0/deployment/troubleshoot/dag-log.png"
  alt="dag-log" /%}
{% image
  src="/images/v1.0/deployment/troubleshoot/permission-pod-events.png"
  alt="permission-pod-events"
  caption="Permission pod events" /%}

Please validate:
- all the prerequisites mentioned in this [section](/deployment/kubernetes/gke)
- the configuration of `dags_pv_pvc.yml` file
- `storageClassName` field in YAML file
