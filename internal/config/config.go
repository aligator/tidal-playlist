package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/viper"
)

// Config represents the application configuration.
type Config struct {
	Tidal    TidalConfig    `mapstructure:"tidal"`
	Playlist PlaylistConfig `mapstructure:"playlist"`
	Filters  FiltersConfig  `mapstructure:"filters"`
}

// TidalConfig holds Tidal API credentials.
type TidalConfig struct {
	ClientID     string `mapstructure:"client_id"`
	ClientSecret string `mapstructure:"client_secret"`
	CountryCode  string `mapstructure:"country_code"`
}

// PlaylistConfig holds playlist generation settings.
type PlaylistConfig struct {
	DefaultName string `mapstructure:"default_name"`
	Count       int    `mapstructure:"count"`
}

// FiltersConfig holds artist filtering settings.
type FiltersConfig struct {
	Blacklist []string `mapstructure:"blacklist"`
	Whitelist []string `mapstructure:"whitelist"`
}

// Load loads configuration from file and environment.
func Load(configPath string) (*Config, error) {
	v := viper.New()

	// Set defaults
	v.SetDefault("tidal.country_code", "US")
	v.SetDefault("playlist.default_name", "My Artists Mix")
	v.SetDefault("playlist.tracks_per_artist", 5)
	v.SetDefault("playlist.total_track_limit", 500)

	// Try to read config file
	if configPath != "" {
		v.SetConfigFile(configPath)
	} else {
		// Look for config in current directory and home directory
		v.SetConfigName("config")
		v.SetConfigType("yaml")
		v.AddConfigPath(".")

		homeDir, err := os.UserHomeDir()
		if err == nil {
			v.AddConfigPath(filepath.Join(homeDir, ".config", "tidal-playlist"))
		}
	}

	// Read config file if it exists
	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("failed to read config file: %w", err)
		}
		// Config file not found is okay, we'll use defaults
	}

	// Environment variables override config file
	v.SetEnvPrefix("TIDAL")
	v.AutomaticEnv()

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return &cfg, nil
}

// Validate checks if the configuration is valid.
func (c *Config) Validate() error {
	if c.Tidal.ClientID == "" {
		return fmt.Errorf("tidal.client_id is required")
	}
	if c.Tidal.ClientSecret == "" {
		return fmt.Errorf("tidal.client_secret is required")
	}
	if c.Playlist.Count < 1 {
		return fmt.Errorf("playlist.count must be at least 1")
	}

	return nil
}
