package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/aligator/tidal-playlist/internal/config"
	"github.com/aligator/tidal-playlist/internal/models"
	"golang.org/x/oauth2"
)

const (
	baseURL = "https://openapi.tidal.com"
)

// Client represents a Tidal API client.
type Client struct {
	httpClient  *http.Client
	baseURL     string
	authMgr     *AuthManager
	rateLimiter chan struct{}
	config      *config.Config
}

// NewClient creates a new Tidal API client.
func NewClient(authMgr *AuthManager, config *config.Config) *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		baseURL:     baseURL,
		authMgr:     authMgr,
		rateLimiter: make(chan struct{}, 1), // Allow 1 request at a time
		config:      config,
	}
}

// doRequest performs an HTTP request with authentication.
func (c *Client) doRequest(ctx context.Context, method, endpoint string, body io.Reader) (*http.Response, error) {
	// Rate limiting: acquire semaphore
	c.rateLimiter <- struct{}{}
	defer func() {
		// Release after a delay
		time.Sleep(300 * time.Millisecond)
		<-c.rateLimiter
	}()

	url := c.baseURL + endpoint

	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Get valid token
	token, err := c.authMgr.GetValidToken(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get valid token: %w", err)
	}

	// Set headers
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)
	req.Header.Set("Content-Type", "application/vnd.api+json")
	req.Header.Set("Accept", "application/vnd.api+json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}

	// Check for API errors
	if resp.StatusCode >= 400 {
		defer resp.Body.Close()
		bodyBytes, _ := io.ReadAll(resp.Body)

		var apiErr models.ErrorResponse
		if err := json.Unmarshal(bodyBytes, &apiErr); err == nil {
			return nil, fmt.Errorf("API error (status %d): %s", apiErr.Status, apiErr.Message)
		}

		return nil, fmt.Errorf("HTTP error %d: %s", resp.StatusCode, string(bodyBytes))
	}

	return resp, nil
}

// get performs a GET request.
func (c *Client) get(ctx context.Context, endpoint string) (*http.Response, error) {
	return c.doRequest(ctx, http.MethodGet, endpoint, nil)
}

// post performs a POST request.
func (c *Client) post(ctx context.Context, endpoint string, payload interface{}) (*http.Response, error) {
	var body io.Reader
	if payload != nil {
		jsonData, err := json.Marshal(payload)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal payload: %w", err)
		}
		body = bytes.NewBuffer(jsonData)
	}
	return c.doRequest(ctx, http.MethodPost, endpoint, body)
}

// patch performs a PATCH request.
func (c *Client) patch(ctx context.Context, endpoint string, payload interface{}) (*http.Response, error) {
	var body io.Reader
	if payload != nil {
		jsonData, err := json.Marshal(payload)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal payload: %w", err)
		}
		body = bytes.NewBuffer(jsonData)
	}
	return c.doRequest(ctx, http.MethodPatch, endpoint, body)
}

// delete performs a DELETE request.
func (c *Client) delete(ctx context.Context, endpoint string) (*http.Response, error) {
	return c.doRequest(ctx, http.MethodDelete, endpoint, nil)
}

// GetUserID retrieves the current user's ID.
func (c *Client) GetUserID(ctx context.Context) (string, error) {
	// Tidal API doesn't have a simple userinfo endpoint
	// We need to extract the user ID from the token or use a workaround
	// Try using the OAuth userinfo endpoint (standard OAuth 2.0)

	// Get user info from /users/me endpoint
	resp, err := c.get(ctx, "/v2/users/me")
	if err != nil {
		return "", fmt.Errorf("failed to get user info: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read user info: %w", err)
	}

	// Parse JSON:API format response
	var userResponse struct {
		Data struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &userResponse); err != nil {
		return "", fmt.Errorf("failed to parse user info: %w", err)
	}

	if userResponse.Data.ID == "" {
		return "", fmt.Errorf("no user ID in response: %s", string(body))
	}

	return userResponse.Data.ID, nil
}

// WithToken creates a client with a specific token (for testing).
func (c *Client) WithToken(token *oauth2.Token) *Client {
	c.httpClient = oauth2.NewClient(context.Background(), oauth2.StaticTokenSource(token))
	return c
}
