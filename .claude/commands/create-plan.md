# Create Plan

Create a comprehensive implementation plan for a feature or task.

## Arguments

$ARGUMENTS - Description of the feature or task to plan

## Plan Location

Plans are stored in `.claude/plans/<feature-name>.md`

## Instructions

1. **Analyze the task description** - Parse the feature requirements from $ARGUMENTS

2. **Review existing documentation** - Read and analyze:
   - `CLAUDE.md` - Project overview
   - `.claude/docs/architecture.md` - System architecture
   - `.claude/docs/game-components.md` - Component documentation
   - `.claude/docs/game-engines.md` - Engine documentation
   - `.claude/docs/api/rest-endpoints.md` - REST API docs
   - `.claude/docs/api/websocket-protocol.md` - WebSocket docs
   - Any other relevant docs in `.claude/docs/`

3. **Analyze relevant code** - Explore the codebase to understand:
   - Existing patterns and conventions
   - Files that will need modification
   - Dependencies and integrations

4. **Create the plan file** in `.claude/plans/<feature-name>.md` with this structure:

```markdown
# Plan: <Feature Name>

Created: <date>
Status: Draft

## Overview
Brief description of what this plan implements.

## Requirements
- Bullet list of requirements derived from the description

## Analysis

### Affected Files
List of files to create or modify:
- `path/to/file.js` - Description of changes

### Dependencies
Any external dependencies or internal modules this feature relies on.

### Risks/Considerations
Potential issues or edge cases to consider.

## Implementation Steps

### Step 1: <Name>
**Files**: `file1.js`, `file2.js`
**Description**: Detailed description of what to do.
**Code Changes**:
- Specific change 1
- Specific change 2

### Step 2: <Name>
... (continue for all steps)

### Step N: Write Tests
**Files**: `tests/*.spec.js`
**Description**: Test cases to add
**Tests**:
- Test case 1: description
- Test case 2: description

### Step N+1: Update Documentation
**Files**: `.claude/docs/*.md`, `CLAUDE.md`
**Description**: Documentation updates needed
**Updates**:
- Doc 1: changes
- Doc 2: changes

### Step N+2: Final Verification
**Commands**:
```bash
cd frontend && npm run lint
cd frontend && npm run test
```
**Manual Tests**:
- Business scenario 1: steps to verify
- Business scenario 2: steps to verify

## Questions/Notes
Any open questions or notes for the user.
```

5. **Inform the user** - Output the path to the created plan and summarize key steps

## User Comments Format

Users can leave comments/questions in the plan using this format:
- `[?? your question or comment here ??]`

These markers are picked up by `/iterate-plan` for review.

## Example

`/create-plan Add unit healing ability when standing on Well building`

Creates `.claude/plans/unit-healing-well.md` with full implementation details.
