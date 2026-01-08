package main

import (
	"context"
	"fmt"
	"os"

	"github.com/aligator/tidal-playlist/internal/api"
	"github.com/aligator/tidal-playlist/internal/builder"
	"github.com/aligator/tidal-playlist/internal/config"
	"github.com/spf13/cobra"
)

var (
	configPath   string
	playlistName string
	count        int
	dryRun       bool
	verbose      bool
)

var rootCmd = &cobra.Command{
	Use:   "tidal-playlist",
	Short: "Generate Tidal playlists from your favorite artists",
	Long: `A CLI tool to automatically create Tidal playlists containing tracks
from ALL your liked artists, with configurable filtering and selection options.`,
}

var authCmd = &cobra.Command{
	Use:   "auth",
	Short: "Authenticate with Tidal",
	Long:  "Authenticate with your Tidal account.",
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load(configPath)
		if err != nil {
			return fmt.Errorf("failed to load config: %w", err)
		}

		if err := cfg.Validate(); err != nil {
			return fmt.Errorf("invalid config: %w", err)
		}

		authMgr := api.NewAuthManager(cfg.Tidal.ClientID, cfg.Tidal.ClientSecret)

		fmt.Println("Starting OAuth authorization...")
		fmt.Println("Opening browser for Tidal login...")
		token, err := authMgr.Login(context.Background())
		if err != nil {
			return fmt.Errorf("authentication failed: %w", err)
		}

		fmt.Println("\n✓ Authentication successful!")
		fmt.Printf("Access token expires at: %s\n", token.Expiry.Format("2006-01-02 15:04:05"))
		return nil
	},
}

var createCmd = &cobra.Command{
	Use:   "create [playlist-name]",
	Short: "Create or update a playlist",
	Long: `Create a new playlist or update an existing one with tracks from
all your favorite artists. If a playlist with the same name exists,
it will be cleared and updated with new tracks.`,
	Args: cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load(configPath)
		if err != nil {
			return fmt.Errorf("failed to load config: %w", err)
		}

		if err := cfg.Validate(); err != nil {
			return fmt.Errorf("invalid config: %w", err)
		}

		// Override config with CLI flags if provided
		if count > 0 {
			cfg.Playlist.Count = count
		}

		// Determine playlist name
		name := cfg.Playlist.DefaultName
		if len(args) > 0 {
			name = args[0]
		} else if playlistName != "" {
			name = playlistName
		}

		// Create API client
		authMgr := api.NewAuthManager(cfg.Tidal.ClientID, cfg.Tidal.ClientSecret)
		client := api.NewClient(authMgr, cfg)

		// Create builder
		b := builder.NewBuilder(client, cfg)

		// Build playlist
		ctx := context.Background()
		if err := b.BuildPlaylist(ctx, name, dryRun); err != nil {
			return fmt.Errorf("failed to build playlist: %w", err)
		}

		return nil
	},
}

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print version information",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("tidal-playlist v0.1.0")
	},
}

func init() {
	// Global flags
	rootCmd.PersistentFlags().StringVarP(&configPath, "config", "", "", "config file (default: ./config.yaml)")
	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "verbose output")

	// Create command flags
	createCmd.Flags().StringVarP(&playlistName, "name", "n", "", "playlist name")
	createCmd.Flags().IntVarP(&count, "count", "c", 0, "number of tracks (overrides config)")
	createCmd.Flags().BoolVar(&dryRun, "dry-run", false, "preview what would be created without making changes")

	// Add commands
	rootCmd.AddCommand(authCmd)
	rootCmd.AddCommand(createCmd)
	rootCmd.AddCommand(versionCmd)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
