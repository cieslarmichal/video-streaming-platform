# PRD: Video Streaming Platform

## 1. Przegląd produktu

### 1.1 Cel

Platforma do streamingu wideo z możliwością uploadu, automatycznego transkodowania do wielu rozdzielczości (HLS + DASH + MP4 fallback), i odtwarzania w przeglądarce z zaawansowanym playerem.

### 1.2 Użytkownicy

- **Zalogowani użytkownicy** - mogą uploadować wideo, przeglądać, odtwarzać, dodawać napisy
- **Niezalogowani użytkownicy** - brak dostępu do platformy (wymagane logowanie)

### 1.3 Kluczowe funkcjonalności

| Funkcja | Opis |
|---------|------|
| Upload wideo | Presigned URL do S3, max 10GB |
| Transkodowanie | HLS + DASH + MP4 fallback, 4 rozdzielczości |
| Player | HLS.js z wyborem rozdzielczości, głośności, napisów |
| Thumbnails | Sprite sheets co 5s, hover na progress bar |
| Napisy | Upload SRT przez użytkownika |
| Kategorie | Flat kategorie (bez hierarchii) |
| Wyszukiwanie | Po nazwie wideo |
| Real-time progress | WebSockets dla statusu enkodowania |

---

## 2. Architektura systemu

### 2.1 Komponenty

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│     API     │────▶│  PostgreSQL │
│   (React)   │◀────│  (Fastify)  │◀────│   (Drizzle) │
└─────────────┘     └──────┬──────┘     └─────────────┘
       │                   │
       │ WebSocket         │ AMQP
       │                   ▼
       │           ┌───────────────┐
       │           │   RabbitMQ    │
       │           └───────┬───────┘
       │                   │
       │    ┌──────────────┼──────────────┐
       │    ▼              ▼              ▼
       │ ┌──────┐    ┌──────────┐    ┌──────────┐
       │ │Down- │───▶│ Encoder  │───▶│ Uploader │
       │ │loader│    │(multiple)│    │          │
       │ └──────┘    └──────────┘    └────┬─────┘
       │                                  │
       │         ┌────────────────────────┘
       │         ▼
       │    ┌─────────┐     ┌─────────┐
       └───▶│  Redis  │     │   S3    │
            │ (cache) │     │(storage)│
            └─────────┘     └─────────┘
