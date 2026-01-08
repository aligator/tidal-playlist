package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"

	"github.com/aligator/tidal-playlist/internal/models"
)

// GetAlbumTracks retrieves all tracks from an album.
func (c *Client) GetAlbumTracks(ctx context.Context, albumID string) ([]models.Track, error) {
	endpoint := fmt.Sprintf("/v2/albums/%s?include=items&countryCode=%s", albumID, c.config.Tidal.CountryCode)
	resp, err := c.get(ctx, endpoint)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch album tracks: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Parse JSON:API format with included items
	var apiResp struct {
		Included []struct {
			ID         string `json:"id"`
			Type       string `json:"type"`
			Attributes struct {
				Title string `json:"title"`
			} `json:"attributes"`
		} `json:"included"`
	}
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Convert included items to Track models
	tracks := make([]models.Track, 0)
	for _, item := range apiResp.Included {
		if item.Type == "tracks" {
			tracks = append(tracks, models.Track{
				ID:    item.ID,
				Title: item.Attributes.Title,
			})
		}
	}

	return tracks, nil
}
