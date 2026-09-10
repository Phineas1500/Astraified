import { defineConfig } from 'vitest/config';

// Other Codex sessions may keep isolated worktrees under ignored artifacts/.
// Only this checkout's test suite belongs in this run.
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });
