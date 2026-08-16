SHELL := /bin/bash
.DEFAULT_GOAL := help
.PHONY: help install dev migrate makemigrations seed lint format test clean

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

install: ## Install Python dependencies with uv
	uv sync

dev: ## Run the API with auto-reload
	uv run app run --reload --host 0.0.0.0 --port 8000

migrate: ## Apply database migrations
	uv run app database upgrade

makemigrations: ## Autogenerate a new migration from model changes
	uv run app database revision --autogenerate -m "$(msg)"

seed: ## Load fixture data and create default roles
	uv run app users create-roles

lint: ## Run ruff
	uv run ruff check src/py/app
	uv run ruff format --check src/py/app

format: ## Auto-format with ruff
	uv run ruff check --fix src/py/app
	uv run ruff format src/py/app

test: ## Run the test suite
	uv run pytest src/py/tests --quiet

clean: ## Remove caches and build artifacts
	rm -rf .pytest_cache .ruff_cache .mypy_cache build dist *.egg-info
	find . -name '__pycache__' -exec rm -rf {} +
