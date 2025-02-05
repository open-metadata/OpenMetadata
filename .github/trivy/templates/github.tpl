{{- range . }}
  <h3>Target <code>{{ .Target }}</code></h3>
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
          <td>{{ .VulnerabilityID }}</td>
          <td>{{ .Severity }}</td>
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