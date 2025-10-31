import pyotp
import base64
import requests
import json
import hashlib

email = "yibeltalmarie7794@gmail.com"

# Build the secret string
secret = (email + "HENNGECHALLENGE004").encode()
secret_b32 = base64.b32encode(secret)

# Generate TOTP dynamically
totp = pyotp.TOTP(secret_b32, digits=10, interval=30, digest=hashlib.sha512)
current_code = totp.now()  # This is the correct 10-digit token

# Prepare Authorization header
auth_str = f"{email}:{current_code}"
auth_b64 = base64.b64encode(auth_str.encode()).decode()

# POST request
url = "https://api.challenge.hennge.com/challenges/backend-recursion/004"
headers = {
    "Authorization": f"Basic {auth_b64}",
    "Content-Type": "application/json"
}

data = {
    "github_url": "https://gist.github.com/YibeltalMarie/9df7dfb927169740744383afb74caf27",
    "contact_email": email,
    "solution_language": "python"
}

response = requests.post(url, headers=headers, data=json.dumps(data))
print(response.status_code)
print(response.text)
