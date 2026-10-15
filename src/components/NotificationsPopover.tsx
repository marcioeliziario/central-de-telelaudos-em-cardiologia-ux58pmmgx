import React, { useState, useEffect } from 'react'
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileCheck,
  FileText,
  RotateCcw,
  Check,
  X,
  ShieldCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { notificationService } from '@/services/telelaudosService'
import { InternalNotification } from '@/types/telelaudos'

interface NotificationsPopoverProps {
  orgId?: string
  role?: string
}

export function NotificationsPopover({ orgId, role }: NotificationsPopoverProps) {
  const [notifications, setNotifications] = useState<InternalNotification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadNotifications = async () => {
    try {
      const list = await notificationService.getForUser(orgId, role)
      setNotifications(list as InternalNotification[])
    } catch (err) {
      console.warn('Erro ao carregar notificações:', err)
    }
  }

  useEffect(() => {
    loadNotifications()
    const interval = setInterval(loadNotifications, 30000) // Polling suave a cada 30s
    return () => clearInterval(interval)
  }, [orgId, role])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id)
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n,
        ),
      )
    } catch {
      /* intentionally ignored */
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead(notifications)
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    } catch {
      /* intentionally ignored */
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'NOVO_ECG_RECEBIDO':
        return <FileText className="w-4 h-4 text-blue-600 shrink-0" />
      case 'EXAME_DEVOLVIDO_QUALIDADE':
        return <RotateCcw className="w-4 h-4 text-rose-600 shrink-0" />
      case 'EXAME_PROXIMO_DO_PRAZO':
        return <Clock className="w-4 h-4 text-amber-600 shrink-0" />
      case 'EXAME_ATRASADO':
        return <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
      case 'LAUDO_VALIDADO_LIBERADO':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
      default:
        return <Bell className="w-4 h-4 text-slate-500 shrink-0" />
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative h-8 px-2.5 text-xs text-slate-700 border-slate-300 hover:bg-slate-100 gap-1.5"
          title="Notificações Internas"
        >
          <Bell className="w-3.5 h-3.5 text-slate-600" />
          <span className="hidden sm:inline">Notificações</span>
          {unreadCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-red-600 rounded-full animate-pulse">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 sm:w-96 p-0 shadow-lg border-slate-200" align="end">
        <div className="flex items-center justify-between p-3 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-1.5">
            <Bell className="w-4 h-4 text-[#0E4C92]" />
            <span className="text-xs font-bold text-slate-900">Notificações Internas</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {unreadCount} novas
            </Badge>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              className="h-6 text-[11px] text-blue-700 hover:text-blue-800 p-1"
            >
              Marcar lidas
            </Button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 text-xs">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-slate-400">
              <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              Nenhuma notificação interna recente.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3 transition-colors flex items-start gap-2.5 ${
                  n.is_read ? 'bg-white hover:bg-slate-50' : 'bg-blue-50/50 hover:bg-blue-50'
                }`}
              >
                <div className="mt-0.5">{getIcon(n.notification_type)}</div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-slate-900 truncate">{n.title}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {new Date(n.created).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                    {n.message}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-400">
                      {new Date(n.created).toLocaleDateString('pt-BR')}
                    </span>
                    {!n.is_read && (
                      <button
                        onClick={() => handleMarkAsRead(n.id)}
                        className="text-[10px] text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Marcar como lida
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-2 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-500 text-center">
          Notificações operacionais não substituem a comunicação formal de achados críticos.
        </div>
      </PopoverContent>
    </Popover>
  )
}
export default NotificationsPopover
