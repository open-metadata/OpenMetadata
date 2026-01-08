package org.openmetadata.mcp.server.auth.html;

public class HtmlTemplates {

  private static final String LOGIN_FORM_TEMPLATE =
      """
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>OpenMetadata - MCP Authorization</title>
          <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                  background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%);
                  min-height: 100vh;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 20px;
              }
              .login-container {
                  background: white;
                  border-radius: 12px;
                  padding: 40px;
                  max-width: 420px;
                  width: 100%%;
                  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
              }
              h1 {
                  color: #333;
                  margin-bottom: 8px;
                  font-size: 24px;
                  font-weight: 600;
              }
              .subtitle {
                  color: #666;
                  margin-bottom: 30px;
                  font-size: 14px;
                  line-height: 1.5;
              }
              .client-info {
                  background: #f8f9fa;
                  padding: 12px 16px;
                  border-radius: 8px;
                  margin-bottom: 24px;
                  border-left: 3px solid #667eea;
              }
              .client-info strong {
                  color: #667eea;
              }
              .error {
                  background: #fee;
                  color: #c33;
                  padding: 12px 16px;
                  border-radius: 8px;
                  margin-bottom: 20px;
                  border-left: 3px solid #c33;
                  font-size: 14px;
              }
              form {
                  display: flex;
                  flex-direction: column;
              }
              label {
                  color: #333;
                  font-size: 14px;
                  font-weight: 500;
                  margin-bottom: 6px;
                  margin-top: 12px;
              }
              input[type="text"],
              input[type="password"] {
                  padding: 12px 16px;
                  border: 1px solid #ddd;
                  border-radius: 8px;
                  font-size: 15px;
                  transition: all 0.2s;
              }
              input[type="text"]:focus,
              input[type="password"]:focus {
                  outline: none;
                  border-color: #667eea;
                  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
              }
              button {
                  background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%);
                  color: white;
                  padding: 14px 24px;
                  border: none;
                  border-radius: 8px;
                  font-size: 16px;
                  font-weight: 600;
                  cursor: pointer;
                  margin-top: 24px;
                  transition: transform 0.2s, box-shadow 0.2s;
              }
              button:hover {
                  transform: translateY(-2px);
                  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
              }
              button:active {
                  transform: translateY(0);
              }
              .footer {
                  margin-top: 20px;
                  text-align: center;
                  font-size: 12px;
                  color: #999;
              }
              @media (max-width: 480px) {
                  .login-container { padding: 30px 20px; }
                  h1 { font-size: 20px; }
              }
          </style>
      </head>
      <body>
          <div class="login-container">
              <h1>OpenMetadata Authorization</h1>
              <p class="subtitle">%s is requesting access to your OpenMetadata account.</p>
              %s
              <form method="POST" action="/mcp/authorize">
                  <input type="hidden" name="client_id" value="%s">
                  <input type="hidden" name="redirect_uri" value="%s">
                  <input type="hidden" name="state" value="%s">
                  <input type="hidden" name="code_challenge" value="%s">
                  <input type="hidden" name="scopes" value="%s">
                  <input type="hidden" name="response_type" value="code">
                  <input type="hidden" name="code_challenge_method" value="S256">
                  <input type="hidden" name="csrf_token" value="%s">

                  <label for="username">Username or Email</label>
                  <input type="text" id="username" name="username" required autofocus>

                  <label for="password">Password</label>
                  <input type="password" id="password" name="password" required>

                  <button type="submit">Authorize</button>
              </form>
              <div class="footer">
                  Powered by OpenMetadata MCP
              </div>
          </div>
      </body>
      </html>
      """;

