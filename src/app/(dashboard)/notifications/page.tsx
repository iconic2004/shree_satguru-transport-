'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bell, Check, AlertTriangle, Truck, Package, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { toast } from '@/lib/hooks/use-toast'
import { getRelativeTime } from '@/lib/utils/formatting'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadNotifications = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })

      if (data && data.length > 0) {
        setNotifications(
          data.map((n: any) => ({
            id: n.id,
            title: n.title,
            message: n.message,
            type: n.type || 'info',
            is_read: n.is_read || false,
            time: n.created_at ? getRelativeTime(n.created_at) : 'Recent',
          }))
        )
      } else {
        setNotifications([])
      }
    } catch (err) {
      console.error('Failed to load notifications:', err)
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  const markAllRead = async () => {
    try {
      const supabase = createClient()
      await (supabase.from('notifications') as any).update({ is_read: true }).eq('is_read', false)
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      toast({
        title: 'All Caught Up',
        description: 'Marked all operational alerts as read.',
        variant: 'success',
      })
    } catch {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    }
  }

  const markSingleRead = async (id: string) => {
    try {
      const supabase = createClient()
      await (supabase.from('notifications') as any).update({ is_read: true }).eq('id', id)
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, is_read: true } : n)))
    } catch {
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, is_read: true } : n)))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications & Operational Alerts"
        description="Real-time alerts for incoming godown goods, trip dispatch events, failed stops and document renewal notices"
        actions={
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={markAllRead}
          >
            <Check className="w-3.5 h-3.5 mr-1.5" />
            Mark All as Read
          </Button>
        }
      />

      <Card className="border-gray-200/80 shadow-sm divide-y divide-gray-100 overflow-hidden">
        {notifications.map((item) => (
          <div
            key={item.id}
            className={`p-4 flex items-start gap-3.5 transition-colors ${
              item.is_read ? 'bg-white' : 'bg-orange-50/20'
            }`}
          >
            <div
              className={`p-2 rounded-xl mt-0.5 flex-shrink-0 ${
                item.type === 'warning'
                  ? 'bg-amber-100 text-amber-800'
                  : item.type === 'error'
                  ? 'bg-rose-100 text-rose-800'
                  : item.type === 'success'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-navy-100 text-navy-800'
              }`}
            >
              {item.type === 'warning' ? (
                <AlertTriangle className="w-4 h-4" />
              ) : item.type === 'error' ? (
                <ShieldAlert className="w-4 h-4" />
              ) : item.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Truck className="w-4 h-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-xs font-bold text-navy-950">{item.title}</p>
                <span className="text-[10px] text-gray-400 font-medium flex-shrink-0">{item.time}</span>
              </div>
              <p className="text-xs text-gray-600 font-normal leading-relaxed">{item.message}</p>
            </div>
            {!item.is_read && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-navy-700 hover:bg-navy-50 flex-shrink-0"
                onClick={() => markSingleRead(item.id)}
              >
                Mark Read
              </Button>
            )}
          </div>
        ))}
      </Card>
    </div>
  )
}
