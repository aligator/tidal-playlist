.PHONY: build run install test clean build-all help

# Binary name
BINARY_NAME=tidal-playlist

# Build directory
BUILD_DIR=build

# Go parameters
GOCMD=go
GOBUILD=$(GOCMD) build
GORUN=$(GOCMD) run
GOTEST=$(GOCMD) test
GOGET=$(GOCMD) get
GOMOD=$(GOCMD) mod
GOCLEAN=$(GOCMD) clean

# Build the project
build:
	@echo "Building $(BINARY_NAME)..."
	$(GOBUILD) -o $(BINARY_NAME) ./cmd/tidal-playlist

# Run the project with arguments
# Usage: make run -- create "My Playlist" --tracks 10
run:
	$(GORUN) ./cmd/tidal-playlist $(filter-out $@,$(MAKECMDGOALS))

# Catch-all target to prevent "No rule to make target" errors
%:
	@:

# Install dependencies
deps:
	@echo "Installing dependencies..."
	$(GOGET) github.com/spf13/cobra
	$(GOGET) github.com/spf13/viper
	$(GOGET) golang.org/x/oauth2
	$(GOGET) gopkg.in/yaml.v3
	$(GOMOD) tidy

# Install the binary
install: build
	@echo "Installing $(BINARY_NAME)..."
	@cp $(BINARY_NAME) $(GOPATH)/bin/

# Run tests
test:
	@echo "Running tests..."
	$(GOTEST) -v ./...

# Clean build artifacts
clean:
	@echo "Cleaning..."
	$(GOCLEAN)
	@rm -f $(BINARY_NAME)
	@rm -rf $(BUILD_DIR)

# Build for all platforms
build-all: clean
	@echo "Building for multiple platforms..."
	@mkdir -p $(BUILD_DIR)

	@echo "Building for Linux (amd64)..."
	GOOS=linux GOARCH=amd64 $(GOBUILD) -o $(BUILD_DIR)/$(BINARY_NAME)-linux-amd64 ./cmd/tidal-playlist

	@echo "Building for Linux (arm64)..."
	GOOS=linux GOARCH=arm64 $(GOBUILD) -o $(BUILD_DIR)/$(BINARY_NAME)-linux-arm64 ./cmd/tidal-playlist

	@echo "Building for macOS (amd64)..."
	GOOS=darwin GOARCH=amd64 $(GOBUILD) -o $(BUILD_DIR)/$(BINARY_NAME)-darwin-amd64 ./cmd/tidal-playlist

	@echo "Building for macOS (arm64)..."
	GOOS=darwin GOARCH=arm64 $(GOBUILD) -o $(BUILD_DIR)/$(BINARY_NAME)-darwin-arm64 ./cmd/tidal-playlist

	@echo "Building for Windows (amd64)..."
	GOOS=windows GOARCH=amd64 $(GOBUILD) -o $(BUILD_DIR)/$(BINARY_NAME)-windows-amd64.exe ./cmd/tidal-playlist

	@echo "Build complete! Binaries are in $(BUILD_DIR)/"

# Show help
help:
	@echo "Available targets:"
	@echo "  build      - Build the binary"
	@echo "  run        - Run the application"
	@echo "  deps       - Install dependencies"
	@echo "  install    - Install binary to GOPATH/bin"
	@echo "  test       - Run tests"
	@echo "  clean      - Remove build artifacts"
	@echo "  build-all  - Build for all platforms"
	@echo "  help       - Show this help message"

# Default target
.DEFAULT_GOAL := build
