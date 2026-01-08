package builder

import (
	"context"
	"fmt"
	"math/rand"
	"slices"
	"strings"

	"github.com/aligator/tidal-playlist/internal/api"
	"github.com/aligator/tidal-playlist/internal/config"
	"github.com/aligator/tidal-playlist/internal/models"
)

// selectRandomItems returns from the source items a random selection.
// One item may be selected multiple times.
func selectRandomItems[T any](count int, source []T) []T {
	result := make([]T, count)
	for i := 0; i < count; i++ {
		randomRobert := rand.Intn(len(source))
		result[i] = source[randomRobert]
	}
	return result
}

// Builder handles playlist generation logic.
type Builder struct {
	client *api.Client
	config *config.Config
}

// NewBuilder creates a new playlist builder.
func NewBuilder(client *api.Client, cfg *config.Config) *Builder {
	return &Builder{
		client: client,
		config: cfg,
	}
}

// FilterArtists applies whitelist and blacklist filters to artists.
func (b *Builder) FilterArtists(artists []models.ArtistID) []models.ArtistID {
	// If whitelist is set, only include artists in whitelist
	if len(b.config.Filters.Whitelist) > 0 {
		return b.filterByWhitelist(artists)
	}

	// Otherwise apply blacklist
	if len(b.config.Filters.Blacklist) > 0 {
		return b.filterByBlacklist(artists)
	}

	// No filters, return all
	return artists
}

// filterByWhitelist returns only artists in the whitelist.
func (b *Builder) filterByWhitelist(artists []models.ArtistID) []models.ArtistID {
	whitelist := make(map[string]bool)
	for _, name := range b.config.Filters.Whitelist {
		whitelist[strings.ToLower(name)] = true
	}

	var filtered []models.ArtistID
	for _, artist := range artists {
		if whitelist[strings.ToLower(artist.ID)] {
			filtered = append(filtered, artist)
		}
	}

	return filtered
}

// filterByBlacklist returns artists not in the blacklist.
func (b *Builder) filterByBlacklist(artists []models.ArtistID) []models.ArtistID {
	blacklist := make(map[string]bool)
	for _, name := range b.config.Filters.Blacklist {
		blacklist[strings.ToLower(name)] = true
	}

	var filtered []models.ArtistID
	for _, artist := range artists {
		if !blacklist[strings.ToLower(artist.ID)] {
			filtered = append(filtered, artist)
		}
	}

	return filtered
}

// CollectTracks collects exactly totalTrackLimit tracks randomly.
// Strategy: For each track slot, pick a random artist, random album, random track.
func (b *Builder) CollectTracks(ctx context.Context, artists []models.ArtistID) ([]*models.Track, error) {
	result := make([]*models.Track, len(artists))

	// Sort the artists so that the same artists are grouped and fetching its albums
	// can only be done once.
	slices.SortFunc(artists, func(a, b models.ArtistID) int {
		return strings.Compare(a.ID, b.ID)
	})

	lastArtist := ""
	lastAlbums := []models.Album{}
	for i, artistId := range artists {
		artist, err := b.client.GetArtist(ctx, artistId.ID)
		if err != nil {
			fmt.Printf("Warning: failed to get more information about the artist %s: %v\n", artist.ID, err)
			artist = &models.Artist{
				ID: artistId.ID,
			}
		}

		if lastArtist == "" || lastArtist != artist.ID {
			fmt.Println(artist.Attributes.Name + " (" + artist.ID + ")")
			albums, err := b.client.GetArtistAlbums(ctx, artist.ID, 100)
			if err != nil || len(albums) == 0 {
				fmt.Printf("Warning: failed to get albums for %s: %v\n", artist.ID, err)
				continue
			}

			lastArtist = artist.ID
			lastAlbums = albums
		}

		randomAlbum := lastAlbums[rand.Intn(len(lastAlbums))]
		fmt.Printf("  %s - ", randomAlbum.Title)

		// Get tracks from that album.
		tracks, err := b.client.GetAlbumTracks(ctx, randomAlbum.ID)
		if err == nil && len(tracks) > 0 {
			// Pick random track.
			randomTrack := tracks[rand.Intn(len(tracks))]
			result[i] = &randomTrack
			fmt.Println(randomTrack.Title)
		}
	}

	return result, nil
}

// BuildPlaylist orchestrates the entire playlist generation process.
func (b *Builder) BuildPlaylist(ctx context.Context, playlistName string, dryRun bool) error {
	fmt.Println("Fetching favorite artists...\n")
	artists, err := b.client.GetFavoriteArtists(ctx)
	if err != nil {
		return fmt.Errorf("failed to fetch favorite artists: %w", err)
	}

	fmt.Printf("Found %d favorite artists\n", len(artists))

	// Apply filters
	filteredArtists := b.FilterArtists(artists)
	fmt.Printf("After filtering: %d artists\n", len(filteredArtists))
	if len(filteredArtists) == 0 {
		return fmt.Errorf("no artists remaining after filtering")
	}

	selectedArtists := selectRandomItems(b.config.Playlist.Count, filteredArtists)

	// Collect tracks
	fmt.Println("\nCollecting tracks from artists...")
	tracks, err := b.CollectTracks(ctx, selectedArtists)
	if err != nil {
		return fmt.Errorf("failed to collect tracks: %w", err)
	}

	fmt.Printf("\nCollected %d total tracks\n", len(tracks))

	if len(tracks) == 0 {
		return fmt.Errorf("no tracks collected from artists")
	}

	finalTracks := []models.Track{}
	for _, track := range tracks {
		if track == nil {
			continue
		}
		finalTracks = append(finalTracks, *track)
	}

	fmt.Printf("Final track count: %d\n", len(finalTracks))

	if dryRun {
		fmt.Println("\n=== DRY RUN MODE ===")
		fmt.Printf("Would create/update playlist '%s' with %d tracks\n", playlistName, len(finalTracks))
		fmt.Println("\nTracks:")
		for i, track := range finalTracks {
			if i >= 10 {
				break
			}
			artistNames := ""
			if len(track.Artists) > 0 {
				artistNames = track.Artists[0].Attributes.Name
			}
			fmt.Printf("  %d. %s - %s\n", i+1, artistNames, track.Title)
		}
		fmt.Println("  ...")
		return nil
	}

	// Extract track IDs
	trackIDs := make([]string, len(finalTracks))
	for i, track := range finalTracks {
		trackIDs[i] = track.ID
	}

	// Create or update playlist
	fmt.Printf("\nCreating/updating playlist '%s'...\n", playlistName)
	playlist, err := b.client.CreateOrUpdatePlaylist(ctx, playlistName, "Generated by tidal-playlist", trackIDs)
	if err != nil {
		return fmt.Errorf("failed to create/update playlist: %w", err)
	}

	fmt.Printf("\n✓ Success! Playlist '%s' created/updated with %d tracks\n", playlist.GetTitle(), len(trackIDs))
	return nil
}
