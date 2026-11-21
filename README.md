# Salesianos FEST 2026

Panel de administración y página de resultados para el campeonato interpromociones. El fixture original de 45 partidos se encuentra en `backend/app/data/fixture.json`. Las promociones, grupos y rondas se cargan una sola vez al inicializar la base.

## Arquitectura

- `frontend/`: React, TypeScript y Vite. Rutas `/` (resultados) y `/admin` (operación).
- `backend/app/api/public/`: API de lectura para espectadores.
- `backend/app/api/admin/`: edición protegida por sesión.
- `backend/app/models/`: entidades SQLAlchemy.
- `backend/app/schemas/`: validación de entradas.
- `backend/app/services/`: tablas de posiciones, reloj, ganador y avance de llaves.
- `backend/migrations/`: versiones Alembic del esquema SQL.
- `backend/app/data/fixture.json`: dato inicial versionado en GitHub. Los marcadores activos viven en PostgreSQL.

El resultado final de un partido de grupo aporta PJ, G, E, P, DG y puntos. Los partidos en juego aportan puntos *provisionales* en su tarjeta, sin modificar la tabla oficial. En eliminación, el administrador puede escoger tiempo extra, ir directamente a penales o decidir un ganador manualmente. Los 16 participantes de octavos se asignan desde el admin cuando se confirme el criterio de clasificación de los nueve grupos.

## Inicio con Docker

1. Copia `.env.example` a `.env` y reemplaza los tres secretos. Puedes generar `SECRET_KEY` con `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
2. Ejecuta `docker compose up --build -d`.
3. Abre `http://localhost:8080` para el público y `http://localhost:8080/admin` para el panel.

La primera ejecución aplica las migraciones y carga el fixture. Reiniciar **no borra** resultados. PostgreSQL usa el volumen `postgres_data`. Para un dominio con HTTPS, establece `COOKIE_SECURE=true` y publica la web detrás de HTTPS.

## Desarrollo local

En `backend/`, crea un entorno virtual y ejecuta `pip install -r requirements.txt`, `alembic upgrade head` y `python -m app.seed`. Configura `ADMIN_PASSWORD` y `SECRET_KEY` en el entorno y arranca `uvicorn app.main:app --reload`.

En `frontend/`, ejecuta `npm ci` y `npm run dev`. Vite envía `/api` a `localhost:8000`; la web estará en `localhost:5173`. En Docker se usa Nginx y PostgreSQL; SQLite local es solo una alternativa de desarrollo.

## Operación

1. El administrador inicia sesión y selecciona un grupo.
2. Puede cambiar los rivales dentro de ese grupo, hora, cancha, duración y goles.
3. **Actualizar grupo** guarda todos los partidos del grupo en una transacción. Los botones de estado guardan de inmediato y guardan antes cualquier edición pendiente.
4. Al iniciar un partido, el reloj se guarda en el servidor. Medio tiempo lo pausa; se puede reanudar, activar tiempo extra o penales sin imponer una secuencia.
5. Al finalizar, la tabla pública se recalcula. Si el marcador empata, una definición por penales o por elección manual se guarda separada de los goles.
6. En **Llaves finales**, el admin asigna los equipos de octavos. Cada ganador finalizado ocupa su lugar en la siguiente ronda.

Los criterios de clasificación y desempate entre promociones con la misma puntuación siguen pendientes de confirmación por la organización; el programa no inventa esos criterios.
