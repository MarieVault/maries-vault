# Git Configuration Notes

## Authentication Setup
- **GitHub Token Type**: Personal Access Token (Classic)
- **Token Expiration**: 90 days from January 5, 2025
- **Expiration Date**: ~April 5, 2025
- **Token Permissions**: `repo` (full repository access)

## Token Renewal Instructions
When the token expires (~April 2025), follow these steps:

1. Go to https://github.com/settings/tokens
2. Generate new Personal Access Token (Classic)
3. Set expiration for 90 days
4. Select `repo` scope
5. Update remote URL with new token:
   ```bash
   git remote set-url origin https://NEW_TOKEN@github.com/mspeaks/MariesVault.git
   ```

## Current Configuration
- **Repository**: https://github.com/mspeaks/MariesVault
- **Branch**: main
- **User**: marfschen <marfschen@vault.local>
- **Remote**: Configured with token authentication

## Quick Commands
```bash
# Standard workflow
git add .
git commit -m "Your message"
git push origin main

# Check status
git status

# View commits
git log --oneline -5
```

## Last Updated
- January 5, 2025
- Token valid until ~April 5, 2025