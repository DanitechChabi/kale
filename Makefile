# ============================================================
# Kalé — commandes du monorepo
# Usage : make <cible>   (voir aussi CLAUDE.md)
# ============================================================

SHELL := /bin/bash

.PHONY: help up down migrate seed dev-api dev-mobile dev-web test format

help: ## Affiche l'aide
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-12s\033[0m %s\n", $$1, $$2}'

up: ## Démarre postgres + redis + minio (Docker)
	docker compose up -d

down: ## Arrête les services Docker
	docker compose down

migrate: ## Lance les migrations Ecto
	cd apps/backend && mix ecto.migrate

seed: ## Charge les données de démo
	cd apps/backend && mix run priv/repo/seeds.exs

dev-api: ## Lance le backend Phoenix sur :4000
	cd apps/backend && mix phx.server

dev-mobile: ## Lance l'app Flutter
	cd apps/mobile && flutter run

dev-web: ## Lance la PWA React (Vite dev server)
	cd apps/web && npm run dev

test: ## Tests de toutes les apps
	cd apps/backend && mix test
	cd apps/mobile && flutter test
	cd apps/web && npm test

format: ## Formate tout
	cd apps/backend && mix format
	cd apps/mobile && dart format lib
	cd apps/web && npx prettier --write .
