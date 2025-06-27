## Getting an error when install OpenMetadata Dependencies Helm Charts on EKS with EFS

If you are facing the below issue -

```
MountVolume.SetUp failed for volume "openmetadata-dependencies-dags-pv" : rpc error: code = Internal desc = Could not mount "fs-012345abcdef:/airflow-dags" at "/var/lib/kubelet/pods/xyzabc-123-0062-44c3-b0e9-fa193c19f41c/volumes/kubernetes.io~csi/openmetadata-dependencies-dags-pv/mount": mount failed: exit status 1 Mounting command: mount Mounting arguments: -t efs -o tls fs-012345abcdef:/airflow-dags /var/lib/kubelet/pods/xyzabc-123-0062-44c3-b0e9-fa193c19f41c/volumes/kubernetes.io~csi/openmetadata-dependencies-dags-pv/mount Output: Failed to locate an available port in the range [20049, 20449], try specifying a different port range in /etc/amazon/efs/efs-utils.conf
```

This error is typically related to EKS Cluster not able to reach to EFS File systems. You can check the security groups associated between the connectivity EFS and EKS. [Here is an article](https://github.com/kubernetes-sigs/aws-efs-csi-driver/blob/master/docs/efs-create-filesystem.md) which further describes the steps required to create Security Group Rules for EKS to use EFS over `port 2049`.

It can also happen if the mount targets are already available for EKS Nodes but the Nodes do not pick that up. In such cases, you can do an [AWS AutoScaling Group instance refresh](https://docs.aws.amazon.com/autoscaling/ec2/userguide/start-instance-refresh.html) in order for EKS nodes to get the available mount targets.