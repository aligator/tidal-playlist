package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"

	"github.com/aligator/tidal-playlist/internal/models"
)

// GetFavoriteArtists retrieves all favorite/liked artists for the user.
func (c *Client) GetFavoriteArtists(ctx context.Context) ([]models.ArtistID, error) {
	userID, err := c.GetUserID(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get user ID: %w", err)
	}

	var allArtists []models.ArtistID
	cursor := ""

	for {
		endpoint := fmt.Sprintf("/v2/userCollections/%s/relationships/artists", userID)
		if cursor != "" {
			endpoint += fmt.Sprintf("?page[cursor]=%s", cursor)
		}

		resp, err := c.get(ctx, endpoint)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch favorite artists: %w", err)
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to read response body: %w", err)
		}

		// Parse response
		var apiResp struct {
			Data  []models.ArtistID `json:"data"`
			Links struct {
				Meta struct {
					NextCursor string `json:"nextCursor"`
				} `json:"meta"`
			} `json:"links"`
		}

		if err := json.Unmarshal(body, &apiResp); err != nil {
			return nil, fmt.Errorf("failed to parse response: %w", err)
		}

		allArtists = append(allArtists, apiResp.Data...)

		// Check if there are more pages
		if apiResp.Links.Meta.NextCursor == "" {
			break
		}

		cursor = apiResp.Links.Meta.NextCursor
	}

	return allArtists, nil
}

// GetArtist retrieves information about a specific artist.
func (c *Client) GetArtist(ctx context.Context, artistID string) (*models.Artist, error) {
	endpoint := fmt.Sprintf("/v2/artists/%s?countryCode=%s", artistID, c.config.Tidal.CountryCode)
	resp, err := c.get(ctx, endpoint)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch artist: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var apiResp struct {
		Data models.Artist `json:"data"`
	}
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &apiResp.Data, nil
}

// GetArtistAlbums retrieves albums for a specific artist.
func (c *Client) GetArtistAlbums(ctx context.Context, artistID string, limit int) ([]models.Album, error) {
	// Use include parameter to get full album data
	endpoint := fmt.Sprintf("/v2/artists/%s?include=albums&countryCode=%s", artistID, c.config.Tidal.CountryCode)

	resp, err := c.get(ctx, endpoint)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch artist albums: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Parse JSON:API format with included albums
	var apiResp struct {
		Included []struct {
			ID         string `json:"id"`
			Type       string `json:"type"`
			Attributes struct {
				Title string `json:"title"`
			} `json:"attributes"`
		} `json:"included"`
		UnknownFields map[string]any `json:"-"`
	}
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Convert included items to Album models
	albums := make([]models.Album, 0)
	for _, item := range apiResp.Included {
		if item.Type == "albums" {
			albums = append(albums, models.Album{
				ID:    item.ID,
				Title: item.Attributes.Title,
			})
		}
	}

	// Limit to requested number
	if len(albums) > limit {
		albums = albums[:limit]
	}

	return albums, nil
}