```

### 2.2 Przepływ enkodowania

```
1. User uploads video → Presigned URL → S3 (raw-videos bucket)
2. Frontend confirms upload → API creates video record (status: uploaded)
3. API publishes VideoIngestedMessage → RabbitMQ
4. Downloader downloads from S3 → shared-storage → publishes VideoDownloadedMessage
5. API receives downloaded event → creates encoding jobs → publishes VideoEncodingRequestedMessage (x4 resolutions + thumbnails)
6. Encoder(s) process jobs → publish VideoEncodedMessage per job
7. Uploader uploads artifacts → S3 → publishes VideoArtifactsUploadedMessage
8. API updates video status, notifies frontend via WebSocket
```

### 2.3 Buckety S3

| Bucket | Zawartość | Dostęp |
|--------|-----------|--------|
| `raw-videos` | Oryginalne uploady | Private |
| `encoded-videos` | HLS/DASH/MP4 pliki | Public (CDN) |
| `thumbnails` | Sprite sheets, postery | Public (CDN) |
| `subtitles` | Pliki SRT/VTT | Public |

---

## 3. Model danych

### 3.1 Schemat bazy danych

#### Tabela: `videos`

| Kolumna | Typ | Ograniczenia | Opis |
|---------|-----|--------------|------|
| `id` | UUID | PK | Identyfikator wideo |
| `user_id` | UUID | FK → users.id, NOT NULL | Właściciel |
| `category_id` | UUID | FK → categories.id, NULL | Kategoria |
| `title` | VARCHAR(255) | NOT NULL | Tytuł wideo |
| `description` | TEXT | NULL | Opis wideo |
| `original_filename` | VARCHAR(255) | NOT NULL | Oryginalna nazwa pliku |
| `original_container` | VARCHAR(16) | NOT NULL | Kontener źródłowy (mp4, mov, etc.) |
| `duration_seconds` | INTEGER | NULL | Długość w sekundach (po analizie) |
| `thumbnail_url` | TEXT | NULL | URL postera |
| `status` | VARCHAR(32) | NOT NULL, DEFAULT 'pending_upload' | Status wideo |
| `processing_progress` | INTEGER | DEFAULT 0 | Sumaryczny progress (0-100) |
| `hls_master_url` | TEXT | NULL | URL master playlist HLS |
| `dash_manifest_url` | TEXT | NULL | URL DASH manifest |
| `mp4_fallback_url` | TEXT | NULL | URL MP4 fallback (720p) |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW | Data utworzenia |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW | Data aktualizacji |

**Status wideo:**

- `pending_upload` - Oczekuje na upload
- `uploaded` - Wrzucone na S3, oczekuje na processing
- `downloading` - Downloader pobiera
- `processing` - Enkodowanie w toku
- `completed` - Gotowe do odtwarzania
- `failed` - Błąd przetwarzania

#### Tabela: `video_encodings`

| Kolumna | Typ | Ograniczenia | Opis |
|---------|-----|--------------|------|
| `id` | UUID | PK | Identyfikator |
| `video_id` | UUID | FK → videos.id CASCADE, NOT NULL | Wideo |
| `encoding_id` | VARCHAR(32) | NOT NULL | 360p, 480p, 720p, 1080p, thumbnails |
| `status` | VARCHAR(32) | NOT NULL, DEFAULT 'pending' | Status enkodowania |
| `progress` | INTEGER | DEFAULT 0 | Progress 0-100 |
| `output_url` | TEXT | NULL | URL zakodowanego pliku |
| `file_size_bytes` | BIGINT | NULL | Rozmiar wyjściowy |
| `started_at` | TIMESTAMP | NULL | Start enkodowania |
| `completed_at` | TIMESTAMP | NULL | Zakończenie |
| `error_message` | TEXT | NULL | Komunikat błędu |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW | Data utworzenia |

**Status enkodowania:** `pending`, `processing`, `completed`, `failed`

#### Tabela: `categories`

| Kolumna | Typ | Ograniczenia | Opis |
|---------|-----|--------------|------|
| `id` | UUID | PK | Identyfikator |
| `name` | VARCHAR(100) | NOT NULL, UNIQUE | Nazwa kategorii |
| `slug` | VARCHAR(100) | NOT NULL, UNIQUE | URL-friendly slug |
| `description` | TEXT | NULL | Opis kategorii |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW | Data utworzenia |

#### Tabela: `subtitles`

| Kolumna | Typ | Ograniczenia | Opis |
|---------|-----|--------------|------|
| `id` | UUID | PK | Identyfikator |
| `video_id` | UUID | FK → videos.id CASCADE, NOT NULL | Wideo |
| `language_code` | VARCHAR(10) | NOT NULL | Kod języka (en, pl, de) |
| `language_name` | VARCHAR(50) | NOT NULL | Nazwa języka (English, Polski) |
| `srt_url` | TEXT | NOT NULL | URL pliku SRT |
| `vtt_url` | TEXT | NULL | URL skonwertowanego VTT |
| `is_default` | BOOLEAN | DEFAULT FALSE | Domyślne napisy |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW | Data utworzenia |

**Unique constraint:** `(video_id, language_code)`

#### Tabela: `thumbnail_sprites`

| Kolumna | Typ | Ograniczenia | Opis |
|---------|-----|--------------|------|
| `id` | UUID | PK | Identyfikator |
| `video_id` | UUID | FK → videos.id CASCADE, NOT NULL, UNIQUE | Wideo (1:1) |
| `sprite_url` | TEXT | NOT NULL | URL sprite sheet |
| `vtt_url` | TEXT | NOT NULL | URL WebVTT z pozycjami |
| `interval_seconds` | INTEGER | NOT NULL, DEFAULT 5 | Interwał między klatkami |
| `thumb_width` | INTEGER | NOT NULL | Szerokość miniaturki |
| `thumb_height` | INTEGER | NOT NULL | Wysokość miniaturki |
| `columns` | INTEGER | NOT NULL | Kolumny w sprite |
| `rows` | INTEGER | NOT NULL | Wiersze w sprite |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW | Data utworzenia |

### 3.2 Indeksy

```sql
-- videos
CREATE INDEX idx_videos_user_id ON videos(user_id);
CREATE INDEX idx_videos_category_id ON videos(category_id);
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX idx_videos_title_search ON videos USING gin(to_tsvector('simple', title));

