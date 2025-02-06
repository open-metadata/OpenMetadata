{{- range . }}
  <h2> 🛡️ TRIVY SCAN RESULT 🛡️ </h2>
  <h4> Target: <code>{{ .Target }}</code></h4>
  {{- if .Vulnerabilities }}
    <h4>Vulnerabilities ({{ len .Vulnerabilities }})</h4>
    <table border="1" cellspacing="0" cellpadding="5">
      <thead>
        <tr>
          <th>Package</th>
          <th>Vulnerability ID</th>
          <th>Severity</th>
          <th>Installed Version</th>
          <th>Fixed Version</th>
        </tr>
      </thead>
      <tbody>
      {{- range .Vulnerabilities }}
        <tr>
          <td><code>{{ .PkgName }}</code></td>
          <td><a href="{{ .PrimaryURL }}" target="_blank">{{ .VulnerabilityID }}</a></td>
          <td>
            {{- if eq .Severity "CRITICAL" }} 🔥 CRITICAL 
            {{- else if eq .Severity "HIGH" }} 🚨 HIGH 
            {{- else }} {{ .Severity }} {{- end }}
          </td>
          <td>{{ .InstalledVersion }}</td>
          <td>{{ if .FixedVersion }}{{ .FixedVersion }}{{ else }}N/A{{ end }}</td>
        </tr>
      {{- end }}
      </tbody>
    </table>
  {{- else }}
    <h4>No Vulnerabilities Found</h4>
  {{- end }}
{{- end }}
