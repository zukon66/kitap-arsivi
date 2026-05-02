---
name: Academic Clarity
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#464555'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#777587'
  outline-variant: '#c7c4d8'
  surface-tint: '#4d44e3'
  primary: '#3525cd'
  on-primary: '#ffffff'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#c3c0ff'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#7e3000'
  on-tertiary: '#ffffff'
  tertiary-container: '#a44100'
  on-tertiary-container: '#ffd2be'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#ffdbcc'
  tertiary-fixed-dim: '#ffb695'
  on-tertiary-fixed: '#351000'
  on-tertiary-fixed-variant: '#7b2f00'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  h1:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  h2:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  button:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 20px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
---

## Brand & Style

The design system is anchored in **Minimalism** with a **Corporate Modern** execution, specifically tailored for the mobile-first student experience. The personality is organized and encouraging, aiming to reduce the cognitive load of academic life. 

The aesthetic prioritizes high-quality typography and generous whitespace to foster focus. The UI relies on a card-based architecture that uses soft, ambient elevation to create a sense of order without visual clutter. The interaction model is tactile and responsive, providing immediate feedback to reinforce a sense of progress and accomplishment.

## Colors

The palette is professional yet energetic. The **Indigo primary** serves as the focal point for action and progress, while the **Slate secondary** provides a grounded, academic feel for utility and metadata. 

- **Primary (Indigo):** Used for primary actions, active states, and progress indicators.
- **Secondary (Slate):** Used for secondary text, icons, and non-interactive structural elements.
- **Surface:** A crisp white background for cards, set against a very light cool-gray neutral background to define the card boundaries.
- **Semantic Colors:** Success green for completed tasks, warning yellow for upcoming deadlines, and error red for overdue assignments.

## Typography

The design system utilizes **Inter** for its exceptional readability and systematic feel. The type hierarchy is intentionally steep to help students quickly scan headers and distinguish between task titles and descriptive metadata.

- **Headlines:** Use tighter letter spacing and heavier weights to anchor the page.
- **Body Text:** Uses a standard weight with comfortable line heights to ensure long-form notes or task descriptions are legible.
- **Labels:** Small, all-caps, and semi-bold for categorization (e.g., Course Names or Tags).

## Layout & Spacing

This design system employs a **mobile-first fluid grid** with a focus on vertical stacking. The layout relies on a 4px baseline shift to ensure mathematical harmony between elements.

- **Margins:** A consistent 20px outer margin ensures content doesn't feel cramped on small screens.
- **Card Spacing:** Use 16px (stack-md) for gaps between cards in a list to maintain individual identity while showing connectivity.
- **Sectioning:** Use 24px (stack-lg) to separate distinct functional areas (e.g., "Today's Schedule" vs. "Upcoming Tasks").

## Elevation & Depth

Visual hierarchy is managed through **Ambient Shadows** and tonal layering. This creates a tactile, physical quality where the most important information "floats" closest to the user.

- **Level 0 (Background):** Neutral light gray (#F8FAFC), flat.
- **Level 1 (Cards):** Pure white surface with a very soft, diffused shadow (0px 4px 12px, 5% opacity black).
- **Level 2 (Active/Modals):** Pure white surface with a more pronounced shadow (0px 8px 24px, 10% opacity black) to indicate temporary focus or interactive state.

## Shapes

The shape language is friendly and modern. A **rounded (0.5rem base)** approach is used to soften the UI, making the app feel approachable rather than clinical.

- **Standard Elements:** Buttons and small inputs use 8px (0.5rem).
- **Containers:** Main task cards and content containers use 16px (1rem) for a distinct "card" feel.
- **Status Pills:** Use a full "Pill" radius for status tags and category chips to differentiate them from actionable buttons.

## Components

### Buttons
Primary buttons are high-contrast Indigo with white text. They should have a subtle 1px inner highlight on the top edge to provide a "tactile" pressed-plastic look. Secondary buttons use a Slate-50 background with Slate-700 text.

### Cards
Cards are the primary vessel for information. Every card must have a 16px internal padding and 16px corner radius. Task cards should include a left-hand accent border (4px width) colored by the status or category.

### Inputs & Selection
Input fields utilize a subtle Slate-100 border that thickens and changes to Indigo on focus. Checkboxes for task completion should be large (24px) with a satisfying "pop" animation and haptic feedback when toggled.

### Progress Indicators
Linear progress bars are used for course completion, featuring a Slate-100 track and a Primary Indigo fill. For high-level overviews, use a circular "ring" indicator with a central percentage.

### Chips & Tags
Small, rounded-full elements with low-saturation background tints (e.g., 10% opacity of the category color) and high-saturation text of the same hue for clear categorization without visual noise.