-- video_encodings
CREATE INDEX idx_video_encodings_video_id ON video_encodings(video_id);
CREATE INDEX idx_video_encodings_status ON video_encodings(status);

-- subtitles
CREATE INDEX idx_subtitles_video_id ON subtitles(video_id);
```

---

## 4. API Endpoints

### 4.1 Wideo

| Method | Endpoint | Auth | Opis |
|--------|----------|------|------|
| `POST` | `/videos` | ✅ | Inicjuje upload, zwraca presigned URL |
| `POST` | `/videos/:id/confirm-upload` | ✅ | Potwierdza upload, startuje processing |
| `GET` | `/videos` | ✅ | Lista wideo (paginacja, filtrowanie) |
| `GET` | `/videos/:id` | ✅ | Szczegóły wideo |
| `PATCH` | `/videos/:id` | ✅ | Aktualizacja metadanych (tylko owner) |
| `DELETE` | `/videos/:id` | ✅ | Usunięcie wideo (tylko owner) |
| `GET` | `/videos/:id/stream` | ✅ | Zwraca URLs do streamingu |

### 4.2 Napisy

| Method | Endpoint | Auth | Opis |
|--------|----------|------|------|
| `POST` | `/videos/:id/subtitles` | ✅ | Upload SRT (tylko owner) |
| `GET` | `/videos/:id/subtitles` | ✅ | Lista napisów |
| `DELETE` | `/videos/:id/subtitles/:subtitleId` | ✅ | Usuń napisy (tylko owner) |

### 4.3 Kategorie

| Method | Endpoint | Auth | Opis |
|--------|----------|------|------|
| `GET` | `/categories` | ✅ | Lista kategorii |
| `GET` | `/categories/:slug` | ✅ | Wideo w kategorii |

### 4.4 Wyszukiwanie

| Method | Endpoint | Auth | Opis |
|--------|----------|------|------|
| `GET` | `/search?q=term` | ✅ | Wyszukiwanie po nazwie |

### 4.5 Callbacks (wewnętrzne)

| Method | Endpoint | Auth | Opis |
|--------|----------|------|------|
| `POST` | `/internal/videos/:id/encoding-progress` | API Key | Update progressu enkodowania |
| `POST` | `/internal/videos/:id/encoding-complete` | API Key | Zakończenie enkodowania |

### 4.6 WebSocket

| Event | Kierunek | Payload | Opis |
|-------|----------|---------|------|
| `subscribe:video` | Client→Server | `{ videoId }` | Subskrypcja na update'y wideo |
| `unsubscribe:video` | Client→Server | `{ videoId }` | Anuluj subskrypcję |
| `video:progress` | Server→Client | `{ videoId, progress, status, encodings }` | Update progressu |
| `video:completed` | Server→Client | `{ videoId, hlsUrl, dashUrl, mp4Url }` | Enkodowanie zakończone |
| `video:failed` | Server→Client | `{ videoId, error }` | Błąd enkodowania |

---

## 5. Serwisy enkodowania

### 5.1 Downloader

**Odpowiedzialność:** Pobiera wideo z S3 (raw-videos) do shared-storage

**Input:** `VideoIngestedMessage`

```typescript
{ videoId, videoUrl, videoContainer }
```

**Output:** `VideoDownloadedMessage`

```typescript
{ videoId, location: '/shared-storage/{videoId}/source.{ext}', videoContainer }
```

**Logika:**

1. Pobierz plik z S3 URL
2. Zapisz do `/shared-storage/{videoId}/source.{container}`
3. Wyślij VideoDownloadedMessage
4. Wyślij progress update do API

### 5.2 Encoder

**Odpowiedzialność:** Transkoduje wideo do zadanej rozdzielczości/formatu

**Input:** `VideoEncodingRequestedMessage`

```typescript
{
  videoId,
  videoContainer,
  location,
  encoding: { id: '720p', container: 'ts', width: 1280, height: 720, bitrate: 2500000 }
}
```

**Output:** `VideoEncodedMessage`

```typescript
{ videoId, artifactsDirectory: '/shared-storage/{videoId}/720p/', encodingId: '720p' }
```

**Generowane artefakty:**

| Typ | Pliki | Lokalizacja |
|-----|-------|-------------|
| HLS | `playlist.m3u8`, `segment_*.ts` | `/{videoId}/{resolution}/hls/` |
| DASH | `manifest.mpd`, `segment_*.m4s`, `init.mp4` | `/{videoId}/{resolution}/dash/` |
| MP4 (tylko 720p) | `video.mp4` | `/{videoId}/mp4/` |
| Thumbnails | `sprites.jpg`, `thumbnails.vtt` | `/{videoId}/thumbnails/` |

**Komendy FFmpeg:**

```bash
# HLS
ffmpeg -i input.mp4 -vf scale=1280:720 -c:v libx264 -preset fast \
  -c:a aac -b:a 128k -hls_time 6 -hls_playlist_type vod \
  -hls_segment_filename 'segment_%03d.ts' playlist.m3u8

