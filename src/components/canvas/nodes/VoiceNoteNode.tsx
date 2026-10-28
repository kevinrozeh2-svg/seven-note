import { useState, useRef, useEffect, memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Mic, Square, Play, Pause, Trash2, Volume2 } from 'lucide-react'
import { db } from '../../../db'
import { toast } from 'sonner'
import { areNodePropsEqual } from './nodeUtils'

export const VoiceNoteNode = memo(function VoiceNoteNode({ id, data, selected }: NodeProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(typeof data.audioDataUrl === 'string' ? data.audioDataUrl : null)
  const [duration, setDuration] = useState<number>(typeof data.audioDuration === 'number' ? data.audioDuration : 0)
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [title, setTitle] = useState<string>(typeof data.title === 'string' ? data.title : 'Nota de Voz')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<any>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause()
      }
    }
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.readAsDataURL(audioBlob)
        reader.onloadend = async () => {
          const base64Audio = reader.result as string
          setAudioUrl(base64Audio)
          setIsRecording(false)
          clearInterval(timerRef.current)

          await db.canvasNodes.update(id, {
            data: {
              ...data,
              audioDataUrl: base64Audio,
              audioDuration: duration
            },
            updatedAt: Date.now()
          })
          toast.success('Grabación guardada localmente')
        }
        stream.getTracks().forEach((track) => track.stop())
      }

      setDuration(0)
      mediaRecorder.start(200)
      setIsRecording(true)

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('Error al acceder al micrófono:', err)
      toast.error('No se pudo acceder al micrófono')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      clearInterval(timerRef.current)
    }
  }

  const togglePlayback = () => {
    if (!audioPlayerRef.current && audioUrl) {
      audioPlayerRef.current = new Audio(audioUrl)
      audioPlayerRef.current.ontimeupdate = () => {
        setCurrentTime(audioPlayerRef.current?.currentTime || 0)
      }
      audioPlayerRef.current.onended = () => {
        setIsPlaying(false)
        setCurrentTime(0)
      }
    }

    if (audioPlayerRef.current) {
      if (isPlaying) {
        audioPlayerRef.current.pause()
        setIsPlaying(false)
      } else {
        audioPlayerRef.current.play()
        setIsPlaying(true)
      }
    }
  }

  const handleDeleteAudio = async () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause()
      audioPlayerRef.current = null
    }
    setAudioUrl(null)
    setIsPlaying(false)
    setDuration(0)
    setCurrentTime(0)

    await db.canvasNodes.update(id, {
      data: {
        ...data,
        audioDataUrl: undefined,
        audioDuration: 0
      },
      updatedAt: Date.now()
    })
    toast.info('Audio eliminado')
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div
      className={`min-w-[280px] bg-[var(--app-bg-primary)] rounded-lg shadow-[var(--app-shadow-card)] border border-[var(--app-border)] overflow-hidden transition-[box-shadow,border-color] duration-150 ${
        selected ? 'ring-1.5 ring-[var(--app-accent)] border-[var(--app-accent)] shadow-[var(--app-shadow-card-hover)]' : 'hover:border-[var(--app-border-strong)]'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-[var(--app-accent)]" />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--app-bg-secondary)] border-b border-[var(--app-border)]">
        <div className="flex items-center gap-2 flex-1">
          <Volume2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <input
            type="text"
            value={title}
            onChange={async (e) => {
              setTitle(e.target.value)
              await db.canvasNodes.update(id, {
                data: { ...data, title: e.target.value },
                updatedAt: Date.now()
              })
            }}
            placeholder="Título de audio..."
            className="text-xs font-semibold bg-transparent text-neutral-800 dark:text-neutral-200 outline-none w-full"
          />
        </div>
      </div>

      {/* Audio controls */}
      <div className="p-3.5">
        {!audioUrl && !isRecording && (
          <div className="flex flex-col items-center justify-center py-4 border border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl">
            <button
              onClick={startRecording}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-rose-500 hover:bg-rose-600 text-white font-medium text-xs shadow-md shadow-rose-500/20 transition-all active:scale-95"
            >
              <Mic className="w-3.5 h-3.5" />
              Grabar Nota de Voz
            </button>
            <span className="text-[10px] text-neutral-400 mt-2">Guarda audio offline 100% en tu dispositivo</span>
          </div>
        )}

        {isRecording && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 animate-pulse">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
              <span className="text-xs font-mono font-semibold text-rose-600 dark:text-rose-400">
                Grabando... {formatTime(duration)}
              </span>
            </div>
            <button
              onClick={stopRecording}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium shadow-sm transition-all"
            >
              <Square className="w-3 h-3 fill-current" />
              Parar
            </button>
          </div>
        )}

        {audioUrl && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={togglePlayback}
                className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/25 transition-transform active:scale-95 shrink-0"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>

              {/* Progress bar fake/real */}
              <div className="flex-1 space-y-1">
                <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-100 rounded-full"
                    style={{
                      width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-neutral-400">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <button
                onClick={handleDeleteAudio}
                title="Eliminar audio"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-emerald-500" />
    </div>
  )
}, areNodePropsEqual)
