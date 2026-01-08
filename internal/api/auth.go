package api

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/aligator/tidal-playlist/internal/models"
	"golang.org/x/oauth2"
)

const (
	authURL  = "https://login.tidal.com/authorize"
	tokenURL = "https://auth.tidal.com/v1/oauth2/token"
)

// AuthManager handles OAuth authentication.
type AuthManager struct {
	clientID     string
	clientSecret string
	config       *oauth2.Config
	tokenFile    string
}

// NewAuthManager creates a new authentication manager.
func NewAuthManager(clientID, clientSecret string) *AuthManager {
	homeDir, _ := os.UserHomeDir()
	tokenFile := filepath.Join(homeDir, ".config", "tidal-playlist", "token.json")

	return &AuthManager{
		clientID:     clientID,
		clientSecret: clientSecret,
		tokenFile:    tokenFile,
		config: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			Endpoint: oauth2.Endpoint{
				AuthURL:  authURL,
				TokenURL: tokenURL,
			},
			RedirectURL: "http://localhost:8080/callback",
			Scopes:      []string{"user.read", "collection.read", "collection.write", "playlists.read", "playlists.write"},
		},
	}
}

// LoginWithClientCredentials uses client credentials flow (simpler, no browser needed).
func (a *AuthManager) LoginWithClientCredentials(ctx context.Context) (*oauth2.Token, error) {
	// Create Basic Auth header
	credentials := fmt.Sprintf("%s:%s", a.clientID, a.clientSecret)
	b64Creds := base64.StdEncoding.EncodeToString([]byte(credentials))

	// Prepare form data
	data := url.Values{}
	data.Set("grant_type", "client_credentials")

	// Create request
	req, err := http.NewRequestWithContext(ctx, "POST", tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Basic "+b64Creds)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	// Execute request
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	// Check response
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("authentication failed with status %d", resp.StatusCode)
	}

	// Parse response
	var tokenResp struct {
		AccessToken string `json:"access_token"`
		TokenType   string `json:"token_type"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Create OAuth2 token
	token := &oauth2.Token{
		AccessToken: tokenResp.AccessToken,
		TokenType:   tokenResp.TokenType,
		Expiry:      time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second),
	}

	// Save token
	if err := a.SaveToken(token); err != nil {
		return nil, fmt.Errorf("failed to save token: %w", err)
	}

	return token, nil
}

// generatePKCE generates PKCE code verifier and challenge.
func generatePKCE() (verifier, challenge string, err error) {
	// Generate code verifier (43-128 characters)
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}
	verifier = base64.RawURLEncoding.EncodeToString(b)

	// Generate code challenge (SHA256 hash of verifier)
	h := sha256.New()
	h.Write([]byte(verifier))
	challenge = base64.RawURLEncoding.EncodeToString(h.Sum(nil))

	return verifier, challenge, nil
}

// Login performs OAuth 2.1 PKCE authentication flow (requires browser).
func (a *AuthManager) Login(ctx context.Context) (*oauth2.Token, error) {
	// Generate PKCE parameters
	verifier, challenge, err := generatePKCE()
	if err != nil {
		return nil, fmt.Errorf("failed to generate PKCE: %w", err)
	}

	// Create OAuth config with PKCE
	authURL := a.config.AuthCodeURL("state",
		oauth2.SetAuthURLParam("code_challenge", challenge),
		oauth2.SetAuthURLParam("code_challenge_method", "S256"),
	)

	// Start local server to receive callback
	codeChan := make(chan string, 1)
	errChan := make(chan error, 1)

	server := &http.Server{Addr: ":8080"}
	http.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		code := r.URL.Query().Get("code")
		if code == "" {
			errChan <- fmt.Errorf("no code in callback")
			fmt.Fprintf(w, "Authentication failed: no code received")
			return
		}
		codeChan <- code
		fmt.Fprintf(w, "Authentication successful! You can close this window.")
	})

	go func() {
		if err := server.ListenAndServe(); err != http.ErrServerClosed {
			errChan <- err
		}
	}()

	fmt.Println("Please open the following URL in your browser to authenticate:")
	fmt.Println(authURL)
	fmt.Println("\nWaiting for authentication...")

	// Wait for callback or timeout
	var code string
	select {
	case code = <-codeChan:
		// Got the code
	case err := <-errChan:
		return nil, fmt.Errorf("callback server error: %w", err)
	case <-time.After(5 * time.Minute):
		return nil, fmt.Errorf("authentication timeout")
	}

	// Shutdown the server
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	server.Shutdown(shutdownCtx)

	// Exchange code for token with PKCE verifier
	token, err := a.config.Exchange(ctx, code,
		oauth2.SetAuthURLParam("code_verifier", verifier),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code for token: %w", err)
	}

	// Save token to file
	if err := a.SaveToken(token); err != nil {
		return nil, fmt.Errorf("failed to save token: %w", err)
	}

	return token, nil
}

// LoadToken loads a saved OAuth token from file.
func (a *AuthManager) LoadToken() (*oauth2.Token, error) {
	data, err := os.ReadFile(a.tokenFile)
	if err != nil {
		return nil, err
	}

	var storedToken models.OAuth2Token
	if err := json.Unmarshal(data, &storedToken); err != nil {
		return nil, err
	}

	token := &oauth2.Token{
		AccessToken:  storedToken.AccessToken,
		RefreshToken: storedToken.RefreshToken,
		TokenType:    storedToken.TokenType,
		Expiry:       storedToken.ExpiresAt,
	}

	// Check if token is expired and needs refresh
	if token.Expiry.Before(time.Now()) && token.RefreshToken != "" {
		return a.RefreshToken(context.Background(), token)
	}

	return token, nil
}

// SaveToken saves an OAuth token to file.
func (a *AuthManager) SaveToken(token *oauth2.Token) error {
	// Create config directory if it doesn't exist
	dir := filepath.Dir(a.tokenFile)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}

	storedToken := models.OAuth2Token{
		AccessToken:  token.AccessToken,
		RefreshToken: token.RefreshToken,
		TokenType:    token.TokenType,
		ExpiresAt:    token.Expiry,
	}

	data, err := json.MarshalIndent(storedToken, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(a.tokenFile, data, 0600)
}

// RefreshToken refreshes an expired OAuth token.
func (a *AuthManager) RefreshToken(ctx context.Context, token *oauth2.Token) (*oauth2.Token, error) {
	// Client credentials tokens don't have refresh tokens
	if token.RefreshToken == "" {
		return a.LoginWithClientCredentials(ctx)
	}

	tokenSource := a.config.TokenSource(ctx, token)
	newToken, err := tokenSource.Token()
	if err != nil {
		return nil, fmt.Errorf("failed to refresh token: %w", err)
	}

	// Save refreshed token
	if err := a.SaveToken(newToken); err != nil {
		return nil, fmt.Errorf("failed to save refreshed token: %w", err)
	}

	return newToken, nil
}

// GetValidToken returns a valid token, refreshing if necessary.
func (a *AuthManager) GetValidToken(ctx context.Context) (*oauth2.Token, error) {
	token, err := a.LoadToken()
	if err != nil {
		return nil, fmt.Errorf("no saved token found, please run 'tidal-playlist auth' first: %w", err)
	}

	// Check if token needs refresh
	if token.Expiry.Before(time.Now().Add(1 * time.Minute)) {
		return a.RefreshToken(ctx, token)
	}

	return token, nil
}
