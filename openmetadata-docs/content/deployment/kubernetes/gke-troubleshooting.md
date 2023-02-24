---
title: GKE Setup Troubleshooting
slug: /deployment/kubernetes/gke-troubleshooting
---

# GKE Setup Troubleshooting

If you came across `invalid access type while creating the pvc`, and the permission pod is stuck in "pending" state.

The above error might have occurred due to the pvc volumes not setup or pvc volumes are not mounted properly.

<div className="w-100 flex justify-center">
<Image
  src="/images/deployment/troubleshoot/dag-log.webp"
  alt="dag-log"
/>
</div>
<div className="w-100 flex justify-center">
<Image
  src="/images/deployment/troubleshoot/permission-pod-events.webp"
  alt="permission-pod-events"
  caption="Permission pod events"
/>
</div>

Please validate:
- all the prerequisites mentioned in this [section](/deployment/kubernetes/gke)
- the configuration of `dags_pv_pvc.yml` file
- `storageClassName` field in YAML file
