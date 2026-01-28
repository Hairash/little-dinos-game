# Iterate Plan

Review and update an existing plan based on user comments and questions.

## Arguments

$ARGUMENTS - Name of the plan file (without .md extension). If empty, list available plans and ask which to iterate.

## Comment Format

Users mark their feedback in plans using: `[?? comment or question here ??]`

Examples:
- `[?? Should this also handle edge case X? ??]`
- `[?? I prefer approach B instead ??]`
- `[?? What about error handling here? ??]`
- `[?? Remove this step ??]`
- `[?? Add a step for caching ??]`

## Instructions

1. **Locate the plan**
   - If $ARGUMENTS is provided, read from `.claude/plans/$ARGUMENTS.md`
   - If $ARGUMENTS is empty, list all `.md` files in `.claude/plans/` and ask user which to iterate

2. **Find all comments** - Search for all `[?? ... ??]` markers in the plan

3. **List found comments** - Display all comments/questions to the user with their context:
   ```
   Found 3 comments in plan:

   1. Line 45 (Step 2): [?? Should this also handle edge case X? ??]
   2. Line 67 (Step 4): [?? I prefer approach B instead ??]
   3. Line 89 (Tests): [?? Add test for null input ??]
   ```

4. **Address each comment** - For each comment:
   - Analyze what the user is asking/requesting
   - Research the codebase if needed for context
   - Update the plan section accordingly
   - Remove the `[?? ... ??]` marker after addressing

5. **Update the plan file** - Save changes to the plan

6. **Report changes** - Summarize what was updated:
   ```
   Updated plan:
   - Step 2: Added edge case X handling
   - Step 4: Changed to approach B, updated affected files
   - Tests: Added null input test case
   ```

## No Comments Found

If no `[?? ... ??]` markers are found in the plan:
1. Inform the user that no comments were found
2. Ask if they want to review the plan together
3. Offer to make other modifications

## Plan Status Update

After iteration, update the plan's Status field:
- `Draft` -> `Reviewed` (after first iteration)
- `Reviewed` -> `Approved` (user can set manually or confirm)
