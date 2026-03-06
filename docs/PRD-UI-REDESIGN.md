# PRD: Personal Hub — UI Redesign

**Version:** 1.0
**Datum:** 05.03.2026
**Projekt:** Personal Dashboard
**Stack:** React 19 + TypeScript + Vite + react-grid-layout v2 + Lucide Icons

---

## 1. Problemanalyse — Was aktuell nicht funktioniert

### Visuelles Design
- **Dunkles, kaltes Farbschema** (#1a1d2b) wirkt trist und uninspiriert — eher Developer-Tool als persönliches Dashboard
- **Kein visueller Rhythmus** — alle Widgets sehen identisch aus (gleicher grauer Kasten, gleicher Header, gleiche Schrift)
- **Keine Hierarchie** — wichtige Widgets (Kalender, Aufgaben) sehen genauso aus wie Zitate oder Weltuhren
- **Langweilige Auth-Seite** — minimale Login-Box auf dunklem Hintergrund, kein Branding, kein Charakter
- **Monotone Farbpalette** — nur ein Akzent (#6366f1 Indigo), keine Farbvielfalt pro Widget
- **Kein Wow-Effekt** — Dashboard wirkt generisch, könnte jede x-beliebige Admin-Oberfläche sein

### Layout & UX
- **Widget-Picker ist ein flacher Strip** — keine Kategorisierung, keine Vorschau, keine Beschreibung
- **Header ist zu schlicht** — nur Logo + 2 Buttons, verschenkter Platz
- **Kein Begrüßungsbereich** — kein Willkommen, keine Tagesübersicht, kein Quick-Status
- **Keine Widget-Konfiguration** — kein Settings-Panel pro Widget
- **Mobile Experience** — Widgets werden nur gestapelt, kein angepasstes Mobile-Layout

### Micro-Interactions
- **Minimale Animationen** — nur ein `slideDown` und `spin`, sonst nichts
- **Kein Feedback** — kein Haptic-Feeling bei Drag & Drop, keine Success-States
- **Starre Transitions** — Widgets erscheinen/verschwinden ohne Animation

---

## 2. Design-Vision — "Warm Glassmorphism"

### Konzept
Ein warmes, einladendes Dashboard mit **Glasmorphismus auf hellem Hintergrund** — wie ein aufgeräumter Schreibtisch mit sanftem Morgenlicht. Jedes Widget bekommt einen subtilen **individuellen Farbakzent**, sodass das Dashboard lebendig wirkt ohne chaotisch zu sein.

### Moodboard-Keywords
`Notion-clean` · `Linear-smooth` · `Apple-warm` · `Figma-playful`

---

## 3. Farbsystem

### Hintergrund (Light Mode)
```css
--bg-primary: #f8f7f4;           /* Warm Off-White */
--bg-secondary: #f0eeeb;         /* Leicht dunkler */
--bg-card: rgba(255, 255, 255, 0.72);  /* Frosted Glass */
--bg-card-hover: rgba(255, 255, 255, 0.88);
--bg-input: rgba(0, 0, 0, 0.04);
--bg-input-focus: rgba(0, 0, 0, 0.07);
```

### Text
```css
--text-primary: #1a1a2e;         /* Fast-Schwarz, warm */
--text-secondary: #64648c;       /* Gedämpftes Lila-Grau */
--text-muted: #9e9eb8;           /* Dezent */
```

### Borders & Shadows
```css
--border: rgba(0, 0, 0, 0.08);
--border-hover: rgba(0, 0, 0, 0.15);
--shadow-card: 0 1px 3px rgba(0, 0, 0, 0.04),
               0 8px 32px rgba(0, 0, 0, 0.06);
--shadow-card-hover: 0 4px 16px rgba(0, 0, 0, 0.08),
                     0 12px 48px rgba(0, 0, 0, 0.1);
```

### Widget-Akzentfarben (je Widget einzigartig)
```css
--color-passwords:   #6366f1;  /* Indigo */
--color-contacts:    #8b5cf6;  /* Violet */
--color-notes:       #f59e0b;  /* Amber */
--color-bookmarks:   #3b82f6;  /* Blue */
--color-calendar:    #ef4444;  /* Red */
--color-todos:       #22c55e;  /* Green */
--color-weather:     #06b6d4;  /* Cyan */
--color-clocks:      #a855f7;  /* Purple */
--color-stickynotes: #f97316;  /* Orange */
--color-files:       #64748b;  /* Slate */
--color-pomodoro:    #ec4899;  /* Pink */
--color-quotes:      #14b8a6;  /* Teal */
--color-finance:     #10b981;  /* Emerald */
--color-hardware:    #6366f1;  /* Indigo */
```

### Hintergrund-Gradient (Mesh-Gradient)
```css
body {
  background: #f8f7f4;
  background-image:
    radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.07) 0%, transparent 50%),
    radial-gradient(at 100% 0%, rgba(236, 72, 153, 0.05) 0%, transparent 50%),
    radial-gradient(at 50% 100%, rgba(245, 158, 11, 0.05) 0%, transparent 50%);
}
```

---

## 4. Typografie

```css
--font-display: 'Plus Jakarta Sans', sans-serif;  /* Headlines */
--font-body: 'Inter', sans-serif;                  /* Body Text */
--font-mono: 'JetBrains Mono', monospace;          /* Codes/Seriennummern */
```

### Hierarchie
| Element | Font | Gewicht | Größe | Letter-Spacing |
|---------|------|---------|-------|----------------|
| Seiten-Titel | Display | 700 | 24px | -0.03em |
| Widget-Titel | Display | 600 | 13px | 0.02em |
| Body | Body | 400 | 14px | 0 |
| Label/Meta | Body | 500 | 11px | 0.04em |
| Mono-Werte | Mono | 400 | 12px | 0.05em |

---

## 5. Widget-Design — Neues Kartenformat

### Grundstruktur jeder Widget-Karte
```
┌─────────────────────────────────────┐
│ ● Icon  WIDGET-TITEL         ⋯  ×  │  ← Header mit farbigem Akzent-Dot
│─────────────────────────────────────│
│                                     │
│         Widget Content              │  ← Glasmorphismus-Body
│                                     │
│                                     │
└─────────────────────────────────────┘
     ↑ Dezenter farbiger Top-Border (2px)
```

### CSS-Konzept
```css
.widget-card {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 20px;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.04),
    0 8px 32px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);  /* Inner Glow */
  overflow: hidden;
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 0.3s ease;
}

.widget-card:hover {
  transform: translateY(-2px);
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.08),
    0 12px 48px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}
```

### Widget-Header (NEU)
```css
.widget-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  position: relative;
}

/* Farbiger Akzent-Dot links vom Titel */
.widget-accent-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  /* Farbe wird per Widget-Klasse gesetzt */
}

/* Dezenter farbiger Top-Border */
.widget-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 24px;
  right: 24px;
  height: 2px;
  border-radius: 0 0 2px 2px;
  /* Farbe wird per Widget-Klasse gesetzt */
  opacity: 0.6;
}
```

---

## 6. Auth-Seite — Komplett-Redesign

### Layout: Split-Screen
```
┌───────────────────────┬──────────────────────┐
│                       │                      │
│   HERO BEREICH        │    LOGIN FORM         │
│                       │                      │
│   Große Headline:     │    Willkommen!        │
│   "Dein persönlicher  │                      │
│    Hub für alles."    │    [Email]            │
│                       │    [Passwort]         │
│   Floating Widget-    │    [Anmelden]         │
│   Mockups mit         │                      │
│   Parallax-Effekt     │    oder               │
│                       │    [Google SSO]       │
│   Bunte Gradients     │                      │
│                       │    Registrieren →     │
│                       │                      │
└───────────────────────┴──────────────────────┘
```

### Hero-Bereich
- Animated Mesh-Gradient Hintergrund
- 3-4 schwebende Widget-Mockups (leichte Parallax-Bewegung per `mousemove`)
- Große Display-Font Headline
- Subtile Particle-Effekte oder schwebende Shapes

### Login-Form
- Große, klare Inputs mit Icons
- Soft-Shadow statt harter Border auf Focus
- Sanfte Slide-Animation beim Mode-Wechsel (Login ↔ Register ↔ Reset)
- Animated Success-Checkmark nach Login

### Mobile: Stacked Layout
- Hero wird zum Hintergrund
- Form im Vordergrund als Overlay-Card

---

## 7. Dashboard-Header — Redesign

### Neuer Header
```
┌──────────────────────────────────────────────────────────────┐
│  🎛️ Personal Hub     📅 Do, 5. März    ☀️ 12°C Zürich       │
│                                                              │
│  Guten Morgen, Felix! 👋                                     │
│  Du hast 3 offene Aufgaben und 2 Termine heute.              │
│                                                              │
│  [+ Widget]  [⚙️ Einstellungen]  [🌙/☀️ Theme]  [👤 Profil]  │
└──────────────────────────────────────────────────────────────┘
```

### Features
- **Kontextuelle Begrüßung** — "Guten Morgen/Tag/Abend, [Name]"
- **Quick-Stats** — Offene Todos, heutige Termine, aktuelles Wetter
- **Datum & Uhrzeit** — Live, elegant formatiert
- **Theme-Toggle** — Dark/Light Mode
- **Profil-Dropdown** — Avatar, Name, Abmelden
- **Sticky Behavior** — Compact-Header beim Scrollen (nur Logo + Buttons)

---

## 8. Widget-Picker — Command-Palette Style

### Statt flachem Strip → Modal/Overlay
```
┌─────────────────────────────────────┐
│  🔍 Widget suchen...                │
│─────────────────────────────────────│
│                                     │
│  PRODUKTIVITÄT                      │
│  ┌─────┐ ┌─────┐ ┌─────┐          │
│  │ ✅  │ │ 📝  │ │ ⏱️  │          │
│  │Aufg.│ │Notiz│ │Pomo.│          │
│  └─────┘ └─────┘ └─────┘          │
│                                     │
│  ORGANISATION                       │
│  ┌─────┐ ┌─────┐ ┌─────┐          │
│  │ 📅  │ │ 🔖  │ │ 📁  │          │
│  │Kal. │ │Lesez│ │Datei│          │
│  └─────┘ └─────┘ └─────┘          │
│                                     │
│  TOOLS                              │
│  ┌─────┐ ┌─────┐ ┌─────┐          │
│  │ 🌤️  │ │ 🕐  │ │ 💰  │          │
│  │Wett.│ │Uhren│ │Finan│          │
│  └─────┘ └─────┘ └─────┘          │
│                                     │
└─────────────────────────────────────┘
```

### Features
- **Tastaturkürzel** — `Cmd+K` oder `/` öffnet den Picker
- **Kategorisierte Widgets** — Produktivität, Organisation, Tools, Sicherheit
- **Widget-Vorschau** — Hover zeigt Mini-Preview
- **Suchfunktion** — Instant-Filter
- **Animierter Ein-/Ausblendeffekt** — Scale + Fade
- **Farbige Icons** — Jedes Widget in seiner Akzentfarbe

---

## 9. Micro-Interactions & Animationen

### Grundprinzipien
- **Spring-Physics** statt linearer Easing → `cubic-bezier(0.16, 1, 0.3, 1)`
- **Staggered Animations** — Widgets laden nacheinander ein (50ms Versatz)
- **Meaningful Motion** — Jede Animation hat einen Zweck

### Konkrete Animationen

| Aktion | Animation | Dauer |
|--------|-----------|-------|
| Widget erscheint | Scale(0.95→1) + Fade + leichter Y-Offset | 300ms, staggered |
| Widget entfernt | Scale(1→0.95) + Fade out | 200ms |
| Widget-Drag Start | Scale(1.02) + Shadow-Increase + leichte Rotation | 150ms |
| Widget-Drag End | Spring-Back mit Overshoot | 400ms |
| Hover auf Widget | TranslateY(-2px) + Shadow-Increase | 300ms |
| Button-Click | Scale(0.97→1) | 150ms |
| Todo abgehakt | Checkbox morpht zu Checkmark + Strikethrough-Animation | 400ms |
| Neuer Eintrag | Slide-In von links/oben + Fade | 250ms |
| Löschen | Slide-Out nach rechts + Fade | 200ms |
| Auth-Mode-Switch | Crossfade mit leichtem Y-Shift | 300ms |
| Page-Load | Staggered Widget-Reveal (bottom-up) | 50ms/Widget |

### CSS-Beispiel: Widget-Einblendung
```css
@keyframes widgetReveal {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.96);
    filter: blur(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}

.grid-widget {
  animation: widgetReveal 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--widget-index) * 60ms);
}
```

---

## 10. Responsive Design

### Breakpoints
| Breakpoint | Spalten | Verhalten |
|------------|---------|-----------|
| `≥1440px` (xl) | 12 | Volle Breite, alle Widgets sichtbar |
| `≥1024px` (lg) | 12 | Standard-Layout |
| `≥768px` (md) | 8 | Widgets etwas schmaler |
| `≥480px` (sm) | 4 | 1-2 Widgets nebeneinander |
| `<480px` (xs) | 1 | Volle Breite, gestapelt |

### Mobile-spezifisch
- **Bottom-Navigation** statt Header-Buttons
- **Swipeable Widget-Tabs** — Horizontal scrollen zwischen Widget-Kategorien
- **Collapsed Widgets** — Nur Header sichtbar, Tap zum Expandieren
- **Pull-to-Refresh** für Wetter/Zitate
- **Floating Action Button** für Quick-Add (neues Todo, neue Notiz)

---

## 11. Dark Mode

### Automatischer System-Sync + manueller Toggle
```css
/* Dark Mode Variablen */
[data-theme="dark"] {
  --bg-primary: #0f0f1a;
  --bg-secondary: #1a1a2e;
  --bg-card: rgba(26, 26, 46, 0.8);
  --bg-card-hover: rgba(35, 35, 60, 0.9);
  --text-primary: #e8e8f0;
  --text-secondary: #9090b0;
  --border: rgba(255, 255, 255, 0.08);
  --shadow-card: 0 2px 8px rgba(0, 0, 0, 0.3),
                 0 8px 32px rgba(0, 0, 0, 0.2);
}
```

### Transition zwischen Themes
```css
html {
  transition: background-color 0.4s ease, color 0.4s ease;
}
html * {
  transition: background-color 0.3s ease,
              border-color 0.3s ease,
              box-shadow 0.3s ease,
              color 0.2s ease;
}
```

---

## 12. Neue Widget-Features (Optional)

### Quick-Actions Bar (neues Widget)
Eine horizontale Shortcut-Leiste ganz oben:
```
[📝 Neue Notiz] [✅ Neues Todo] [📅 Termin] [🔖 Lesezeichen] [📸 Scan]
```

### Widget-Einstellungen (pro Widget)
- Jedes Widget bekommt ein ⚙️-Icon im Header
- Öffnet Slide-Over Panel mit widget-spezifischen Settings
- z.B. Wetter: Stadt ändern | Kalender: Wochenstart | Finanzen: Währung

### Drag-Hilfe
- Beim ersten Besuch: dezente Tooltip-Animation "Widgets verschieben per Drag & Drop"
- Ghost-Preview beim Dragging mit reduzierter Opacity

---

## 13. Technische Implementierung

### Prioritäten
1. **Phase 1** — Farbsystem + Typografie + Widget-Karten-Redesign
2. **Phase 2** — Auth-Seite Redesign + Header-Redesign
3. **Phase 3** — Widget-Picker + Animationen
4. **Phase 4** — Dark/Light Mode Toggle
5. **Phase 5** — Responsive + Mobile Optimierung

### Betroffene Dateien
| Datei | Änderungen |
|-------|------------|
| `index.css` | Komplettes neues Farbsystem, Typografie, Base-Styles |
| `App.css` | Komplett neu — Widget-Cards, Header, Picker, Animationen |
| `App.tsx` | Neuer Header, Widget-Picker Logic, Theme-Toggle |
| `AuthPage.tsx` | Split-Screen Layout, Animationen |
| `WidgetWrapper.tsx` | Neues Card-Design mit Akzent-Dot und Top-Border |
| `package.json` | Font: Plus Jakarta Sans |

### Keine Breaking Changes
- react-grid-layout API bleibt gleich
- Supabase-Integration bleibt unverändert
- Widget-Logik bleibt unverändert
- Nur CSS + Layout-Markup ändert sich

---

## 14. Zusammenfassung

| Bereich | Alt | Neu |
|---------|-----|-----|
| Farbschema | Dunkles Einheitsgrau | Warmes Glasmorphismus (Light + Dark) |
| Widget-Design | Identische graue Boxen | Individuelle Farbakzente pro Widget |
| Auth-Seite | Minimale Login-Box | Split-Screen mit Hero-Animation |
| Header | Logo + 2 Buttons | Begrüßung + Quick-Stats + Theme-Toggle |
| Widget-Picker | Flacher Button-Strip | Command-Palette mit Kategorien + Suche |
| Animationen | Fast keine | Spring-Physics, Stagger, Transitions überall |
| Mobile | Nur gestapelt | Bottom-Nav, Swipe, FAB, Collapsed Mode |
| Dark Mode | Nur Dark | Light (default) + Dark mit System-Sync |

---

*Diese PRD dient als Grundlage für die schrittweise Umsetzung. Jede Phase kann unabhängig implementiert und deployed werden.*
