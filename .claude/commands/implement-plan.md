# Implement Plan

Execute an implementation plan step by step with verbose output.

## Arguments

$ARGUMENTS - Name of the plan file (without .md extension). If empty, list available plans and ask which to implement.

## Instructions

### Pre-Implementation Checks

1. If $ARGUMENTS is empty, list all `.md` files in `.claude/plans/` and ask user which to implement
2. Read the plan from `.claude/plans/$ARGUMENTS.md`
3. Verify plan status is `Reviewed` or `Approved`
4. Check for any remaining `[?? ... ??]` comments - if found, warn user and suggest running `/iterate-plan` first
5. Display plan summary and ask for confirmation to proceed

### Implementation Process

For each step in the plan:

**1. Announce Step**
```
========================================
STEP 1/N: <Step Name>
========================================
Files: file1.js, file2.js
Description: <step description>
```

**2. Execute Step**
- Make the code changes as specified
- Show what was changed:
  ```
  Modified: src/game/models.js
  - Added healUnit() method to Unit class
  - Added HEAL_AMOUNT constant
  ```

**3. Verify Step (if applicable)**
- Run relevant tests if specified
- Check for syntax/lint errors
- Report result:
  ```
  Step 1 verification: PASSED
  ```

**4. Pause on Issues**
If something goes wrong:
- Stop execution
- Report the issue clearly
- Ask user how to proceed (fix, skip, abort)

**5. Mark Progress**
Update the plan file to track progress:
```markdown
### Step 1: <Name> ✅ COMPLETED
```

### Final Verification Step

When reaching the "Final Verification" step:

1. **Run linter**:
   ```bash
   cd frontend && npm run lint
   ```
   Report results.

2. **Run tests**:
   ```bash
   cd frontend && npm run test
   ```
   Report results.

3. **Manual test checklist**:
   Display the business scenarios from the plan:
   ```
   Manual Testing Checklist:
   [ ] Scenario 1: <description>
   [ ] Scenario 2: <description>

   Please test these scenarios and confirm they work.
   ```

### Completion

After all steps complete:

1. Update plan status to `Implemented`
2. Add completion timestamp
3. Show summary:
   ```
   ========================================
   IMPLEMENTATION COMPLETE
   ========================================
   Plan: <feature-name>
   Steps completed: N/N
   Files modified: X
   Tests: PASSED
   Lint: PASSED

   Manual testing required:
   - Scenario 1
   - Scenario 2
   ```

### Resume Support

If implementation was interrupted:
- Check for `✅ COMPLETED` markers in plan
- Offer to resume from last incomplete step
- Skip already-completed steps

### Abort

User can say "abort" or "stop" at any time to halt implementation.
- Save progress markers
- Report what was completed
- Plan can be resumed later
