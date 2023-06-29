import urllib.parse
import sys

# Retrieve the password from command-line argument or environment variable
if len(sys.argv) > 1:
    password = sys.argv[1]
else:
    password = os.getenv("DB_PASSWORD")

# URL encode the password
encoded_password = urllib.parse.quote(password, safe='')

# Add an extra percent sign before each existing percent sign
encoded_password = encoded_password.replace("%", "%%")

# Output the encoded password
print(encoded_password)
