---
name: docs
description: Generate or update project documentation
---

Generate or update documentation for the Little Dinos Game codebase.

## Documentation Files

Located in `.claude/docs/` directory:

- `architecture.md` - Overall system architecture and patterns
- `game-components.md` - DinoGame and MultiplayerDinoGame documentation
- `game-engines.md` - FieldEngine, WaveEngine, BotEngine documentation
- `mixins.md` - Vue mixin documentation

## Usage

When called with an argument, update that specific documentation:

- `/docs architecture` - Update architecture documentation
- `/docs components` - Update component documentation
- `/docs engines` - Update engine documentation
- `/docs mixins` - Update mixin documentation
- `/docs all` - Regenerate all documentation

When called without arguments, show documentation status and ask what to update.

## Instructions

1. Read the relevant source files to understand current implementation
2. Update the corresponding markdown file in `.claude/docs/`
3. Keep documentation concise but complete
4. Include code examples where helpful
5. Document public APIs, not internal implementation details
