---
title: Layout Defaults
date: 2026-05-14
status: current
tags: [layout, theme, sidebar, PWA]
modules: [app/layout, components/sidebar-context]
---

# Layout Defaults

The root layout establishes defaults that new pages inherit. These are not enforced by code but are conventions maintained across pages.

## Theme Defaults

The root HTML starts with `data-theme="dark"`. No theme-switching logic lives in the layout. All styling assumes dark mode variables from `globals.css`.

---

## Sidebar Defaults

The sidebar starts collapsed. The `SidebarProvider` initializes state with `collapsed: true`. The toggle exists but is off by default.

---

## Overflow Behavior

The root window has `overflow: hidden` via inline styles. Scrolling is disabled at the root level. The chat component handles its own overflow internally (code blocks, widgets scroll within the chat window, not the page).

---

## PWA Configuration

The app is optimized for PWA behavior on iOS devices:
- `appleWebApp.capable: true`
- `appleWebApp.statusBarStyle: "black-translucent"`
- `metadata.apple` icons provided
- `viewport` disables zooming, sets scale to 1

A separate manifest file lives in `public/manifest.json`.

---

## Single Entry Point

The layout wraps all pages. New pages go under `app/`. No other top-level pages exist at the root.
