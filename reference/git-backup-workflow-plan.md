# Git Backup & Workflow Implementation Plan

**Date Created**: November 2, 2025
**Date Updated**: November 2, 2025
**Status**: Planning Phase - User Preferences Set
**Current Setup**: Git NOT YET initialized (needs setup)
**User Choice**: Option 3 - Smart Backups (only when changes exist)

## Executive Summary

Implement a comprehensive Git backup workflow to ensure code safety, enable easy rollbacks, and maintain development history. This includes automated backups, branching strategy, and commit conventions.

### User's Backup Strategy Decision

**Selected: Option 3 - Smart Automated Backups**
- ✅ Automated backups on a schedule (weekly recommended)
- ✅ Only commits when there are actual changes
- ✅ Skips silently when nothing has changed
- ✅ Manual backup commands available anytime
- ✅ No unnecessary commits cluttering history

**Rationale**: Since the app isn't actively developed daily, smart backups provide:
- Safety net for forgotten changes
- No spam commits when nothing changes
- Flexibility to backup manually when working
- Efficient use of Git history

---

## Current Git Status

### Existing Configuration
- **Repository**: https://github.com/mspeaks/MariesVault
- **Branch**: main
- **Remote**: Configured with Personal Access Token
- **User**: marfschen <marfschen@vault.local>
- **Token Expires**: ~April 5, 2025

### Current Issues
- [ ] **Git repository not initialized** (BLOCKER - must do first)
- [ ] No remote connection to GitHub configured
- [ ] No regular backup schedule
- [ ] No branching strategy documented
- [ ] No commit message conventions
- [ ] No automated backup system
- [ ] Token expiration not monitored
- [ ] No pre-commit hooks for safety
- [ ] No backup verification

---

## Implementation Phases

## Phase 0: Git Initialization (REQUIRED FIRST)

**Estimated Time**: 15-30 minutes

### 0.1: Initialize Git Repository

```bash
cd /root/maries-vault-migration/maries-vault

# Initialize Git
git init

# Configure user
git config user.name "marfschen"
git config user.email "marfschen@vault.local"

# Add remote (replace YOUR_TOKEN with actual GitHub token)
git remote add origin https://YOUR_TOKEN@github.com/mspeaks/MariesVault.git

# Verify configuration
git config --list
git remote -v
```

### 0.2: Initial Commit

```bash
# Check what will be committed
git status

# Add all files (respecting .gitignore)
git add .

# Create initial commit
git commit -m "Initial commit: Marie's Vault application

Base application setup from migration.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"

# Push to GitHub
git push -u origin main
```

### 0.3: Verify Setup

```bash
# Check status
git status

# View commit
git log --oneline

# Test connection
git fetch origin
```

### Testing Checklist
- [ ] Git initialized (.git directory exists)
- [ ] User configured correctly
- [ ] Remote added and accessible
- [ ] Initial commit created
- [ ] Code pushed to GitHub successfully
- [ ] Can fetch from remote

---

## Phase 1: Backup Strategy & Automation

**Estimated Time**: 2-3 hours

### 1.1: Daily Automated Backups

#### Create Backup Script

**File**: `scripts/backup.sh`

```bash
#!/bin/bash

# Marie's Vault - Daily Backup Script
# Purpose: Commit and push changes to GitHub for backup

set -e # Exit on error

echo "🔄 Starting daily backup..."

# Navigate to project directory
cd /root/maries-vault-migration/maries-vault

# Check if there are changes
if [[ -z $(git status -s) ]]; then
  echo "✅ No changes to backup"
  exit 0
fi

# Get current date and time
BACKUP_DATE=$(date '+%Y-%m-%d %H:%M:%S')

# Show what will be backed up
echo "📋 Changes to backup:"
git status -s

# Add all changes
git add .

# Create backup commit
git commit -m "Automated backup: $BACKUP_DATE

Automated daily backup of Marie's Vault.
This commit captures all uncommitted changes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"

# Push to remote
echo "☁️  Pushing to GitHub..."
git push origin main

echo "✅ Backup completed successfully!"
echo "📅 Backup time: $BACKUP_DATE"
```

#### Make Script Executable
```bash
chmod +x /root/maries-vault-migration/maries-vault/scripts/backup.sh
```

### 1.2: Schedule Automated Backups

#### ✅ SELECTED: Weekly Smart Backups (Cron Job)

**User's Choice**: Weekly backups that only commit when changes exist.

