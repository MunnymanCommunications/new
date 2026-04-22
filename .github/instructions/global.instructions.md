# VibeCraft AI App Builder - Development Guidelines

## Architecture
- React 18+ with TypeScript, Vite for build tooling
- Tailwind CSS with shadcn/ui components
- Zustand for state management
- React Router for navigation
- TanStack Query for data fetching

## Code Style
- Use TypeScript strict mode with proper interfaces
- Components in `src/components/`, pages in `src/pages/`
- Use shadcn/ui components when available
- Use Tailwind for all styling (no inline styles)
- Create responsive layouts (mobile-first)
- Add proper ARIA attributes for accessibility

## File Organization
- UI components: `src/components/ui/`
- Feature components: `src/components/{feature}/`
- Pages: `src/pages/`
- State stores: `src/stores/`
- Utility functions: `src/lib/`
- Custom hooks: `src/hooks/`
- Integrations: `src/integrations/{service}/`
