import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface SupabaseConfig {
  url: string
  anonKey: string
  enabled: boolean
}

const STORAGE_KEY = 'seven_note_supabase_config'

export function getStoredSupabaseConfig(): SupabaseConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        url: parsed.url || '',
        anonKey: parsed.anonKey || '',
        enabled: Boolean(parsed.enabled)
      }
    }
  } catch (e) {
    console.error('Error reading Supabase config from storage', e)
  }

  // Fallback to environment variables if provided
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || ''
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || ''

  return {
    url: envUrl,
    anonKey: envKey,
    enabled: Boolean(envUrl && envKey)
  }
}

export function saveSupabaseConfig(config: SupabaseConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  cachedClient = null // Reset cached client
}

let cachedClient: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient

  const config = getStoredSupabaseConfig()
  if (!config.enabled || !config.url || !config.anonKey) {
    return null
  }

  try {
    cachedClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    })
    return cachedClient
  } catch (err) {
    console.error('Failed to create Supabase client:', err)
    return null
  }
}

export async function testSupabaseConnection(url: string, anonKey: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!url || !anonKey) {
      return { success: false, message: 'URL y Anon Key son obligatorios' }
    }
    const testClient = createClient(url, anonKey)
    // Check if we can reach the health or query workspaces table
    const { error } = await testClient.from('workspaces').select('id').limit(1)
    if (error) {
      // If table doesn't exist yet, warn user nicely
      if (error.code === '42P01') {
        return { 
          success: true, 
          message: 'Conectado a Supabase, pero la tabla "workspaces" no existe. Por favor ejecuta el script SQL.' 
        }
      }
      return { success: false, message: `Error de Supabase: ${error.message}` }
    }
    return { success: true, message: '¡Conexión exitosa con Supabase!' }
  } catch (err: any) {
    return { success: false, message: err?.message || 'Error al conectar con Supabase' }
  }
}