```bash
# Edit crontab
crontab -e

# Add weekly backup (Sundays at 3 AM) - USER'S PREFERRED SCHEDULE
0 3 * * 0 /root/maries-vault-migration/maries-vault/scripts/backup.sh >> /var/log/marie-vault-backup.log 2>&1
```

**Why this works:**
- Script checks for changes before committing (already built-in)
- If no changes: exits silently, no commit created
- If changes found: commits and pushes automatically
- Weekly schedule catches forgotten changes without spam

#### Alternative Schedules (Not Selected)

```bash
# Daily backup at 2 AM (NOT using - overkill for this app)
# 0 2 * * * /root/maries-vault-migration/maries-vault/scripts/backup.sh >> /var/log/marie-vault-backup.log 2>&1

# Backup every 6 hours (NOT using - too frequent)
# 0 */6 * * * /root/maries-vault-migration/maries-vault/scripts/backup.sh >> /var/log/marie-vault-backup.log 2>&1

# Monthly backup (first of month at 3 AM) - could use if prefer less frequent
# 0 3 1 * * /root/maries-vault-migration/maries-vault/scripts/backup.sh >> /var/log/marie-vault-backup.log 2>&1
```

#### ❌ Alternative: Systemd Timer (Not Selected)

**Note**: User prefers simple cron job approach.

**File**: `/etc/systemd/system/marie-vault-backup.service`

```ini
[Unit]
Description=Marie's Vault Daily Backup
After=network.target

[Service]
Type=oneshot
User=root
ExecStart=/root/maries-vault-migration/maries-vault/scripts/backup.sh
StandardOutput=journal
StandardError=journal
```

**File**: `/etc/systemd/system/marie-vault-backup.timer`

```ini
[Unit]
Description=Marie's Vault Backup Timer
Requires=marie-vault-backup.service

[Timer]
OnCalendar=daily
OnCalendar=02:00
Persistent=true

[Install]
WantedBy=timers.target
```

**Enable timer:**
```bash
systemctl enable marie-vault-backup.timer
systemctl start marie-vault-backup.timer
systemctl status marie-vault-backup.timer
```

### 1.3: Manual Backup Command

**File**: `package.json` (add to scripts)

```json
{
  "scripts": {
    "backup": "bash scripts/backup.sh",
    "backup:status": "git status",
    "backup:log": "git log --oneline -10"
  }
}
```

**Usage:**
```bash
npm run backup          # Quick backup command
npm run backup:status   # Check what needs backup
npm run backup:log      # View recent backups
```

### Testing Checklist
- [ ] Backup script runs without errors
- [ ] Cron job scheduled correctly
- [ ] Log file created and written to
- [ ] Changes committed with proper message
- [ ] Changes pushed to GitHub
- [ ] npm scripts work

---

## Phase 2: Branching Strategy

**Estimated Time**: 1 hour

### 2.1: Branch Naming Conventions

#### Main Branches
- `main` - Production-ready code
- `develop` - Development integration branch (optional)

#### Feature Branches
```
feature/<feature-name>
  Examples:
  - feature/merge-tags-keywords
  - feature/user-authentication
  - feature/bulk-tag-editor
```

#### Bugfix Branches
```
bugfix/<issue-description>
  Examples:
  - bugfix/tag-emoji-display
  - bugfix/search-case-sensitivity
  - bugfix/image-upload-error
```

#### Hotfix Branches
```
hotfix/<critical-issue>
  Examples:
  - hotfix/security-vulnerability
  - hotfix/database-connection
  - hotfix/data-loss-prevention
```

#### Refactor Branches
```
refactor/<component-name>
  Examples:
  - refactor/entry-card-component
  - refactor/api-routes
  - refactor/database-queries
```

### 2.2: Branch Workflow

#### Starting New Work

```bash
# Update main branch
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/your-feature-name

# Work on your changes...
# (make commits as you go)

# When ready to merge back
git checkout main
git pull origin main
git merge feature/your-feature-name

# Push to GitHub
git push origin main

# Delete feature branch (optional)
git branch -d feature/your-feature-name
```

#### Quick Reference Commands

**File**: `scripts/git-commands.sh`

