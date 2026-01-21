# Repository Guidelines

## Project Structure & Module Organization
- `app/` is the Next.js App Router. Route folders are feature-based (`workspaces/`, `projects/`, `sign-in/`). UI is in `page.tsx`/`layout.tsx`, API handlers in `app/api/**/route.ts`, and server actions in `**/actions.ts`.
- `components/` holds reusable UI (widgets, modals, layout pieces).
- `lib/` contains shared utilities (auth, RBAC, Prisma client, helpers).
- `prisma/` stores the schema and migrations (`schema.prisma`, `migrations/`).
- `public/` is for static assets.
- Root configs: `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `prisma.config.ts`.

## Build, Test, and Development Commands
- `npm run dev` starts the local dev server at `http://localhost:3000`.
- `npm run build` creates a production build.
- `npm run start` runs the production server after a build.
- `npm run lint` runs ESLint.
- `npx prisma migrate dev` updates the database schema.
- `npx prisma generate` regenerates the Prisma client after schema changes.

## Coding Style & Naming Conventions
- TypeScript is strict (`tsconfig.json` has `strict: true`). Prefer typed params and return values for server actions and API handlers.
- Use Tailwind CSS utility classes for styling; keep new styles in component scope unless shared.
- Route folders use `kebab-case`; React components use `PascalCase` filenames and component names.
- Keep API responses consistent with existing routes and avoid breaking client contracts.

## Testing Guidelines
- No automated tests are currently configured.
- If you add tests, include a script in `package.json` and document the test location (e.g., `tests/` or `__tests__/`).

## Commit & Pull Request Guidelines
- No formal commit convention is established. Use short, imperative messages (e.g., "Add task filters").
- PRs should include a brief summary, steps to verify, and screenshots for UI changes.

## Security & Configuration Tips
- Environment variables live in `.env`/`.env.local`; never commit secrets.
- Prisma uses `DIRECT_URL` in `prisma.config.ts` for database connections.
