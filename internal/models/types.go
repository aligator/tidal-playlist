package models

import "time"

// ArtistID represents a Tidal artist with id only
type ArtistID struct {
	ID string `json:"id"`
}

// Artist represents a Tidal artist
type Artist struct {
	ID         string `json:"id"`
	Attributes struct {
		Name string `json:"name"`
	} `json:"attributes"`
}

// Track represents a Tidal track
type Track struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Duration    int      `json:"duration"`
	TrackNumber int      `json:"trackNumber,omitempty"`
	ArtistID    string   `json:"artistId,omitempty"`
	AlbumID     string   `json:"albumId,omitempty"`
	Artists     []Artist `json:"artists,omitempty"`
}

// Album represents a Tidal album
type Album struct {
	ID             string   `json:"id"`
	Title          string   `json:"title"`
	Artists        []Artist `json:"artists,omitempty"`
	ReleaseDate    string   `json:"releaseDate,omitempty"`
	NumberOfTracks int      `json:"numberOfTracks,omitempty"`
}

// Playlist represents a Tidal playlist
type Playlist struct {
	ID             string    `json:"id"`   // JSON:API uses "id" not "uuid"
	UUID           string    `json:"uuid"` // Keep for backward compatibility
	Title          string    `json:"title"`
	Name           string    `json:"name"` // API might use "name" instead of "title"
	Description    string    `json:"description,omitempty"`
	Creator        Creator   `json:"creator,omitempty"`
	Created        time.Time `json:"created,omitempty"`
	LastUpdated    time.Time `json:"lastUpdated,omitempty"`
	NumberOfTracks int       `json:"numberOfTracks,omitempty"`
}

// GetID returns the playlist ID (prefers ID over UUID)
func (p *Playlist) GetID() string {
	if p.ID != "" {
		return p.ID
	}
	return p.UUID
}

// GetTitle returns the playlist title (prefers Title over Name)
func (p *Playlist) GetTitle() string {
	if p.Title != "" {
		return p.Title
	}
	return p.Name
}

// Creator represents the creator of a playlist
type Creator struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// PlaylistItem represents an item in a playlist
type PlaylistItem struct {
	ItemID string `json:"itemId"`
	Type   string `json:"type"` // Usually "track"
}

// APIResponse represents a generic API response with pagination
type APIResponse struct {
	Data     interface{} `json:"data"`
	Metadata Metadata    `json:"metadata,omitempty"`
}

// Metadata represents pagination metadata
type Metadata struct {
	Total  int `json:"total"`
	Offset int `json:"offset,omitempty"`
	Limit  int `json:"limit,omitempty"`
}

// ErrorResponse represents an API error response
type ErrorResponse struct {
	Status  int    `json:"status"`
	Message string `json:"message"`
	Error   string `json:"error,omitempty"`
}

// OAuth2Token represents stored OAuth tokens
type OAuth2Token struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	TokenType    string    `json:"token_type"`
	ExpiresAt    time.Time `json:"expires_at"`
}
