# CLAUDE.md - Kitchen Simulator

This file provides guidance for AI assistants working with the Kitchen Simulator codebase.

## Project Overview

Kitchen Simulator is a web-based Chinese restaurant kitchen simulation game. Players receive real-time orders, follow recipes step-by-step, manage wok temperatures, and serve dishes within time limits. It's designed for training restaurant staff and gamified cooking education.

**Primary Language**: Korean (UI text, comments, documentation)

## Tech Stack

- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **State Management**: Zustand 5
- **Styling**: Tailwind CSS 3.4
- **Animation**: Framer Motion 11
- **Database**: Supabase (PostgreSQL)
- **Routing**: React Router DOM 7
- **Deployment**: Netlify

## Quick Commands

```bash
npm install      # Install dependencies
npm run dev      # Start development server (Vite)
npm run build    # Type-check (tsc -b) then build for production
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

## Directory Structure

```
src/
├── App.tsx                 # Root component with routes
├── main.tsx                # React entry point
├── lib/
│   └── supabase.ts         # Supabase client configuration
├── stores/
│   └── gameStore.ts        # Zustand store (ALL game state & logic)
├── types/
│   └── database.types.ts   # TypeScript types & game constants
├── pages/
│   ├── StoreSelect.tsx     # Store selection (/)
│   ├── UserLogin.tsx       # User selection (/user-login)
│   ├── LevelSelect.tsx     # Difficulty selection (/level-select)
│   ├── GamePlay.tsx        # Main game screen (/game)
│   └── GameResult.tsx      # Results screen (/result)
├── components/
│   ├── AppHeader.tsx       # App header
│   ├── DebugPanel.tsx      # Debug panel
│   ├── GridPopup.tsx       # Ingredient grid selection popup
│   ├── Game/
│   │   ├── GameHeader.tsx      # Timer & progress
│   │   ├── RecipeGuide.tsx     # Current recipe steps
│   │   └── ActionLogPanel.tsx  # Action history log
│   ├── Kitchen/
│   │   ├── Burner.tsx              # Wok + burner + radial menu
│   │   ├── SinkArea.tsx            # Sink for washing woks
│   │   ├── DrawerFridge.tsx        # 2x2 drawer fridge
│   │   ├── FridgeZoomView.tsx      # 4-box fridge zoom view
│   │   ├── SeasoningCounter.tsx    # Seasoning shelf (4x2)
│   │   ├── AmountInputPopup.tsx    # Single ingredient amount input
│   │   ├── BatchAmountInputPopup.tsx # Multi-ingredient batch input
│   │   ├── FridgeBox.tsx           # Individual fridge box
│   │   └── WokDryingManager.tsx    # Wok drying state manager
│   └── Menu/
│       └── MenuQueue.tsx       # Order queue display
├── utils/
│   └── grid.ts             # Grid layout utilities
└── assets/                 # Static assets

supabase/                   # SQL migration/seed files
docs/                       # Documentation
├── FEATURE_SPEC.md         # Feature specification (non-technical)
├── TECHNICAL_DOCUMENTATION.md # Detailed technical docs
├── USER_FLOW.md            # User flow documentation
└── WIREFRAME.md            # UI wireframes
```

## Core Architecture

### State Management (gameStore.ts)

ALL game state and logic lives in a single Zustand store. Key sections:

```typescript
// Session data
currentStore, currentUser, currentSession, level

// Game state
isPlaying, elapsedSeconds, completedMenus, targetMenus
woks: Wok[]           // 3 woks with temperature, state, current recipe step
menuQueue: MenuOrder[] // Pending orders
actionLogs, burnerUsageHistory

// Cached data (from Supabase)
recipes, ingredients, seasonings, storageCache

// Key methods
validateAndAdvanceIngredient()  // Validate ingredient + advance recipe step
validateAndAdvanceAction()      // Validate action (STIR_FRY, FLIP, ADD_WATER)
updateWokTemperatures()         // Called every 1s, calculates temperature changes
serve()                         // Complete order, calculate score
```

### Key Types (database.types.ts)

```typescript
// Wok states
type WokState = 'CLEAN' | 'WET' | 'DIRTY' | 'BURNED' | 'OVERHEATING'
type WokPosition = 'AT_BURNER' | 'AT_SINK' | 'MOVING_TO_SINK' | 'MOVING_TO_BURNER'

// Game levels
type GameLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'

// Important constants
WOK_TEMP = {
  AMBIENT: 25,        // Room temperature
  MIN_STIR_FRY: 180,  // Minimum temp for stir-frying
  SMOKING_POINT: 300, // Smoke appears
  OVERHEATING: 360,   // Warning state
  BURNED: 400,        // Wok burns, cooking fails
}

