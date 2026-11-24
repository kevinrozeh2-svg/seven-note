# Seven Note — Remote MCP Server (`/api/mcp`)

Servidor **MCP (Model Context Protocol)** remoto en modo **Streamable HTTP (stateless)** desplegado en Vercel para usar **Seven Note** como el cerebro compartido de los bots del equipo.

## 1. Variables de entorno en Vercel

En **Vercel Dashboard → Tu Proyecto → Settings → Environment Variables**, agrega:

| Variable | Valor | Notas |
| --- | --- | --- |
| `SUPABASE_URL` | `https://tu-proyecto.supabase.co` | También toma `VITE_SUPABASE_URL` si ya existe |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (Service Role Key de Supabase) | **Solo en servidor** (nunca con prefijo `VITE_`) |
| `SEVEN_NOTE_MCP_API_KEY` | Un token largo aleatorio (ej. 32+ chars) | Es la clave que usarán tus bots para autenticarse |
| `MCP_INCLUDE_PRIVATE` | `false` *(opcional)* | Por defecto `false`: los bots solo acceden a espacios y notas compartidas |

Luego haz **Redeploy** en Vercel.

## 2. Endpoint y autenticación

- **URL:** `https://<tu-dominio-vercel>/api/mcp`
- **Transporte:** Streamable HTTP (`POST`)
- **Headers requeridos:**
  - `Authorization: Bearer <SEVEN_NOTE_MCP_API_KEY>` (o `x-api-key: <SEVEN_NOTE_MCP_API_KEY>`)
  - `Content-Type: application/json`
  - `Accept: application/json, text/event-stream`

Para comprobar que está vivo, abre `https://<tu-dominio-vercel>/api/mcp` en el navegador (o haz un `GET`): debe responder `{"ok": true, "name": "seven-note-brain", ...}`.

## 3. Herramientas disponibles para los bots

| Tool | Qué hace |
| --- | --- |
| `list_spaces` | Lista todos los espacios compartidos activos y sus carpetas |
| `list_documents` | Lista documentos filtrables por `space_id`, `folder`, `tag` o favoritos |
| `search_knowledge` | Busca en títulos, contenido, carpetas, tags y notas de canvas (devuelve snippets rankeados) |
| `get_document` | Lee un documento completo convertido a **Markdown limpio** (+ propiedades, tags y canvas opcional) |
| `create_document` | Crea un documento nuevo desde Markdown/HTML (se sincroniza solo con la web y app de escritorio) |
| `update_document` | Reemplaza o hace `append` al final de un documento existente (ideal para memoria/logs de bots) |
| `get_canvas` | Lee los nodos y conexiones de un tablero canvas |
| `add_canvas_note` | Agrega una nota o checklist (`todo`) a un tablero canvas |
| `list_tags_and_collections` | Lista etiquetas y colecciones de un espacio |

## 4. Cómo conectarlo a tus bots

### Cliente MCP estándar (Claude, Cursor, Antigravity, OpenAI Agents, etc.)
```json
{
  "mcpServers": {
    "seven-note": {
      "url": "https://<tu-dominio-vercel>/api/mcp",
      "headers": {
        "Authorization": "Bearer TU_SEVEN_NOTE_MCP_API_KEY"
      }
    }
  }
}
```

### n8n (MCP Client Tool node)
- **Endpoint:** `https://<tu-dominio-vercel>/api/mcp`
- **Server Transport:** `HTTP Streamable`
- **Authentication:** `Bearer Auth` (o Header `x-api-key`) con tu `SEVEN_NOTE_MCP_API_KEY`

### Prueba rápida con `curl`
```bash
curl -X POST https://<tu-dominio-vercel>/api/mcp \
  -H "Authorization: Bearer TU_SEVEN_NOTE_MCP_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```
