// bedrock-transport: a small Go binary that handles the Bedrock / RakNet / auth
// side of the Claude bot. Spawned as a child process by Node.js bot.js.
//
// Protocol between Node and this binary:
//
//   stdout (JSON lines, one event per line):
//     {"type":"msa_signed_in"}
//     {"type":"connected","name":".Gamertag","xuid":"..."}
//     {"type":"chat","sender":".someone","message":"hi"}
//     {"type":"disconnect","reason":"..."}
//     {"type":"error","error":"..."}
//
//   stdin (JSON lines, one command per line):
//     {"type":"chat","message":"Hello from Claude"}
//     {"type":"disconnect"}
//
// stderr is used for human-readable logging and the device code sign-in
// prompt from gophertunnel's auth package — pass through to the user.

package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/sandertv/gophertunnel/minecraft"
	"github.com/sandertv/gophertunnel/minecraft/auth"
	"github.com/sandertv/gophertunnel/minecraft/protocol/packet"
	"golang.org/x/oauth2"
)

type Event struct {
	Type    string `json:"type"`
	Name    string `json:"name,omitempty"`
	XUID    string `json:"xuid,omitempty"`
	Sender  string `json:"sender,omitempty"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
	Reason  string `json:"reason,omitempty"`
}

type Command struct {
	Type    string `json:"type"`
	Message string `json:"message,omitempty"`
}

var (
	stdoutEnc = json.NewEncoder(os.Stdout)
	stdoutMu  sync.Mutex
)

func emit(e Event) {
	stdoutMu.Lock()
	defer stdoutMu.Unlock()
	_ = stdoutEnc.Encode(e)
}

func logf(format string, args ...interface{}) {
	fmt.Fprintf(os.Stderr, "[go] "+format+"\n", args...)
}

// extractChat normalizes a packet.Text into (sender, message) across the various
// TextType values Geyser may use when forwarding Java chat to a Bedrock client.
//
//   - TextTypeChat / TextTypeWhisper: sender = SourceName, message = Message
//   - TextTypeRaw: message is pre-formatted like "<sender> body" — parse it
//   - TextTypeTranslation: message is a translate key like "chat.type.text"
//     with sender/body in Parameters
//   - anything else: ignored
func extractChat(p *packet.Text) (sender, message string) {
	switch p.TextType {
	case packet.TextTypeChat, packet.TextTypeWhisper:
		// Ideal case: separate source and body
		if p.SourceName != "" {
			return p.SourceName, p.Message
		}
		// Geyser often leaves SourceName empty and formats the message
		// as "<sender> body" (Java-style). Fall through to raw parsing.
		fallthrough
	case packet.TextTypeRaw:
		s := stripColors(p.Message)
		if len(s) > 0 && s[0] == '<' {
			if end := indexByte(s, '>'); end > 1 {
				name := s[1:end]
				body := s[end+1:]
				if len(body) > 0 && body[0] == ' ' {
					body = body[1:]
				}
				return name, body
			}
		}
		return "", ""
	case packet.TextTypeTranslation:
		// Typical form: key="chat.type.text" params=["<sender>", "<body>"]
		if len(p.Parameters) >= 2 {
			return stripColors(p.Parameters[0]), stripColors(p.Parameters[1])
		}
		return "", ""
	default:
		return "", ""
	}
}

// stripColors removes Bedrock §-prefixed color/format codes from a string.
func stripColors(s string) string {
	out := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		if s[i] == 0xc2 && i+1 < len(s) && s[i+1] == 0xa7 { // UTF-8 encoding of §
			if i+2 < len(s) {
				i += 2 // skip § and the one-char code
			}
			continue
		}
		if s[i] == '§' {
			if i+1 < len(s) {
				i++
			}
			continue
		}
		out = append(out, s[i])
	}
	return string(out)
}

func indexByte(s string, c byte) int {
	for i := 0; i < len(s); i++ {
		if s[i] == c {
			return i
		}
	}
	return -1
}

// loadOrAuth returns an oauth2.TokenSource, either refreshed from the cached
// token on disk or obtained fresh via the Microsoft device code flow.
func loadOrAuth(cachePath string) (oauth2.TokenSource, error) {
	if data, err := os.ReadFile(cachePath); err == nil {
		var tok oauth2.Token
		if err := json.Unmarshal(data, &tok); err == nil {
			logf("loaded cached token (expires %s)", tok.Expiry.Format(time.RFC3339))
			return auth.RefreshTokenSource(&tok), nil
		}
		logf("cache file unreadable: %v", err)
	}
	logf("no cached token, starting device code flow — prompt will appear on stderr")
	tok, err := auth.RequestLiveTokenWriter(os.Stderr)
	if err != nil {
		return nil, fmt.Errorf("RequestLiveToken: %w", err)
	}
	data, _ := json.Marshal(tok)
	_ = os.MkdirAll(filepath.Dir(cachePath), 0o700)
	if err := os.WriteFile(cachePath, data, 0o600); err != nil {
		logf("failed to save token cache: %v", err)
	}
	return auth.RefreshTokenSource(tok), nil
}

func main() {
	host := os.Getenv("SERVER_HOST")
	if host == "" {
		host = "142.79.47.246"
	}
	port := os.Getenv("SERVER_PORT")
	if port == "" {
		port = "9050"
	}
	cachePath := filepath.Join(os.Getenv("HOME"), ".config", "claude-bot", "bedrock-token.json")
	if v := os.Getenv("BEDROCK_TOKEN_CACHE"); v != "" {
		cachePath = v
	}

	logf("bedrock transport starting, target %s:%s", host, port)

	src, err := loadOrAuth(cachePath)
	if err != nil {
		emit(Event{Type: "error", Error: "auth: " + err.Error()})
		os.Exit(1)
	}
	emit(Event{Type: "msa_signed_in"})

	// Dial
	dialer := minecraft.Dialer{
		TokenSource:       src,
		KeepXBLIdentityData: true,
	}
	dialCtx, dialCancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer dialCancel()

	conn, err := dialer.DialContext(dialCtx, "raknet", host+":"+port)
	if err != nil {
		emit(Event{Type: "error", Error: "dial: " + err.Error()})
		os.Exit(1)
	}
	defer conn.Close()

	// Complete the spawn sequence
	spawnCtx, spawnCancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer spawnCancel()
	if err := conn.DoSpawnContext(spawnCtx); err != nil {
		emit(Event{Type: "error", Error: "spawn: " + err.Error()})
		os.Exit(1)
	}

	identity := conn.IdentityData()
	emit(Event{
		Type: "connected",
		Name: identity.DisplayName,
		XUID: identity.XUID,
	})
	logf("connected as %q xuid=%s", identity.DisplayName, identity.XUID)

	// Channel to signal shutdown
	done := make(chan struct{})
	var once sync.Once
	shutdown := func(reason string) {
		once.Do(func() {
			logf("shutdown: %s", reason)
			_ = conn.Close()
			close(done)
		})
	}

	// Packet read loop
	go func() {
		defer shutdown("read loop exited")
		for {
			pk, err := conn.ReadPacket()
			if err != nil {
				if err != io.EOF {
					logf("ReadPacket: %v", err)
				}
				emit(Event{Type: "disconnect", Reason: err.Error()})
				return
			}
			switch p := pk.(type) {
			case *packet.Respawn:
				// Auto-respawn after death. When the player dies, the server
				// sends Respawn with State=ReadyToSpawn; we must reply with
				// State=ClientReadyToSpawn or the player is stuck dead and
				// gets "Chat disabled in client options" on every chat attempt.
				if p.State == packet.RespawnStateReadyToSpawn {
					logf("death detected, auto-respawning at %v", p.Position)
					_ = conn.WritePacket(&packet.Respawn{
						Position:        p.Position,
						State:           packet.RespawnStateClientReadyToSpawn,
						EntityRuntimeID: p.EntityRuntimeID,
					})
				}
			case *packet.Text:
				// Debug: log EVERY text packet type/sender/message so we can see
				// exactly how Geyser formats incoming chat.
				logf("text packet: type=%d source=%q message=%q xuid=%q params=%v",
					p.TextType, p.SourceName, p.Message, p.XUID, p.Parameters)

				// Skip our own messages (by XUID — most reliable)
				if p.XUID != "" && p.XUID == identity.XUID {
					continue
				}

				sender, message := extractChat(p)
				if sender == "" || message == "" {
					continue
				}
				// Don't echo our own display name either
				if sender == identity.DisplayName || sender == "."+identity.DisplayName {
					continue
				}
				emit(Event{
					Type:    "chat",
					Sender:  sender,
					Message: message,
				})
			case *packet.Disconnect:
				emit(Event{Type: "disconnect", Reason: p.Message})
				return
			}
		}
	}()

	// Stdin command loop
	go func() {
		defer shutdown("stdin closed")
		scanner := bufio.NewScanner(os.Stdin)
		scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
		for scanner.Scan() {
			line := scanner.Bytes()
			if len(line) == 0 {
				continue
			}
			var cmd Command
			if err := json.Unmarshal(line, &cmd); err != nil {
				logf("invalid command json: %v", err)
				continue
			}
			switch cmd.Type {
			case "chat":
				if err := conn.WritePacket(&packet.Text{
					TextType:         packet.TextTypeChat,
					NeedsTranslation: false,
					SourceName:       identity.DisplayName,
					Message:          cmd.Message,
					XUID:             identity.XUID,
				}); err != nil {
					logf("WritePacket(chat): %v", err)
				}
			case "disconnect":
				return
			default:
				logf("unknown command type: %q", cmd.Type)
			}
		}
		if err := scanner.Err(); err != nil {
			logf("stdin scanner error: %v", err)
		}
	}()

	<-done
}
