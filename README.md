# Tidal Playlist Generator

A CLI tool to automatically create random Tidal playlists from tracks by ALL your liked artists.

## Features

- **Automatic Playlist Generation**: Creates playlists from all your favorite Tidal artists
- **Configurable Track Selection**: Choose how many tracks per artist
- **Artist Filtering**: Blacklist or whitelist specific artists
- **Selection Modes**: Top tracks, random, or recent releases
- **Playlist Override**: Updates existing playlists with the same name
- **OAuth 2.1 PKCE**: Secure authentication with Tidal
- **Cross-Platform**: Single binary for Linux, macOS, and Windows

## Prerequisites

1. A Tidal account
2. Register an app at [Tidal Developer Portal](https://developer.tidal.com)
3. Get your `client_id` and `client_secret`

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/aligator/tidal-playlist
cd tidal-playlist

# Install dependencies
make deps

# Build
make build

# Install (optional)
make install
```

### Download Binary

Download pre-built binaries from the [Releases](https://github.com/aligator/tidal-playlist/releases) page.

## Configuration

1. Copy the example config file:
```bash
cp config.yaml.example config.yaml
```

2. Register Your App
Go to [Tidal Developer Portal](https://developer.tidal.com) and create an app to get your credentials.
**Important**: Set the redirect URL to `http://localhost:8080/callback` or wherever it is running

3. Edit `config.yaml` with your Tidal API credentials

## Usage

### Authenticate

First, authenticate with Tidal (only needed once):

```bash
./tidal-playlist auth
```

The token will be saved locally for future use.

### Create a Playlist

```bash
# Using default name from config
./tidal-playlist create

# With custom name
./tidal-playlist create "My Mix"

# With custom track count
./tidal-playlist create "Heavy Rotation" --count 10

# Dry run (preview without creating)
./tidal-playlist create "Test" --dry-run

# Using custom config file
./tidal-playlist create --config alt_config.yaml
```

## Examples

### Basic Usage

```bash
# Authenticate once
./tidal-playlist auth

# Create a playlist with 5 tracks per artist
./tidal-playlist create "My Daily Mix"
```

### Advanced Filtering

Edit `config.yaml`:

```yaml
filters:
  blacklist:
    - "3510943"
  whitelist: []  # Leave empty to use all except blacklisted
```

### Whitelist Mode

To ONLY include specific artists:

```yaml
filters:
  blacklist: []
  whitelist:
    - "945"
```

## How It Works

1. **Fetch Favorite Artists**: Retrieves all artists you've liked on Tidal
2. **Apply Filters**: Filters artists based on whitelist/blacklist
3. **Collect Tracks**: Fetches tracks from random artists
5. **Create/Replace Playlist**: Creates a new playlist or replace existing one

## Development

### Build

```bash
make build
```

### Run Tests

```bash
make test
```

### Build for All Platforms

```bash
make build-all
```

This creates binaries in the `build/` directory:
- `tidal-playlist-linux-amd64`
- `tidal-playlist-linux-arm64`
- `tidal-playlist-darwin-amd64`
- `tidal-playlist-darwin-arm64`
- `tidal-playlist-windows-amd64.exe`

## Troubleshooting

### Authentication Failed

- Ensure your `client_id` and `client_secret` are correct
- Check that your app is properly registered at developer.tidal.com

## Disclaimer

This tool is not affiliated with or endorsed by Tidal. Use at your own risk.