```bash
#!/bin/bash
# Quick Git command reference for Marie's Vault

# Start new feature
function git-start-feature() {
  git checkout main
  git pull origin main
  git checkout -b "feature/$1"
  echo "✅ Started feature branch: feature/$1"
}

# Start bugfix
function git-start-bugfix() {
  git checkout main
  git pull origin main
  git checkout -b "bugfix/$1"
  echo "✅ Started bugfix branch: bugfix/$1"
}

# Finish and merge current branch
function git-finish-branch() {
  CURRENT_BRANCH=$(git branch --show-current)
  if [[ "$CURRENT_BRANCH" == "main" ]]; then
    echo "❌ Already on main branch"
    return 1
  fi

  echo "🔄 Merging $CURRENT_BRANCH into main..."
  git checkout main
  git pull origin main
  git merge "$CURRENT_BRANCH"
  git push origin main

  echo "✅ Branch merged successfully!"
  echo "🗑️  Delete branch? (y/n)"
  read -r response
  if [[ "$response" == "y" ]]; then
    git branch -d "$CURRENT_BRANCH"
    echo "✅ Branch deleted"
  fi
}

# Save work in progress
function git-wip() {
  git add .
  git commit -m "WIP: $(date '+%Y-%m-%d %H:%M')"
  echo "✅ Work in progress saved"
}

# Quick status
function git-st() {
  echo "📊 Git Status:"
  git status -s
  echo ""
  echo "🌿 Current Branch: $(git branch --show-current)"
  echo "📝 Recent Commits:"
  git log --oneline -3
}

# Usage examples:
# git-start-feature "merge-tags-keywords"
# git-start-bugfix "tag-display-error"
# git-wip
# git-finish-branch
# git-st
```

**Add to `.bashrc` or `.zshrc`:**
```bash
source /root/maries-vault-migration/maries-vault/scripts/git-commands.sh
```

### Testing Checklist
- [ ] Can create feature branch
- [ ] Can merge branch back to main
- [ ] Helper functions work
- [ ] Branch naming consistent

---

## Phase 3: Commit Message Conventions

**Estimated Time**: 30 minutes

### 3.1: Commit Message Format

#### Template
```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Types
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring (no functional changes)
- `style`: Code style changes (formatting, whitespace)
- `docs`: Documentation changes
- `test`: Adding or updating tests
- `chore`: Build tasks, dependencies, configs
- `perf`: Performance improvements
- `db`: Database schema or migration changes

#### Examples

```bash
# Good commit messages:
git commit -m "feat(tags): add unified tag system with user-added tags

- Merge keywords functionality into tags
- Add user_tags column to custom_entries
- Implement override vs additive tag modes
- Add visual distinction (gray vs blue badges)

Closes #42"

git commit -m "fix(entry-card): tag emoji not displaying correctly

Tag emojis were not loading due to incorrect API endpoint.
Fixed by updating emoji fetch logic to use batch endpoint.

Fixes #38"

git commit -m "refactor(api): consolidate tag and keyword endpoints

- Remove /api/keyword-emojis endpoints
- Update /api/tags to include user tags
- Simplify emoji fetching logic"

git commit -m "db: add user_tags column and migrate keywords

Migration: 0002_merge_keywords_to_tags.sql
- Add custom_entries.user_tags column
- Copy keywords data to user_tags
- Merge keyword_emojis into tag_emojis"

# Bad commit messages (avoid these):
git commit -m "fixed stuff"
git commit -m "update"
git commit -m "wip"
git commit -m "made changes"
```

### 3.2: Commit Message Template

**Create**: `.gitmessage`

```
# <type>(<scope>): <subject>
#
# <body>
#
# <footer>
#
# Types:
#   feat:     New feature
#   fix:      Bug fix
#   refactor: Code refactoring
#   style:    Formatting changes
#   docs:     Documentation
#   test:     Tests
#   chore:    Build/config changes
#   perf:     Performance improvements
#   db:       Database changes
#
# Scope: tags, entries, api, ui, search, auth, etc.
#
# Subject: Short summary (50 chars or less)
# Body: Detailed explanation (wrap at 72 chars)
# Footer: References to issues (Closes #123, Fixes #456)
#
# Example:
# feat(tags): add emoji picker to tag page
#
# - Implemented emoji selection UI
# - Added POST /api/tag-emojis endpoint
# - Emoji displays next to tag name
#
# Closes #42
```

**Configure Git to use template:**
```bash
git config --local commit.template .gitmessage
```

### Testing Checklist
- [ ] Commit template configured
- [ ] Test commit follows format
- [ ] Message is clear and descriptive

---

## Phase 4: Safety & Pre-commit Checks

**Estimated Time**: 1-2 hours

### 4.1: Pre-commit Hook for Safety

**File**: `.git/hooks/pre-commit`

```bash
#!/bin/bash
# Marie's Vault Pre-commit Hook
# Prevents committing sensitive data and runs basic checks

