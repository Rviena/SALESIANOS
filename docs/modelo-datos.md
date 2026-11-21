# Modelo de datos

La fuente oficial son los partidos. `GET /api/state` calcula la tabla del grupo a partir de resultados finalizados, separa los puntos provisionales de partidos en juego y entrega las llaves. No se edita una tabla de posiciones independiente.

```mermaid
erDiagram
  TOURNAMENTS ||--o{ COMPETITIONS : tiene
  COMPETITIONS ||--o{ GROUPS : organiza
  COMPETITIONS ||--o{ TEAMS : inscribe
  PROMOTIONS ||--o{ TEAMS : representa
  GROUPS ||--o{ TEAMS : integra
  GROUPS o|--o{ MATCHES : agrupa
  TEAMS o|--o{ MATCHES : local
  TEAMS o|--o{ MATCHES : visita
  TEAMS o|--o{ MATCHES : ganador
  MATCHES ||--o{ AUDIT_LOGS : registra

  TOURNAMENTS {
    int id PK
    string name
  }
  COMPETITIONS {
    int id PK
    int tournament_id FK
    string discipline
    string category
    int win_points
    int draw_points
  }
  PROMOTIONS {
    string id PK
    string label
  }
  GROUPS {
    string id PK
    int competition_id FK
    int revision
  }
  TEAMS {
    string id PK
    string group_id FK
    string promotion_id FK
    int competition_id FK
  }
  MATCHES {
    string id PK
    string group_id FK
    string stage
    string home_id FK
    string away_id FK
    int home_score
    int away_score
    string status
    int elapsed_seconds
    datetime running_since
    string winner_id FK
    string decision
  }
  AUDIT_LOGS {
    int id PK
    string match_id FK
    string action
    string details
    datetime created_at
  }
```

`MATCHES` contiene además hora, cancha, duración y tantos de penales. El cronómetro suma `elapsed_seconds` con los segundos desde `running_since` solo si está corriendo. Para las rondas de eliminación, `stage` y `position` determinan el siguiente partido: dos posiciones alimentan una posición de la siguiente ronda. El admin asigna manualmente los participantes de octavos hasta confirmar las reglas de clasificación.

Se guarda un registro de las ediciones y controles del administrador en `AUDIT_LOGS`. Las migraciones están en `backend/migrations/versions/`.