# DASH
ffmpeg -i input.mp4 -vf scale=1280:720 -c:v libx264 -preset fast \
  -c:a aac -b:a 128k -f dash -seg_duration 6 manifest.mpd

# MP4 fallback
ffmpeg -i input.mp4 -vf scale=1280:720 -c:v libx264 -preset fast \
  -c:a aac -movflags +faststart output.mp4

# Thumbnails sprite sheet (co 5s, dynamiczny interval dla długich wideo)
ffmpeg -i input.mp4 -vf "fps=1/5,scale=160:90,tile=10x10" sprites.jpg
```

**Progress reporting:**

- Parsuj stderr FFmpeg dla `time=` i `duration=`
- Wyślij HTTP POST do API z progressem co 5%
- Redis pub/sub dla real-time updates

### 5.3 Uploader

**Odpowiedzialność:** Uploaduje artefakty z shared-storage do S3

**Input:** `VideoEncodedMessage`

```typescript
{ videoId, artifactsDirectory, encodingId }
```

**Output:** `VideoArtifactsUploadedMessage`

```typescript
{ videoId, encodingId }
```

**Logika:**

1. Listuj pliki w artifactsDirectory
2. Uploaduj każdy plik do S3:
   - HLS/DASH → `encoded-videos/{videoId}/{resolution}/`
   - Thumbnails → `thumbnails/{videoId}/`
3. Wyślij wiadomość o zakończeniu
4. Wyślij update do API z URLami

### 5.4 Master Playlist Generation (w API)

**Odpowiedzialność:** Generuje master playlist HLS i manifest DASH

**Logika:**

1. Po otrzymaniu wszystkich `VideoArtifactsUploadedMessage` (4 rozdzielczości)
2. Generuj master playlist:

```m3u8
#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
360p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1400000,RESOLUTION=854x480
480p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720
720p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
1080p/playlist.m3u8
```

3. Uploaduj do S3
4. Zaktualizuj rekord wideo w bazie

---

## 6. Frontend

### 6.1 Strony

| Route | Komponent | Opis |
|-------|-----------|------|
| `/` | `HomePage` | Lista wideo, featured, kategorie |
| `/videos` | `VideosPage` | Przeglądarka wideo z filtrami |
| `/videos/:id` | `VideoPlayerPage` | Player z metadanymi |
| `/upload` | `UploadPage` | Upload wideo |
| `/my-videos` | `MyVideosPage` | Lista wideo użytkownika |
| `/categories/:slug` | `CategoryPage` | Wideo w kategorii |
| `/search` | `SearchPage` | Wyniki wyszukiwania |

### 6.2 Komponenty

#### VideoPlayer

- Bazuje na `hls.js` + `dashjs` jako fallback
- Customowy UI z kontrolkami
- Wybór rozdzielczości (auto + manual)
- Wybór napisów
- Kontrola głośności + mute
- Fullscreen
- Progress bar z podglądem thumbnails

#### ThumbnailPreview

- Ładuje sprite sheet + WebVTT
- Pokazuje odpowiednią miniaturkę przy hover na progress bar
- Kalkuluje pozycję w sprite na podstawie czasu

#### UploadProgress

- WebSocket connection dla real-time updates
- Progress bar per rozdzielczość
- Sumaryczny progress
- Status badges (pending, processing, completed, failed)

### 6.3 State Management

```typescript
// Video upload context
interface UploadState {
  file: File | null;
  uploadProgress: number;
  videoId: string | null;
  encodingProgress: EncodingProgress;
}