  private static final String CODE_DISPLAY_TEMPLATE =
      """
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Authorization Code - OpenMetadata</title>
          <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                  background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%);
                  min-height: 100vh;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 20px;
              }
              .code-container {
                  background: white;
                  border-radius: 12px;
                  padding: 40px;
                  max-width: 560px;
                  width: 100%%;
                  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                  text-align: center;
              }
              .success-icon {
                  font-size: 64px;
                  margin-bottom: 20px;
              }
              h1 {
                  color: #333;
                  margin-bottom: 12px;
                  font-size: 28px;
                  font-weight: 600;
              }
              .instructions {
                  color: #666;
                  margin-bottom: 30px;
                  font-size: 15px;
                  line-height: 1.6;
              }
              .code-box {
                  background: #f8f9fa;
                  border: 2px solid #dee2e6;
                  border-radius: 12px;
                  padding: 24px;
                  margin-bottom: 24px;
                  position: relative;
              }
              .code {
                  font-family: "Monaco", "Courier New", monospace;
                  font-size: 20px;
                  font-weight: 600;
                  color: #667eea;
                  user-select: all;
                  word-break: break-all;
                  line-height: 1.6;
                  padding: 8px;
                  display: block;
              }
              .copy-button {
                  background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%);
                  color: white;
                  padding: 12px 32px;
                  border: none;
                  border-radius: 8px;
                  font-size: 16px;
                  font-weight: 600;
                  cursor: pointer;
                  margin-top: 16px;
                  transition: transform 0.2s, box-shadow 0.2s;
              }
              .copy-button:hover {
                  transform: translateY(-2px);
                  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
              }
              .copy-button:active {
                  transform: translateY(0);
              }
              .copy-button.copied {
                  background: #28a745;
              }
              .expiry {
                  color: #dc3545;
                  font-size: 14px;
                  font-weight: 500;
                  margin-bottom: 16px;
              }
              .next-steps {
                  background: #e7f3ff;
                  border-left: 3px solid #007bff;
                  padding: 16px;
                  border-radius: 8px;
                  text-align: left;
                  margin-top: 24px;
              }
              .next-steps h3 {
                  color: #007bff;
                  font-size: 16px;
                  margin-bottom: 8px;
              }
              .next-steps ol {
                  margin-left: 20px;
                  color: #333;
                  font-size: 14px;
                  line-height: 1.8;
              }
              @media (max-width: 480px) {
                  .code-container { padding: 30px 20px; }
                  h1 { font-size: 24px; }
                  .code { font-size: 16px; }
              }
          </style>
      </head>
      <body>
          <div class="code-container">
              <div class="success-icon">✓</div>
              <h1>Authorization Successful</h1>
              <p class="instructions">Copy the authorization code below and paste it into Claude Desktop:</p>

              <div class="code-box">
                  <code id="auth-code" class="code">%s</code>
                  <button id="copy-btn" class="copy-button" onclick="copyCode()">📋 Copy Code</button>
              </div>

              <p class="expiry">⏱ This code expires in 10 minutes</p>

              <div class="next-steps">
                  <h3>Next Steps:</h3>
                  <ol>
                      <li>Click the "Copy Code" button above</li>
                      <li>Return to Claude Desktop</li>
                      <li>Paste the code when prompted</li>
                      <li>You're all set!</li>
                  </ol>
              </div>
          </div>

          <script>
              function copyCode() {
                  const code = document.getElementById('auth-code').textContent;
                  const button = document.getElementById('copy-btn');

                  navigator.clipboard.writeText(code).then(() => {
                      button.textContent = '✓ Copied!';
                      button.classList.add('copied');
                      setTimeout(() => {
                          button.textContent = '📋 Copy Code';
                          button.classList.remove('copied');
                      }, 3000);
                  }).catch(() => {
                      alert('Please manually select and copy the code.');
                  });
              }

              document.addEventListener('DOMContentLoaded', () => {
                  const codeElement = document.getElementById('auth-code');
                  const range = document.createRange();
                  range.selectNode(codeElement);
                  window.getSelection().removeAllRanges();
                  window.getSelection().addRange(range);
              });
          </script>
      </body>
      </html>
      """;

  public static String generateLoginForm(
      String clientName,
      String errorMessage,
      String clientId,
      String redirectUri,
      String state,
      String codeChallenge,
      String scopes,
      String csrfToken) {

    String errorHtml =
        errorMessage != null && !errorMessage.isEmpty()
            ? "<div class=\"error\">" + escapeHtml(errorMessage) + "</div>"
            : "";

    String safeClientName = escapeHtml(clientName != null ? clientName : "An application");
    String safeClientId = escapeHtml(clientId != null ? clientId : "");
    String safeRedirectUri = escapeHtml(redirectUri != null ? redirectUri : "");
    String safeState = escapeHtml(state != null ? state : "");
    String safeCodeChallenge = escapeHtml(codeChallenge != null ? codeChallenge : "");
    String safeScopes = escapeHtml(scopes != null ? scopes : "");
    String safeCsrfToken = escapeHtml(csrfToken != null ? csrfToken : "");

    return String.format(
        LOGIN_FORM_TEMPLATE,
        safeClientName,
        errorHtml,
        safeClientId,
        safeRedirectUri,
        safeState,
        safeCodeChallenge,
        safeScopes,
        safeCsrfToken);
  }

  public static String generateCodeDisplay(String authCode) {
    String safeAuthCode = escapeHtml(authCode != null ? authCode : "");
    return String.format(CODE_DISPLAY_TEMPLATE, safeAuthCode);
  }

  public static String escapeHtml(String input) {
    if (input == null || input.isEmpty()) {
      return "";
    }
    return input
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&#39;");
  }
}
