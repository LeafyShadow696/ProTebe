# ProTebe

Soukromý prostor pro dva — vzpomínky, vzkazy, galerie a společný kalendář.

Projekt používá TanStack Start, React, TypeScript, Tailwind CSS a Supabase.

## Vývoj

```sh
bun install
bun run dev
```

## Kontroly kvality

```sh
bun run test:unit
bunx tsgo --noEmit
bun run lint
bun run build
bun run test:e2e
```

## Konfigurace

Runtime credentials a environment variables nepatří do Git repozitáře. Nastavují se v lokálním `.env` nebo v secrets cílového prostředí.

Projekt byl původně rozvíjen v Lovable; `main` je propojená vývojová větev.