interface EncodingProgress {
  overall: number;
  encodings: {
    [key: string]: {
      status: 'pending' | 'processing' | 'completed' | 'failed';
      progress: number;
    };
  };
}
```

---

## 7. Wymagania techniczne

### 7.1 Limity

| Parametr | Wartość |
|----------|---------|
| Max rozmiar pliku | 10 GB |
| Max długość wideo | brak limitu |
| Presigned URL TTL | 1 godzina |
| Obsługiwane formaty | mp4, mov, avi, mkv, webm, flv, wmv, 3gp |
| Rozdzielczości output | 360p, 480p, 720p, 1080p |
| Thumbnail interval | 5 sekund (dynamiczny dla długich wideo: min(5, duration/100)) |
| Sprite sheet max | 10x10 = 100 thumbs |

### 7.2 Specyfikacje rozdzielczości

| ID | Wymiary | Video Bitrate | Audio Bitrate |
|----|---------|---------------|---------------|
| 360p | 640x360 | 800 kbps | 96 kbps |
| 480p | 854x480 | 1400 kbps | 128 kbps |
| 720p | 1280x720 | 2800 kbps | 128 kbps |
| 1080p | 1920x1080 | 5000 kbps | 192 kbps |

### 7.3 Formaty wyjściowe

| Format | Codec Video | Codec Audio | Container |
|--------|-------------|-------------|-----------|
| HLS | H.264 (libx264) | AAC | MPEG-TS (.ts) |
| DASH | H.264 (libx264) | AAC | fMP4 (.m4s) |
| MP4 | H.264 (libx264) | AAC | MP4 |

---

## 8. Bezpieczeństwo

### 8.1 Autoryzacja

- Wszystkie endpointy wymagają JWT access token
- Operacje na wideo (update, delete) - tylko owner
- Upload napisów - tylko owner wideo
- Presigned URLs - generowane tylko dla zalogowanych

### 8.2 Walidacja

- Walidacja typu pliku po MIME i rozszerzeniu
- Walidacja rozmiaru przed generowaniem presigned URL
- Sanityzacja nazw plików
- Escape'owanie tytułów i opisów

### 8.3 Rate Limiting

| Endpoint | Limit |
|----------|-------|
| `POST /videos` (upload init) | 10/godzinę/user |
| `GET /videos` | 100/minutę/user |
| `GET /search` | 30/minutę/user |

---

## 9. Obsługa błędów i retry

### 9.1 Failed encodings

- Automatyczny retry: 3 próby z exponential backoff (1min, 5min, 15min)
- Po 3 nieudanych próbach status `failed` z error message
- Możliwość ręcznego retry przez właściciela wideo

### 9.2 Usuwanie raw files

- Oryginalne pliki z `raw-videos` usuwane po 7 dniach (S3 lifecycle policy)
- Usunięcie następuje tylko po pomyślnym zakończeniu enkodowania

### 9.3 Współbieżność enkoderów

- RabbitMQ prefetch=1 per encoder instance
- Skalowanie horyzontalne przez dodawanie instancji
- Dead letter queue dla failed jobs

---

## 10. Kolejność implementacji

### Faza 1: Fundament (Tydzień 1-2)

1. Schema bazy danych (migracje Drizzle)
2. CRUD kategorii (API)
3. CRUD wideo - podstawowe metadane (API)
4. Lista wideo i strona szczegółów (Frontend)

### Faza 2: Upload (Tydzień 3-4)

5. Presigned URL generation (S3 Service)
6. Upload flow (Frontend)
7. Confirm upload endpoint
8. Downloader service

### Faza 3: Enkodowanie (Tydzień 5-7)

9. Encoder service (HLS + DASH + MP4)
10. Uploader service
11. Master playlist generation w API
12. Thumbnail sprite generation

### Faza 4: Real-time & Player (Tydzień 8-9)

13. WebSocket setup (Fastify)
14. Redis pub/sub dla progressu
15. Progress tracking (Frontend)
16. Video player z HLS.js

### Faza 5: Finishing (Tydzień 10)

17. Napisy (upload SRT, konwersja VTT)
18. Thumbnail hover na player
19. Wyszukiwanie
20. Polish & testy
