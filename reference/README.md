# Reference Documentation

This directory contains planning documents, implementation guides, and technical reference materials for Marie's Vault development.

## Planning Documents

### [Tag & Keyword Merge Plan](tag-keyword-merge-plan.md)
**Status**: Planning Phase
**Estimated Time**: 13-19 hours (3-4 sessions)
**Priority**: Medium

Comprehensive plan to merge the separate Tags and Keywords systems into a unified Tag system. This eliminates ~40% code duplication while improving performance and user experience.

**Key Features**:
- Unified tag system with visual distinction (original vs user-added)
- Database migration strategy with rollback plan
- Phase-by-phase implementation guide
- Complete testing checklist

### [Git Backup & Workflow Plan](git-backup-workflow-plan.md)
**Status**: Planning Phase
**Estimated Time**: 6-8 hours (1-2 sessions)
**Priority**: High (Data Safety)

Implementation plan for comprehensive Git backup workflow including automated backups, branching strategy, and commit conventions.

**Key Features**:
- Automated daily backups via cron
- Pre-commit safety hooks
- Branch naming conventions
- Emergency recovery procedures
- GitHub token management

## Quick Start

### Start Tag/Keyword Merge
```bash
# Review the plan
cat reference/tag-keyword-merge-plan.md | less

# Create feature branch
git checkout -b feature/merge-tags-keywords

# Begin Phase 1 (Database Migration)
# See plan for detailed steps
```

### Set Up Git Backups (30 minutes)
```bash
# Quick setup for immediate backups
mkdir -p scripts
# Copy backup.sh from git-backup-workflow-plan.md Phase 1.1
chmod +x scripts/backup.sh

# Test backup
bash scripts/backup.sh

# Schedule daily backups
crontab -e
# Add: 0 2 * * * /root/maries-vault-migration/maries-vault/scripts/backup.sh >> /var/log/marie-vault-backup.log 2>&1
```

## Document Status

| Document | Status | Priority | Estimated Time | Sessions |
|----------|--------|----------|----------------|----------|
| Tag/Keyword Merge | Planning | Medium | 13-19 hours | 3-4 |
| Git Backup Workflow | Planning | High | 6-8 hours | 1-2 |

## Contributing

When creating new reference documents:

1. Use clear, descriptive filenames (`feature-name-plan.md`)
2. Include status, timeline, and priority
3. Break into phases with clear checkboxes
4. Provide testing procedures
5. Include rollback/recovery plans
6. Update this README with summary

## Notes

- Plans are living documents - update as implementation progresses
- Mark phases complete as you finish them
- Add discoveries and gotchas as notes
- Keep estimates realistic

---

**Last Updated**: November 2, 2025