echo "🔍 Running pre-commit checks..."

# Check for sensitive files
SENSITIVE_PATTERNS=(
  "\.env$"
  "cookies\.txt$"
  "JWT_SECRET"
  "password"
  "secret"
  "token"
  "api[_-]?key"
  "credentials"
)

echo "🔒 Checking for sensitive data..."
for pattern in "${SENSITIVE_PATTERNS[@]}"; do
  if git diff --cached --name-only | grep -iE "$pattern"; then
    echo "❌ ERROR: Attempting to commit sensitive file matching pattern: $pattern"
    echo "   Remove sensitive files from commit with: git reset HEAD <file>"
    exit 1
  fi
done

# Check for .env file changes
if git diff --cached --name-only | grep -E "^\.env$"; then
  echo "⚠️  WARNING: .env file is staged for commit"
  echo "   This file should not be committed (use .env.example instead)"
  echo "   Continue anyway? (y/n)"
  read -r response
  if [[ "$response" != "y" ]]; then
    exit 1
  fi
fi

# Check for large files (> 10MB)
echo "📦 Checking for large files..."
for file in $(git diff --cached --name-only); do
  if [ -f "$file" ]; then
    size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0)
    if [ "$size" -gt 10485760 ]; then
      echo "❌ ERROR: File too large (>10MB): $file"
      echo "   Consider using Git LFS for large files"
      exit 1
    fi
  fi
done

# Check for debugging code
echo "🐛 Checking for debug code..."
if git diff --cached | grep -E "(console\.log|debugger|TODO|FIXME|XXX)"; then
  echo "⚠️  WARNING: Debug code or TODOs found in staged changes"
  echo "   Review before committing"
  echo "   Continue anyway? (y/n)"
  read -r response
  if [[ "$response" != "y" ]]; then
    exit 1
  fi
fi

# Check for merge conflict markers
echo "🔀 Checking for merge conflicts..."
if git diff --cached | grep -E "^(<<<<<<<|=======|>>>>>>>)"; then
  echo "❌ ERROR: Merge conflict markers found"
  echo "   Resolve conflicts before committing"
  exit 1
fi

# Run TypeScript type check (if applicable)
if command -v npm &> /dev/null; then
  echo "🔧 Running TypeScript checks..."
  if ! npm run type-check 2>/dev/null; then
    echo "⚠️  WARNING: TypeScript type check failed"
    echo "   Continue anyway? (y/n)"
    read -r response
    if [[ "$response" != "y" ]]; then
      exit 1
    fi
  fi
fi

echo "✅ Pre-commit checks passed!"
exit 0
```

**Make executable:**
```bash
chmod +x /root/maries-vault-migration/maries-vault/.git/hooks/pre-commit
```

### 4.2: Git Ignore Updates

**File**: `.gitignore` (verify/update)

```
# Dependencies
node_modules/
.npm
.yarn

# Build outputs
dist/
build/
.next/

# Environment files
.env
.env.local
.env.*.local
*.env

# Logs
logs/
*.log
npm-debug.log*
server.log

# OS files
.DS_Store
Thumbs.db

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# Sensitive data
cookies.txt
credentials.json
*.pem
*.key
secrets/

# Database
*.sqlite
*.sqlite-journal
*.db

# Uploads (if not using Git LFS)
uploads/
attached_assets/

# Temporary files
tmp/
temp/
*.tmp

# PM2
ecosystem.config.cjs
.pm2/

# Testing
coverage/
.nyc_output/

# Backup files
*.backup
*.bak
```

### 4.3: Add Type Checking Script

**File**: `package.json` (add script)

```json
{
  "scripts": {
    "type-check": "tsc --noEmit"
  }
}
```

### Testing Checklist
- [ ] Pre-commit hook blocks .env file
- [ ] Pre-commit hook warns about debug code
- [ ] Pre-commit hook checks file sizes
- [ ] .gitignore covers sensitive files
- [ ] Type check script works

---

## Phase 5: Backup Verification & Recovery

**Estimated Time**: 1 hour

### 5.1: Backup Verification Script

**File**: `scripts/verify-backup.sh`

```bash
#!/bin/bash

# Marie's Vault - Verify Backup Script
# Purpose: Verify GitHub backup is up to date

set -e

echo "🔍 Verifying backup status..."

cd /root/maries-vault-migration/maries-vault

# Fetch latest from remote
git fetch origin main

# Check if local is behind remote
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})
BASE=$(git merge-base @ @{u})

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "✅ Local and remote are in sync"
  echo "📅 Last backup: $(git log -1 --format=%cd)"
  echo "💾 Last commit: $(git log -1 --format=%s)"