MENU_TIMER = {
  TARGET_TIME: 7min,   // Perfect score
  WARNING_TIME: 10min, // Score reduction starts
  CANCEL_TIME: 15min,  // Order auto-cancels
}
```

### Recipe Validation Flow

1. Order enters `menuQueue` with status `WAITING`
2. User assigns to wok via `assignMenuToWok()` -> status becomes `COOKING`
3. Each recipe has steps (type: `INGREDIENT` or `ACTION`)
4. For `INGREDIENT` steps: user adds all required ingredients via `validateAndAdvanceIngredient()`
5. For `ACTION` steps: user performs action via `validateAndAdvanceAction()`
6. When all steps complete: `serve()` calculates score and marks complete

**BEGINNER mode**: Wrong input blocks progress, timing errors burn wok
**Other modes**: Wrong input counts as error, continues with reduced accuracy score

### Temperature System

- Temperature updates every 1 second in `updateWokTemperatures()`
- Heat rate follows exponential curve (fast initial heating, slows near max)
- Ingredients cause temperature drops based on type (vegetables -40°C, seafood -45°C, etc.)
- Actions affect temperature (stir-fry -10°C after 1s delay, flip -8°C)
- Wok automatically transitions: WET->CLEAN at 180°C, burns at 400°C

## Code Patterns & Conventions

### Component Structure
- Functional components only, no class components
- Hooks at top of component
- Zustand store accessed via `useGameStore()`
- Mobile/desktop layouts often separate with `hidden lg:block` / `block lg:hidden`

### Styling
- Tailwind CSS for all styling
- Gradient backgrounds common: `bg-gradient-to-r from-X to-Y`
- Custom colors in tailwind.config.js: `wok-clean`, `wok-wet`, `wok-dirty`, `wok-burned`
- Responsive: mobile-first, `lg:` prefix for desktop

### State Updates
```typescript
// Zustand pattern for state updates
set((s) => ({
  woks: s.woks.map((w) =>
    w.burnerNumber === burnerNumber
      ? { ...w, temperature: newTemp }
      : w
  ),
}))
```

### Supabase Queries
```typescript
// Pattern: Load with relations
const { data, error } = await supabase
  .from('recipes')
  .select(`*, steps:recipe_steps(*, ingredients:recipe_ingredients(*))`)
  .eq('store_id', storeId)
```

### SKU Format
- Regular ingredients: `sku_full` from database (e.g., "양파-슬라이스-50G")
- Seasonings: `SEASONING:{name}:{amount}{unit}` (e.g., "SEASONING:식용유:10ML")

## Important Implementation Details

### Timer System (GamePlay.tsx)
Four intervals run during gameplay:
1. Menu generation (varies by difficulty)
2. Game timer (1s tick)
3. Burner usage logging (1s)
4. Temperature updates (1s)

### Mobile vs Desktop
- Desktop: Radial menu appears around wok for actions
- Mobile: Bottom action bar replaces radial menu
- Check `window.innerWidth >= 1024` for desktop detection

### Ingredient Selection Flow
1. User clicks fridge/drawer -> GridPopup opens
2. Single or multi-select mode
3. Selection triggers AmountInputPopup or BatchAmountInputPopup
4. User enters amounts per wok
5. `validateAndAdvanceIngredient()` called for each

### Wok Lifecycle
```
CLEAN (can cook)
  ↓ cook + serve
DIRTY (needs washing)
  ↓ washWok()
AT_SINK -> WET
  ↓ return to burner + heat to 180°C
CLEAN (ready again)
```

## Environment Variables

Required in `.env`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Database Tables (Supabase)

Key tables:
- `stores`, `users` - Multi-tenant structure
- `kitchen_layouts` - Kitchen configuration per store
- `storage_locations` - Fridge/drawer positions
- `ingredients_master`, `ingredients_inventory` - Ingredients with grid positions
- `seasonings` - Seasoning items
- `recipes`, `recipe_steps`, `recipe_ingredients` - Recipe definitions
- `game_sessions`, `game_scores`, `game_action_logs` - Game history

## Common Tasks

### Adding a New Cooking Action
1. Add to `WOK_TEMP.ACTION_TEMP` in `database.types.ts`
2. Handle in `validateAndAdvanceAction()` in `gameStore.ts`
3. Add button to radial menu in `Burner.tsx`
4. Add to mobile bottom bar in `GamePlay.tsx`

### Adding a New Ingredient Category
1. Add cooling value to `WOK_TEMP.COOLING`
2. Add SKU pattern matching in `validateAndAdvanceIngredient()`

### Modifying Temperature Behavior
All temperature logic is in `updateWokTemperatures()` in `gameStore.ts`

### Debugging Game State
- Use `DebugPanel.tsx` (visible in dev mode)
- Console logs prefixed with emojis for easy filtering
- Key state in `useGameStore.getState()`

## File Naming Conventions

- Components: PascalCase (`Burner.tsx`, `GamePlay.tsx`)
- Utilities: camelCase (`grid.ts`)
- Types: PascalCase for types/interfaces
- Constants: SCREAMING_SNAKE_CASE (`WOK_TEMP`, `MENU_TIMER`)

## Known Considerations

1. **All comments and UI text are in Korean** - Maintain this convention
2. **Zustand store is monolithic** - All game logic is centralized
3. **Mobile layout differs significantly** - Test both viewports
4. **Temperature simulation runs on 1s intervals** - Not real-time smooth
5. **preloadStorageData()** caches all ingredient data at game start for performance
