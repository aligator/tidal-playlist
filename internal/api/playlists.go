package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"

	"github.com/aligator/tidal-playlist/internal/models"
)

// GetUserPlaylists retrieves all playlists for the current user.
func (c *Client) GetUserPlaylists(ctx context.Context) ([]models.Playlist, error) {
	userID, err := c.GetUserID(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get user ID: %w", err)
	}

	// Use /playlists endpoint with filter to get full playlist data
	endpoint := fmt.Sprintf("/v2/playlists?filter[owners.id]=%s", userID)
	resp, err := c.get(ctx, endpoint)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch playlists: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Parse JSON:API format with attributes
	var apiResp struct {
		Data []struct {
			ID         string `json:"id"`
			Type       string `json:"type"`
			Attributes struct {
				Name        string `json:"name"`
				Description string `json:"description"`
			} `json:"attributes"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Convert to Playlist models
	playlists := make([]models.Playlist, len(apiResp.Data))
	for i, item := range apiResp.Data {
		playlists[i] = models.Playlist{
			ID:          item.ID,
			Name:        item.Attributes.Name,
			Title:       item.Attributes.Name,
			Description: item.Attributes.Description,
		}
	}

	return playlists, nil
}

// GetPlaylist retrieves a specific playlist by UUID.
func (c *Client) GetPlaylist(ctx context.Context, playlistUUID string) (*models.Playlist, error) {
	endpoint := fmt.Sprintf("/v2/playlists/%s", playlistUUID)
	resp, err := c.get(ctx, endpoint)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch playlist: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Parse JSON:API format with attributes
	var apiResp struct {
		Data struct {
			ID         string `json:"id"`
			Type       string `json:"type"`
			Attributes struct {
				Name        string `json:"name"`
				Description string `json:"description"`
			} `json:"attributes"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	playlist := &models.Playlist{
		ID:          apiResp.Data.ID,
		Name:        apiResp.Data.Attributes.Name,
		Title:       apiResp.Data.Attributes.Name, // Copy to Title for compatibility
		Description: apiResp.Data.Attributes.Description,
	}

	return playlist, nil
}

// CreatePlaylist creates a new playlist.
func (c *Client) CreatePlaylist(ctx context.Context, title, description string) (*models.Playlist, error) {
	// JSON:API format
	payload := map[string]interface{}{
		"data": map[string]interface{}{
			"type": "playlists",
			"attributes": map[string]interface{}{
				"name":        title,
				"description": description,
			},
		},
	}

	resp, err := c.post(ctx, "/v2/playlists", payload)
	if err != nil {
		return nil, fmt.Errorf("failed to create playlist: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Parse JSON:API format with attributes
	var apiResp struct {
		Data struct {
			ID         string `json:"id"`
			Type       string `json:"type"`
			Attributes struct {
				Name        string `json:"name"`
				Description string `json:"description"`
			} `json:"attributes"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	playlist := &models.Playlist{
		ID:          apiResp.Data.ID,
		Name:        apiResp.Data.Attributes.Name,
		Title:       apiResp.Data.Attributes.Name,
		Description: apiResp.Data.Attributes.Description,
	}

	return playlist, nil
}

// UpdatePlaylistMetadata updates a playlist's title and description.
func (c *Client) UpdatePlaylistMetadata(ctx context.Context, playlistUUID, title, description string) error {
	payload := map[string]interface{}{
		"title":       title,
		"description": description,
	}

	endpoint := fmt.Sprintf("/v2/playlists/%s", playlistUUID)
	resp, err := c.patch(ctx, endpoint, payload)
	if err != nil {
		return fmt.Errorf("failed to update playlist: %w", err)
	}
	defer resp.Body.Close()

	return nil
}

// SetPlaylistTracks sets tracks of a playlist.
func (c *Client) SetPlaylistTracks(ctx context.Context, playlistUUID string, trackIDs []string) error {
	// Convert track IDs to JSON:API format
	data := make([]map[string]interface{}, len(trackIDs))
	for i, trackID := range trackIDs {
		data[i] = map[string]interface{}{
			"type": "tracks",
			"id":   trackID,
		}
	}

	payload := map[string]interface{}{
		"data": data,
	}

	endpoint := fmt.Sprintf("/v2/playlists/%s/relationships/items", playlistUUID)
	resp, err := c.post(ctx, endpoint, payload)
	if err != nil {
		return fmt.Errorf("failed to add tracks to playlist: %w", err)
	}
	defer resp.Body.Close()

	return nil
}

// FindPlaylistByName finds a playlist by name (case-insensitive).
func (c *Client) FindPlaylistByName(ctx context.Context, name string) (*models.Playlist, error) {
	playlists, err := c.GetUserPlaylists(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get user playlists: %w", err)
	}

	for _, playlist := range playlists {
		if playlist.GetTitle() == name {
			return &playlist, nil
		}
	}

	return nil, nil // Not found
}

// FindAllPlaylistsByName finds all playlists with the exact same name.
func (c *Client) FindAllPlaylistsByName(ctx context.Context, name string) ([]models.Playlist, error) {
	playlists, err := c.GetUserPlaylists(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get user playlists: %w", err)
	}

	var matches []models.Playlist
	for _, playlist := range playlists {
		if playlist.GetTitle() == name {
			matches = append(matches, playlist)
		}
	}

	return matches, nil
}

// DeletePlaylist deletes a playlist by UUID.
func (c *Client) DeletePlaylist(ctx context.Context, playlistUUID string) error {
	endpoint := fmt.Sprintf("/v2/playlists/%s", playlistUUID)
	resp, err := c.delete(ctx, endpoint)
	if err != nil {
		return fmt.Errorf("failed to delete playlist: %w", err)
	}
	defer resp.Body.Close()

	return nil
}

// CreateOrUpdatePlaylist creates a new playlist or updates an existing one.
func (c *Client) CreateOrUpdatePlaylist(ctx context.Context, name, description string, trackIDs []string) (*models.Playlist, error) {
	// Find all existing playlists with the same name
	existingPlaylists, err := c.FindAllPlaylistsByName(ctx, name)
	if err != nil {
		return nil, fmt.Errorf("failed to search for existing playlists: %w", err)
	}

	for _, playlist := range existingPlaylists {
		err := c.DeletePlaylist(ctx, playlist.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to delete playlist %s: %w", playlist.ID, err)
		}
	}

	fmt.Printf("Creating new playlist '%s'...\n", name)

	playlist, err := c.CreatePlaylist(ctx, name, description)
	if err != nil {
		return nil, fmt.Errorf("failed to create playlist: %w", err)
	}

	// Add tracks in batches (API limit is 20 tracks per request)
	batchSize := 20
	for i := 0; i < len(trackIDs); i += batchSize {
		end := i + batchSize
		if end > len(trackIDs) {
			end = len(trackIDs)
		}

		batch := trackIDs[i:end]
		if err := c.SetPlaylistTracks(ctx, playlist.GetID(), batch); err != nil {
			return nil, fmt.Errorf("failed to add tracks to playlist: %w", err)
		}

		fmt.Printf("Added %d tracks...\n", end)
	}

	return playlist, nil
}