elif [ "$LOCAL" = "$BASE" ]; then
  echo "⚠️  Local is behind remote"
  echo "   Run: git pull origin main"
elif [ "$REMOTE" = "$BASE" ]; then
  echo "⚠️  Local is ahead of remote"
  echo "   Uncommitted changes need backup!"
  echo "   Run: npm run backup"
else
  echo "⚠️  Branches have diverged"
  echo "   Manual intervention required"
fi

# Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
  echo ""
  echo "📋 Uncommitted changes detected:"
  git status -s
  echo ""
  echo "⚠️  Run 'npm run backup' to back up these changes"
else
  echo "✅ No uncommitted changes"
fi

# Show last 3 backups
echo ""
echo "📚 Recent backups:"
git log --oneline -3
```

### 5.2: Recovery/Restore Script

**File**: `scripts/restore.sh`

```bash
#!/bin/bash

# Marie's Vault - Restore from Backup Script
# Purpose: Restore to a previous commit

set -e

echo "🔄 Restore from Git Backup"
echo ""

# Show recent commits
echo "📚 Recent commits (last 10):"
git log --oneline -10
echo ""

# Get commit to restore
echo "Enter commit hash to restore to (or 'HEAD~N' for N commits back):"
read -r COMMIT_HASH

if [[ -z "$COMMIT_HASH" ]]; then
  echo "❌ No commit specified"
  exit 1
fi

# Confirm
echo ""
echo "⚠️  WARNING: This will reset your working directory to:"
git log -1 --oneline "$COMMIT_HASH"
echo ""
echo "Any uncommitted changes will be lost!"
echo "Continue? (type 'yes' to confirm)"
read -r CONFIRM

if [[ "$CONFIRM" != "yes" ]]; then
  echo "❌ Restore cancelled"
  exit 0
fi

# Create emergency backup of current state
BACKUP_BRANCH="emergency-backup-$(date +%Y%m%d-%H%M%S)"
git branch "$BACKUP_BRANCH"
echo "📦 Created emergency backup branch: $BACKUP_BRANCH"

# Restore to commit
echo "🔄 Restoring to $COMMIT_HASH..."
git reset --hard "$COMMIT_HASH"

echo "✅ Restored successfully!"
echo ""
echo "📝 Note: Emergency backup saved to branch: $BACKUP_BRANCH"
echo "   To return to this backup: git checkout $BACKUP_BRANCH"
```

### 5.3: Add to package.json

```json
{
  "scripts": {
    "backup:verify": "bash scripts/verify-backup.sh",
    "backup:restore": "bash scripts/restore.sh"
  }
}
```

### Testing Checklist
- [ ] Verify script shows sync status
- [ ] Verify script detects uncommitted changes
- [ ] Restore script creates emergency backup
- [ ] Restore script resets to specified commit

---

## Phase 6: GitHub Token Management

**Estimated Time**: 30 minutes

### 6.1: Token Expiration Reminder

**File**: `scripts/check-token-expiry.sh`

```bash
#!/bin/bash

# Marie's Vault - Token Expiry Check
# Purpose: Remind about GitHub token expiration

TOKEN_EXPIRY="2025-04-05"
TODAY=$(date +%Y-%m-%d)

# Calculate days until expiry
DAYS_UNTIL_EXPIRY=$(( ($(date -d "$TOKEN_EXPIRY" +%s) - $(date -d "$TODAY" +%s)) / 86400 ))

if [ "$DAYS_UNTIL_EXPIRY" -lt 0 ]; then
  echo "❌ GitHub token EXPIRED on $TOKEN_EXPIRY"
  echo "   Generate new token: https://github.com/settings/tokens"
  echo "   Update with: git remote set-url origin https://NEW_TOKEN@github.com/mspeaks/MariesVault.git"
elif [ "$DAYS_UNTIL_EXPIRY" -lt 14 ]; then
  echo "⚠️  GitHub token expires in $DAYS_UNTIL_EXPIRY days ($TOKEN_EXPIRY)"
  echo "   Generate new token soon: https://github.com/settings/tokens"
elif [ "$DAYS_UNTIL_EXPIRY" -lt 30 ]; then
  echo "⏰ GitHub token expires in $DAYS_UNTIL_EXPIRY days ($TOKEN_EXPIRY)"
else
  echo "✅ GitHub token valid for $DAYS_UNTIL_EXPIRY more days"
