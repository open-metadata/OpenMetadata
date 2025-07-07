```yaml {% srNumber=153 %}
          type: service_account
          projectId: project-id # ["project-id-1", "project-id-2"]
          privateKeyId: abc123
          privateKey: |
            -----BEGIN PRIVATE KEY-----
            Super secret key
            -----END PRIVATE KEY-----
          clientEmail: role@project.iam.gserviceaccount.com
          clientId: "1234"
          # authUri: https://accounts.google.com/o/oauth2/auth (default)
          # tokenUri: https://oauth2.googleapis.com/token (default)
          # authProviderX509CertUrl: https://www.googleapis.com/oauth2/v1/certs (default)
          clientX509CertUrl: https://www.googleapis.com/robot/v1/metadata/x509/role%40project.iam.gserviceaccount.com
```
