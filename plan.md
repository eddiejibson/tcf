# Landing Page Maximum Sexy Overhaul + Interactive Globe

## 1. Fix Build Error
- **File:** `app/api/admin/users/[id]/route.ts`
- Change `Partial<User>` to `Record<string, unknown>` to avoid deep TypeORM entity type recursion

## 2. Create Interactive Globe Component
- **New File:** `app/components/InteractiveGlobe.tsx`
- Pure SVG world map (Natural Earth simplified paths) with Framer Motion
- Dark theme map with ocean = transparent, land = subtle `#1a1f26` with `#0984E3` border glow
- 6 pulsing location markers with CSS pulse animation:
  - Madagascar (-18.77°, 46.87°)
  - Bali (-8.34°, 115.09°)
  - Solomon Islands (-9.43°, 160.02°)
  - Australia (-25.27°, 133.78°)
  - Kenya (-0.02°, 37.91°)
  - Caribbean (15.41°, -61.02°)
- Each dot: glowing blue pulse animation, on hover/click shows location name in a stylish tooltip
- Connected by subtle animated lines (trade route lines from UK to each location)
- Responsive: works on mobile and desktop
- No new npm dependencies - pure SVG + Framer Motion

## 3. Enhance Landing Page Sections
- **File:** `app/page.tsx` (major edit)

### Hero Section Enhancements
- Add animated gradient mesh / aurora background effect (CSS-only)
- Larger, bolder typography with gradient text effect on headline
- Animated underline accent under "coral"
- More dramatic entrance animations

### New "Global Sourcing" Section (between "Our Process" and "Why Us")
- Section title: "Sourced from the world's finest reefs"
- The InteractiveGlobe component as centerpiece
- Brief description text with blue accent highlights
- Scroll-triggered reveal animation

### Enhanced Process Cards
- Add subtle animated gradient borders
- Glass-morphism effect (backdrop-blur + gradient overlay)
- Animated icon backgrounds

### Enhanced Stats Section
- Add gradient number coloring (white → blue)
- Subtle background pattern/grid

### Enhanced CTA Section
- Add animated gradient background
- Floating particle effect behind CTA

## 4. CSS Enhancements
- **File:** `app/globals.css`
- Add `@keyframes pulse-dot` for location markers
- Add `@keyframes aurora` for hero background mesh
- Add animated gradient border utility
- Add globe-specific styles (trade route line animations)

## 5. Files Changed Summary
| File | Action |
|------|--------|
| `app/api/admin/users/[id]/route.ts` | Fix build error (type change) |
| `app/components/InteractiveGlobe.tsx` | NEW - Interactive SVG world map |
| `app/page.tsx` | Major enhancement + new globe section |
| `app/globals.css` | New animations and effects |