fi
```

### 6.2: Add Token Check to Backup Script

**Update**: `scripts/backup.sh`

```bash
# Add after cd command:
bash scripts/check-token-expiry.sh
echo ""
```

### 6.3: Token Renewal Guide

**File**: `reference/token-renewal-guide.md`

```markdown
# GitHub Token Renewal Guide

## When Token Expires (~April 5, 2025)

### Step 1: Generate New Token
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Set description: "Marie's Vault - Server Access"
4. Set expiration: 90 days (or longer)
5. Select scope: ✓ `repo` (full repository access)
6. Click "Generate token"
7. **IMPORTANT**: Copy token immediately (you won't see it again)

### Step 2: Update Remote URL
```bash
cd /root/maries-vault-migration/maries-vault

# Update remote with new token
git remote set-url origin https://NEW_TOKEN_HERE@github.com/mspeaks/MariesVault.git

# Verify it works
git pull origin main
```

### Step 3: Update GIT_SETUP.md
```bash
# Update token expiration date in GIT_SETUP.md
# New expiration = today + 90 days
```

### Step 4: Update check-token-expiry.sh
```bash
# Edit scripts/check-token-expiry.sh
# Update TOKEN_EXPIRY variable to new date
```

### Step 5: Test
```bash
# Test backup works
npm run backup

# Test push works
git push origin main
```

## Troubleshooting

### "Authentication failed"
- Token expired or invalid
- Generate new token and update remote URL

### "Permission denied"
- Token doesn't have `repo` scope
- Regenerate with correct permissions

### "Could not resolve host"
- Network connection issue
- Check internet connectivity
```

### Testing Checklist
- [ ] Token expiry check runs correctly
- [ ] Shows days until expiration
- [ ] Warns when close to expiry
- [ ] Renewal guide is clear

---

## Phase 7: Documentation & Best Practices

**Estimated Time**: 30 minutes

### 7.1: Git Workflow Documentation

**File**: `reference/git-workflow.md`

```markdown
# Git Workflow for Marie's Vault

## Daily Workflow

### Starting Work
```bash
# Check backup status
npm run backup:verify

# If behind, pull latest
git pull origin main
```

### During Development
```bash
# Make changes to files...

# Check status frequently
git status

# Stage specific files
git add path/to/file

# Or stage all changes
git add .

# Commit with descriptive message
git commit -m "feat(tags): add tag filtering"

# Push to GitHub
git push origin main
```

### Automated Backups
- Backups run automatically every night at 2 AM
- Manual backup: `npm run backup`
- Verify backup: `npm run backup:verify`

## Feature Development Workflow

### 1. Start Feature
```bash
# Create feature branch
git checkout -b feature/new-feature-name

# Work on feature...
git add .
git commit -m "feat: implement new feature"
```

### 2. Regular Commits
```bash
# Commit frequently with clear messages
git commit -m "feat(component): add specific functionality"
git commit -m "test(component): add unit tests"
git commit -m "docs(component): update documentation"
```

### 3. Merge Back
```bash
# Update main first
git checkout main
git pull origin main

# Merge feature
git merge feature/new-feature-name

# Push to GitHub
git push origin main

# Delete feature branch (optional)
git branch -d feature/new-feature-name
```

## Emergency Recovery

### Undo Last Commit (Keep Changes)
```bash
git reset --soft HEAD~1
```

### Undo Last Commit (Discard Changes)
```bash
git reset --hard HEAD~1
```

### Restore from Backup
```bash
npm run backup:restore
# Follow interactive prompts
```

### Restore Specific File
```bash
git checkout HEAD~1 -- path/to/file
```

## Useful Commands

```bash
# View commit history
git log --oneline -10

# View detailed commit
git show <commit-hash>

# View changes
git diff

# View staged changes
git diff --cached

# Discard changes to file
git checkout -- path/to/file

# Discard all changes
git reset --hard HEAD

# View branches
git branch -a

# Search commits
git log --grep="search term"

# View file history
git log -- path/to/file
```

## Best Practices

1. **Commit Often**: Small, focused commits are better than large ones
2. **Write Clear Messages**: Explain why, not just what
3. **Pull Before Push**: Always pull latest changes first
4. **Review Changes**: Use `git diff` before committing
5. **Don't Commit Secrets**: Never commit .env, tokens, or passwords
6. **Use Branches**: Create branches for experiments or large features
7. **Backup Regularly**: Run manual backups after major changes
8. **Verify Backups**: Check backup status periodically

## Common Mistakes to Avoid

❌ `git add .` without reviewing changes first
✅ `git status` then `git add <specific files>`

❌ Commit messages like "fix" or "update"
✅ "fix(tags): resolve emoji display bug in Safari"

❌ Working directly on main for experiments
✅ Create a branch: `git checkout -b experiment/new-idea`

❌ Forgetting to pull before making changes
✅ Always `git pull origin main` first

❌ Committing .env or sensitive files
✅ Check .gitignore and use pre-commit hooks
```

### 7.2: Update Main README

**Add Git section to README.md:**

```markdown
## Git Backup & Version Control

This project uses Git for version control and automated backups to GitHub.

### Quick Commands

```bash
# Manual backup
npm run backup

# Check backup status
npm run backup:verify

# View recent commits
npm run backup:log

# Restore from backup
npm run backup:restore
```

### Automated Backups

Backups run automatically daily at 2 AM via cron job. All uncommitted changes are committed and pushed to GitHub.

### Git Workflow

See [reference/git-workflow.md](reference/git-workflow.md) for detailed Git workflow documentation.

### Token Management

GitHub access token expires ~April 5, 2025. See [reference/token-renewal-guide.md](reference/token-renewal-guide.md) for renewal instructions.
```

### Testing Checklist
- [ ] Documentation is clear and comprehensive
- [ ] All commands in docs are tested
- [ ] README updated with Git info

---

## Complete Implementation Checklist

### Phase 1: Backup Strategy ✓
- [ ] Create backup.sh script
- [ ] Make script executable
- [ ] Schedule cron job or systemd timer
- [ ] Add npm scripts for backup
- [ ] Test manual backup
- [ ] Test automated backup
- [ ] Verify log file creation

### Phase 2: Branching ✓
- [ ] Document branch naming conventions
- [ ] Create git-commands.sh helper
- [ ] Add helper to shell profile
- [ ] Test branch creation
- [ ] Test branch merging

### Phase 3: Commit Conventions ✓
- [ ] Create .gitmessage template
- [ ] Configure Git to use template
- [ ] Document commit types
- [ ] Provide examples

### Phase 4: Safety ✓
- [ ] Create pre-commit hook
- [ ] Make hook executable
- [ ] Update .gitignore
- [ ] Add type-check script
- [ ] Test pre-commit checks

### Phase 5: Verification ✓
- [ ] Create verify-backup.sh
- [ ] Create restore.sh
- [ ] Add npm scripts
- [ ] Test verification
- [ ] Test restore process

### Phase 6: Token Management ✓
- [ ] Create check-token-expiry.sh
- [ ] Add to backup script
- [ ] Write renewal guide
- [ ] Test expiry check

### Phase 7: Documentation ✓
- [ ] Write git-workflow.md
- [ ] Write token-renewal-guide.md
- [ ] Update README.md
- [ ] Create reference docs

---

## Timeline Estimate

| Phase | Time | Priority |
|-------|------|----------|
| Phase 1: Backup Automation | 2-3 hours | High |
| Phase 2: Branching | 1 hour | Medium |
| Phase 3: Commit Conventions | 30 min | Medium |
| Phase 4: Safety Checks | 1-2 hours | High |
| Phase 5: Verification | 1 hour | High |
| Phase 6: Token Management | 30 min | Medium |
| Phase 7: Documentation | 30 min | Low |
| **Total** | **6-8 hours** | **~1-2 sessions** |

---

## ✅ Quick Start Guide (User's Preferred Setup)

**Implementation Order** (45-60 minutes total):

### Step 1: Initialize Git (REQUIRED FIRST)
```bash
cd /root/maries-vault-migration/maries-vault

# Initialize and configure
git init
git config user.name "marfschen"
git config user.email "marfschen@vault.local"

# Add remote (need GitHub token)
git remote add origin https://YOUR_TOKEN@github.com/mspeaks/MariesVault.git

# Initial commit
git add .
git commit -m "Initial commit: Marie's Vault application"
git push -u origin main
```

### Step 2: Create Backup Script
```bash
# 1. Create scripts directory
mkdir -p /root/maries-vault-migration/maries-vault/scripts

# 2. Create backup.sh (see Phase 1.1 for full script)
# Copy the backup.sh script content

# 3. Make executable
chmod +x /root/maries-vault-migration/maries-vault/scripts/backup.sh

# 4. Test it
bash /root/maries-vault-migration/maries-vault/scripts/backup.sh
```

### Step 3: Schedule Weekly Smart Backups
```bash
# Edit crontab
crontab -e

# Add weekly backup (Sundays at 3 AM)
0 3 * * 0 /root/maries-vault-migration/maries-vault/scripts/backup.sh >> /var/log/marie-vault-backup.log 2>&1
```

### Step 4: Add Manual Backup Command
```bash
# Add to package.json scripts:
# "backup": "bash scripts/backup.sh"

# Now you can run: npm run backup
```

**Done!** You now have:
- ✅ Weekly automated backups (only commits when changes exist)
- ✅ Manual backup command (`npm run backup`)
- ✅ Smart change detection (no spam commits)
- ✅ Safety net for forgotten changes

---

## Success Metrics

### Technical
- [ ] Zero backup failures
- [ ] Daily backups completing successfully
- [ ] Pre-commit hooks catching sensitive data
- [ ] All team members following commit conventions

### Safety
- [ ] No .env files in commit history
- [ ] No large files (>10MB) committed
- [ ] No merge conflicts in pushed commits
- [ ] Emergency recovery tested and working

### Usability
- [ ] Backup status visible (npm run backup:verify)
- [ ] One-command backup (npm run backup)
- [ ] One-command restore (npm run backup:restore)
- [ ] Clear documentation for all workflows

---

## Future Enhancements

### Advanced Backup Features
- [ ] Backup to multiple remotes (GitHub + GitLab)
- [ ] Encrypted backups for sensitive data
- [ ] Database dump automation
- [ ] Backup rotation and pruning
- [ ] Slack/email notifications on backup failures

### CI/CD Integration
- [ ] GitHub Actions for automated testing
- [ ] Automated deployments on push to main
- [ ] Version tagging and releases
- [ ] Changelog generation

### Code Quality
- [ ] ESLint pre-commit checks
- [ ] Prettier code formatting
- [ ] Unit test requirements
- [ ] Code coverage thresholds

---

## Troubleshooting

### Backup Script Fails

**Symptom**: Backup script exits with error

**Solutions**:
```bash
# Check Git status
git status

# Check for uncommitted changes
git diff

# Check remote connection
git remote -v
git fetch origin

# Check token validity
# Run: bash scripts/check-token-expiry.sh
```

### Cron Job Not Running

**Symptom**: Backups not automatic

**Solutions**:
```bash
# Check cron service is running
systemctl status cron

# Check cron logs
grep CRON /var/log/syslog

# Verify crontab entry
crontab -l

# Test script manually
bash /root/maries-vault-migration/maries-vault/scripts/backup.sh
```

### Pre-commit Hook Not Working

**Symptom**: Hook doesn't run on commit

**Solutions**:
```bash
# Check hook exists and is executable
ls -la .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# Test hook manually
.git/hooks/pre-commit
```

### Token Expired

**Symptom**: Authentication failed on push

**Solutions**:
```bash
# Follow token renewal guide
cat reference/token-renewal-guide.md

# Generate new token at: https://github.com/settings/tokens
# Update remote: git remote set-url origin https://NEW_TOKEN@github.com/mspeaks/MariesVault.git
```

---

## Next Steps

1. **Immediate**: Set up basic backup automation (Quick Start Guide)
2. **Week 1**: Implement all safety checks (pre-commit hooks)
3. **Week 2**: Create documentation and establish workflow
4. **Ongoing**: Monitor backups and verify regularly

---

## 📋 User's Final Configuration Summary

**Backup Strategy**: Smart Automated Backups (Option 3)
- Weekly schedule (Sundays at 3 AM)
- Only commits when changes exist
- Manual backup available anytime via `npm run backup`

**Schedule**: Weekly (not daily)
- Cron job approach (not systemd timer)
- Logs to `/var/log/marie-vault-backup.log`

**Priority Phases to Implement**:
1. ✅ Phase 0: Git Initialization (MUST DO FIRST)
2. ✅ Phase 1.1: Create backup.sh script
3. ✅ Phase 1.2: Schedule weekly cron job
4. ✅ Phase 1.3: Add npm scripts
5. ⚠️ Phase 4: Pre-commit hooks (recommended for safety)
6. 📝 Phase 2-3, 5-7: Optional (can implement as needed)

**Not Implementing**:
- ❌ Daily automated backups (too frequent)
- ❌ Systemd timer (cron is simpler)
- ❌ Full branching workflow (unless needed later)

---

**Last Updated**: November 2, 2025
**Author**: Claude Code
**Status**: User Preferences Documented - Ready for Implementation
**Priority**: High (Data Safety Critical)
**Next Step**: Initialize Git repository (Phase 0)
