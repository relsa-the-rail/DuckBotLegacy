.DEFAULT_GOAL := help

prepare: ## Create app/.env from the template if it is missing
	@if [ ! -f ./app/.env ]; then cp ./app/.env.default ./app/.env; fi

up: prepare ## Build and start the bot and database in the background
	@docker compose up -d --build

restart: prepare ## Rebuild and restart just the bot
	@docker compose up -d --build --force-recreate duckbot

logs: ## Follow the bot logs
	@docker compose logs -f duckbot

shell: ## Open a shell inside the running bot container
	@docker compose exec duckbot sh

build: ## Build the bot image
	@docker compose build

down: ## Stop and remove the containers
	@docker compose down

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

.PHONY: prepare up restart logs shell build down help
